// The HTTP API. One function from a Request to a Response, with everything it touches passed in (the database, the bucket,
// the mailer, the clock), so the tests drive it without Cloudflare. The Pages Function in functions/api/ is a thin wrapper.
import { endSession, getSession, isAdmin, pruneAuth, requestLogin, verifyLogin, SESSION_DAYS, type Ctx, type Session } from "./auth.ts";
import { handleAdmin } from "./admin.ts";
import type { Bucket } from "./db.ts";
import { deployIfDue } from "./deploy.ts";
import { contentTypeOf, storeImage, type ImageKind } from "./images.ts";
import { isPublicImage, buildPublic } from "./public.ts";
import { parseGame, parseProfile } from "./rules.ts";
import { eraseAccount, mine, removeGame, saveGame, saveProfile, setFull } from "./store.ts";
import { backup } from "./backup.ts";
import { recordingMailer } from "./email.ts";
import { expireInactive } from "./retention.ts";
import { allow, iso, logEvent, metaGet, metaSet, pruneRateEvents, safeEqual } from "./util.ts";
import { tellOwner, watchBackup } from "./watch.ts";
import { one } from "./db.ts";

/** The same context with a mailer that records whether mail last worked (shown by /api/health). */
const logged = (c: Ctx): Ctx => ({ ...c, mailer: recordingMailer(c.mailer, c.db, c.now) });

export type Env = {
  ctx: Ctx;
  images: Bucket;
  buildKey: string;
  deployHook: string;
  /** Cloudflare Turnstile secret; empty in development, where the check is skipped. */
  turnstileSecret: string;
  fetcher?: typeof fetch;
};

const COOKIE = "tpk_session";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

const json = (status: number, body: unknown, extra: Record<string, string> = {}): Response => new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
const err = (status: number, error: string, extra: Record<string, unknown> = {}): Response => json(status, { ok: false, error, ...extra });

function cookieOf(request: Request): string | null {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]+)`).exec(request.headers.get("Cookie") ?? "");
  return m ? m[1]! : null;
}

/** `Secure` only on the real https site: browsers refuse it over plain http, which is how the local test server runs. */
const sessionCookie = (value: string, days: number, siteUrl: string): string => `${COOKIE}=${value}; HttpOnly;${siteUrl.startsWith("https:") ? " Secure;" : ""} SameSite=Lax; Path=/; Max-Age=${days * 86_400}`;

/** A browser request that changes something must come from the site itself (cookies are SameSite=Lax; this is the second lock). */
function fromSite(request: Request, siteUrl: string): boolean {
  const origin = request.headers.get("Origin");
  return origin !== null && origin === new URL(siteUrl).origin;
}

export async function verifyTurnstile(secret: string, token: unknown, ip: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!secret) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const res = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret, response: token, remoteip: ip }) });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get("Content-Type") ?? "").startsWith("application/json")) return null;
  try {
    const v = await request.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Handles one request. `after` receives work to finish after the answer is sent (on Workers: `waitUntil`). */
export async function handle(request: Request, env: Env, after: (p: Promise<unknown>) => void = () => {}): Promise<Response> {
  const ctx = logged(env.ctx);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
  const method = request.method;
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const publish = () => after(deployIfDue(ctx, env.deployHook, env.fetcher).catch(() => "failed"));

  // Public reads
  if (method === "GET" && path === "/public") {
    return safeEqual(url.searchParams.get("key") ?? "", env.buildKey) && env.buildKey ? json(200, await buildPublic(ctx)) : err(403, "forbidden");
  }
  // The timers (the Worker in cron/) call this with the build key: "tick" sends a waiting build, "daily" backs up and rebuilds.
  if (method === "POST" && path === "/cron") {
    if (!(env.buildKey && safeEqual(url.searchParams.get("key") ?? "", env.buildKey))) return err(403, "forbidden");
    if (url.searchParams.get("job") === "daily") {
      await daily(env);
      return json(200, { ok: true, job: "daily" });
    }
    const result = await deployIfDue(ctx, env.deployHook, env.fetcher);
    await watchBackup(ctx);
    return json(200, { ok: true, job: "tick", result });
  }
  if (method === "GET" && path === "/health") {
    if (!(env.buildKey && safeEqual(url.searchParams.get("key") ?? "", env.buildKey))) return err(403, "forbidden");
    const n = async (table: string) => (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0;
    return json(200, { ok: true, accounts: await n("accounts"), profiles: await n("profiles"), games: await n("games"), admins: await n("admins"), deployConfigured: Boolean(env.deployHook), lastBackupAt: (await metaGet(ctx.db, "backup_ok_at")) || null, backupError: (await metaGet(ctx.db, "backup_error")) || null, lastMailOkAt: (await metaGet(ctx.db, "mail_ok_at")) || null, lastMailError: (await metaGet(ctx.db, "mail_error_at")) ? { at: await metaGet(ctx.db, "mail_error_at"), error: await metaGet(ctx.db, "mail_error") } : null });
  }
  if (method === "GET" && path.startsWith("/img/")) {
    const key = decodeURIComponent(path.slice(5));
    if (!/^(?:covers|photos)\/[a-z0-9]{8,40}\.(?:webp|jpg|png)$/.test(key)) return err(404, "not_found");
    const viaKey = env.buildKey && safeEqual(url.searchParams.get("key") ?? "", env.buildKey);
    const viewer = viaKey ? null : await getSession(ctx, cookieOf(request));
    // The build and admins see every picture (an admin reviews pending ones); everyone else only those of approved things.
    if (!viaKey && !(viewer && (await isAdmin(ctx, viewer.email))) && !(await isPublicImage(ctx, key))) return err(404, "not_found");
    const object = await env.images.get(key);
    if (!object) return err(404, "not_found");
    return new Response(object.body as BodyInit, { headers: { "Content-Type": contentTypeOf(key), "Cache-Control": viaKey || viewer ? "private, max-age=300" : "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
  }

  // Everything below changes or reads something private: the same site only, JSON in and out.
  if (method !== "GET" && !fromSite(request, ctx.siteUrl)) return err(403, "forbidden");

  if (method === "POST" && path === "/login/request") {
    const b = await body(request);
    if (!b) return err(400, "bad_request");
    if (!(await verifyTurnstile(env.turnstileSecret, b.turnstile, ip, env.fetcher))) return err(400, "turnstile_failed");
    const r = await requestLogin(ctx, b.email, ip);
    return r.ok ? json(200, { ok: true }) : err(r.error === "rate_limited" ? 429 : r.error === "bad_email" ? 400 : 502, r.error);
  }
  if (method === "POST" && path === "/login/verify") {
    const b = await body(request);
    if (!b) return err(400, "bad_request");
    const r = await verifyLogin(ctx, b.token);
    return r.ok ? json(200, { ok: true, email: r.email }, { "Set-Cookie": sessionCookie(r.session, SESSION_DAYS, ctx.siteUrl) }) : err(400, r.error);
  }
  if (method === "POST" && path === "/logout") {
    await endSession(ctx, cookieOf(request));
    return json(200, { ok: true }, { "Set-Cookie": sessionCookie("", 0, ctx.siteUrl) });
  }

  const session = await getSession(ctx, cookieOf(request));
  if (!session) return err(401, "unauthorized");

  if (method === "GET" && path === "/me") return json(200, { ok: true, ...(await mine(ctx, session)), admin: await isAdmin(ctx, session.email) });

  if (method === "POST" && path === "/admin") {
    const b = await body(request);
    if (!b) return err(400, "bad_request");
    const result = await handleAdmin(ctx, session.email, b, Boolean(env.deployHook), async () => (await deployIfDue(ctx, env.deployHook, env.fetcher, true)) === "sent");
    if (result.ok && (b.action === "review" || b.action === "patch" || b.action === "merge")) publish();
    return json(result.ok ? 200 : result.error === "forbidden" ? 403 : 400, result);
  }

  if (method === "POST" && path === "/images") return upload(request, env, session, url.searchParams.get("kind") === "photo" ? "photo" : "cover");

  if (method === "PUT" && path === "/profile") {
    const b = await body(request);
    const parsed = b ? parseProfile(b) : null;
    if (!parsed) return err(400, "bad_request");
    if (!parsed.ok) return err(422, "invalid", { fields: parsed.errors });
    if (!(await allow(ctx.db, `submit:${session.accountId}`, 30, 3_600_000, ctx.now()))) return err(429, "rate_limited");
    const r = await saveProfile(ctx, session, parsed.value);
    if (r.changed) publish();
    return json(200, { ok: true, ...r });
  }

  if (method === "POST" && path === "/games") return writeGame(request, env, session, null, publish);
  const m = /^\/games\/([a-z0-9]{6,20})(?:\/(full))?$/.exec(path);
  if (m) {
    const id = m[1]!;
    if (method === "PUT" && !m[2]) return writeGame(request, env, session, id, publish);
    if (method === "POST" && m[2] === "full") {
      const b = await body(request);
      if (!b || typeof b.full !== "boolean") return err(400, "bad_request");
      const ok = await setFull(ctx, session, id, b.full);
      if (ok) publish();
      return ok ? json(200, { ok: true }) : err(404, "not_found");
    }
    if (method === "DELETE" && !m[2]) {
      const ok = await removeGame(ctx, session, id);
      if (ok) publish();
      return ok ? json(200, { ok: true }) : err(404, "not_found");
    }
  }

  if (method === "DELETE" && path === "/account") {
    const keys = await eraseAccount(ctx, session);
    after(Promise.all(keys.map((k) => env.images.delete(k))).catch(() => undefined));
    publish();
    return json(200, { ok: true }, { "Set-Cookie": sessionCookie("", 0, ctx.siteUrl) });
  }

  return err(404, "not_found");
}

async function writeGame(request: Request, env: Env, session: Session, id: string | null, publish: () => void): Promise<Response> {
  const { ctx } = env;
  const b = await body(request);
  if (!b) return err(400, "bad_request");
  const parsed = parseGame(b, ctx.now());
  if (!parsed.ok) return err(422, "invalid", { fields: parsed.errors });
  if (!(await allow(ctx.db, `submit:${session.accountId}`, 30, 3_600_000, ctx.now()))) return err(429, "rate_limited");
  const r = await saveGame(ctx, session, id, parsed.value);
  if (!r.ok) return err(r.error === "no_profile" ? 409 : 404, r.error);
  if (r.changed) publish();
  return json(id === null ? 201 : 200, { ok: true, id: r.id, status: r.status, changed: r.changed });
}

async function upload(request: Request, env: Env, session: Session, kind: ImageKind): Promise<Response> {
  const { ctx } = env;
  if (!(await allow(ctx.db, `upload:${session.accountId}`, 20, 3_600_000, ctx.now()))) return err(429, "rate_limited");
  const result = await storeImage(env.images, kind, await request.arrayBuffer());
  return result.ok ? json(201, { ok: true, key: result.key }) : err(result.error === "too_large" ? 413 : 415, result.error);
}

/**
 * The daily job: tidy what expires, back up, erase accounts that have been unused for two years, and rebuild so listings whose time
 * is up leave the site. A failed backup does not stop the rest, but it is recorded, emailed to the owner, and rethrown so the timer
 * Worker shows an error.
 */
export async function daily(env: Env): Promise<void> {
  const ctx = logged(env.ctx);
  await pruneAuth(ctx);
  await pruneRateEvents(ctx.db, ctx.now());
  let failure: unknown = null;
  try {
    await backup(ctx, env.images);
    await metaSet(ctx.db, "backup_ok_at", iso(ctx.now()));
    await metaSet(ctx.db, "backup_error", "");
  } catch (e) {
    failure = e;
    const why = String(e instanceof Error ? e.message : e).slice(0, 200);
    await metaSet(ctx.db, "backup_error", `${iso(ctx.now())}: ${why}`);
    await tellOwner(ctx, "Quest Board TPK: the daily backup failed", `The daily backup did not complete: ${why}\n\nThe site keeps working. Check GET /api/health?key=… and the Worker "quest-board-cron" in the Cloudflare dashboard.`);
  }
  await expireInactive(ctx, async (keys) => { for (const key of keys) await env.images.delete(key); }).catch((e) => logEvent(ctx.db, ctx.now(), "expire_failed", "job", "", "", String(e instanceof Error ? e.message : e).slice(0, 120), "the daily job"));
  await deployIfDue(ctx, env.deployHook, env.fetcher, true);
  if (failure) throw failure;
}
