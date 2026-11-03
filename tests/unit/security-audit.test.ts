/* eslint-disable @typescript-eslint/no-explicit-any */
// Regression tests for the security audit of 2026-11-03 (docs/security-audit.md): one test per defect that was found and fixed.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { handle } from "../../worker/src/handler.ts";
import { sweepOrphanImages } from "../../worker/src/images.ts";
import { LOGIN_MAILS_PER_DAY } from "../../worker/src/auth.ts";
import { MAX_GAMES_PER_PROFILE } from "../../worker/src/store.ts";
import { parseProfile } from "../../worker/src/rules.ts";
import { DAY_MS, allow } from "../../worker/src/util.ts";
import { GAME, OWNER, PROFILE, WEBP, makeWorld } from "../support/worker-env.ts";

type World = ReturnType<typeof makeWorld>;
const admin = (w: World, cookie: string, body: Record<string, unknown>) => w.call("POST", "/admin", { cookie, body });
const count = (w: World, sql: string, ...v: unknown[]) => (w.db.raw.prepare(sql).get(...(v as never[])) as { n: number }).n;

/** A sign-in request that arrives from a chosen IP address (the fixture's `call` has no way to set one). */
const askFrom = (w: World, ip: string, email: string) =>
  handle(new Request(`${w.env.ctx.siteUrl}/api/login/request`, { method: "POST", headers: { Origin: w.env.ctx.siteUrl, "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify({ email }) }), w.env);

test("GET /me never shows a Game Master the admins' private note or who reviewed", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  const owner = await w.signIn(OWNER);
  await admin(w, owner, { action: "patch", kind: "game", id, adminNote: "looks like a scam" });
  await admin(w, owner, { action: "review", kind: "game", ids: [id], status: "rejected", reason: "date" });
  const me = (await w.call("GET", "/me", { cookie: gm })).json;
  assert.equal(me.games[0].adminNote, "");
  assert.equal(me.games[0].reviewedBy, "");
  assert.equal(me.games[0].rejectReason, "date", "the reason is written for the GM and stays");
  assert.equal((await admin(w, owner, { action: "queue" })).json.games[0].adminNote, "looks like a scam", "admins still see it");
});

test("a sign-in request refused for its IP does not use up the named address's hourly slots", async () => {
  const w = makeWorld();
  for (let i = 0; i < 20; i++) assert.equal((await askFrom(w, "9.9.9.9", `bystander${i}@example.com`)).status, 200);
  assert.equal((await askFrom(w, "9.9.9.9", "victim@example.com")).status, 429, "the 21st from that IP is refused");
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM rate_events WHERE key = 'login:email:victim@example.com'"), 0, "and costs the victim nothing");
  for (let i = 0; i < 5; i++) assert.equal((await askFrom(w, `8.8.8.${i}`, "victim@example.com")).status, 200, "the victim can still ask from elsewhere");
});

test("sign-in mails have a daily cap of their own, so decision mails and owner alerts keep part of the relay's quota", async () => {
  const w = makeWorld();
  for (let i = 0; i < LOGIN_MAILS_PER_DAY; i++) assert.equal((await askFrom(w, `7.7.${Math.floor(i / 20)}.${i % 20}`, `person${i}@example.com`)).status, 200);
  assert.equal((await askFrom(w, "6.6.6.6", "one-more@example.com")).status, 429);
  assert.ok(LOGIN_MAILS_PER_DAY <= 60, "the relay sends 90 a day");
  w.clock.ms += DAY_MS + 1000;
  assert.equal((await askFrom(w, "6.6.6.6", "one-more@example.com")).status, 200, "and the cap resets after a day");
});

test("requests that arrive together cannot all pass a rate limit", async () => {
  const w = makeWorld();
  const results = await Promise.all(Array.from({ length: 12 }, () => allow(w.db, "burst", 3, 60_000, w.clock.ms)));
  assert.equal(results.filter(Boolean).length, 3);
});

test("only the owner removes an admin, whatever the address's spelling", async () => {
  const w = makeWorld();
  const owner = await w.signIn(OWNER);
  await admin(w, owner, { action: "admin.add", email: "one@gmail.com" });
  await admin(w, owner, { action: "admin.add", email: "two@example.com" });
  const one = await w.signIn("one@gmail.com");
  const refused = await admin(w, one, { action: "admin.remove", email: "two@example.com" });
  assert.equal(refused.status, 403);
  assert.equal(refused.json.message, "owner_only");
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM admins"), 2);
  assert.equal((await admin(w, owner, { action: "admin.remove", email: "O.n.e@Gmail.com" })).status, 200, "a Gmail address is found however it is typed");
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM admins"), 1);
});

test("a merge never touches an owner or admin account, follows chains, and tells the person it was merged into", async () => {
  const w = makeWorld();
  const mk = async (email: string, name: string, phone: string) => {
    const cookie = await w.signIn(email);
    await w.call("PUT", "/profile", { cookie, body: { ...PROFILE, name, whatsapp: phone } });
    return cookie;
  };
  await mk("a@example.com", "Alpha GM", "081200000001");
  await mk("b@example.com", "Beta GM", "081200000002");
  await mk("c@example.com", "Gamma GM", "081200000003");
  const helper = await mk("helper@example.com", "Helper GM", "081200000004");
  const owner = await w.signIn(OWNER);
  await admin(w, owner, { action: "admin.add", email: "helper@example.com" });
  const queue = async () => (await admin(w, owner, { action: "queue" })).json.gms as any[];
  const id = async (name: string) => (await queue()).find((g) => g.name === name).id as string;

  const refused = await admin(w, owner, { action: "merge", fromId: await id("Helper GM"), intoId: await id("Alpha GM") });
  assert.equal(refused.status, 403, "an admin's profile cannot be merged away");
  assert.equal((await admin(w, owner, { action: "merge", fromId: await id("Alpha GM"), intoId: await id("Helper GM") })).status, 403, "or merged into");
  void helper;

  const before = w.mails.length;
  assert.equal((await admin(w, owner, { action: "merge", fromId: await id("Alpha GM"), intoId: await id("Beta GM") })).status, 200);
  assert.equal(w.mails.length, before + 1);
  assert.equal(w.mails[before]!.to, "b@example.com", "the account that absorbed an address is told");
  assert.match(w.mails[before]!.body, /a@example\.com/);
  assert.equal((await admin(w, owner, { action: "merge", fromId: await id("Beta GM"), intoId: await id("Gamma GM") })).status, 200);
  const viaA = await w.signIn("a@example.com");
  assert.equal((await w.call("GET", "/me", { cookie: viaA })).json.profile.name, "Gamma GM", "the first address follows the chain to the last account");
});

test("erasing an account that others were merged into works, and leaves no name or address in the activity log or the bucket", async () => {
  const w = makeWorld();
  const real = await w.signIn("raka@example.com");
  const photo = (await w.call("POST", "/images?kind=photo", { cookie: real, raw: WEBP })).json.key as string;
  await w.call("PUT", "/profile", { cookie: real, body: { ...PROFILE, photoKey: photo } });
  const dup = await w.signIn("raka.second@example.com");
  await w.call("PUT", "/profile", { cookie: dup, body: { ...PROFILE, name: "Raka Duplicate" } });
  const owner = await w.signIn(OWNER);
  const gms = (await admin(w, owner, { action: "queue" })).json.gms as any[];
  await admin(w, owner, { action: "merge", fromId: gms.find((g) => g.name === "Raka Duplicate").id, intoId: gms.find((g) => g.name === "Raka Pratama").id });

  assert.equal((await w.call("DELETE", "/account", { cookie: real })).status, 200);
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM accounts WHERE email LIKE 'raka%'"), 0, "both addresses are gone");
  assert.equal(w.bucket.keys().includes(photo), false, "and the picture");
  const traces = count(w, "SELECT COUNT(*) AS n FROM activity WHERE title LIKE '%Raka%' OR detail LIKE '%Raka%' OR detail LIKE '%raka%' OR actor LIKE '%raka%'");
  assert.equal(traces, 0, "the log keeps that it happened, not who");
});

test("a replaced picture is deleted at once, and the daily sweep removes abandoned uploads but not new ones or used ones", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  const first = (await w.call("POST", "/images?kind=photo", { cookie: gm, raw: WEBP })).json.key as string;
  await w.call("PUT", "/profile", { cookie: gm, body: { ...PROFILE, photoKey: first } });
  const second = (await w.call("POST", "/images?kind=photo", { cookie: gm, raw: WEBP })).json.key as string;
  await w.call("PUT", "/profile", { cookie: gm, body: { ...PROFILE, photoKey: second } });
  assert.deepEqual(w.bucket.keys().sort(), [second], "the first photo went when the second replaced it");

  const abandoned = (await w.call("POST", "/images?kind=cover", { cookie: gm, raw: WEBP })).json.key as string;
  assert.equal(await sweepOrphanImages(w.env.ctx, w.bucket), 0, "a fresh upload may still be about to be saved");
  w.clock.ms += 3 * DAY_MS;
  assert.equal(await sweepOrphanImages(w.env.ctx, w.bucket), 1);
  assert.equal(w.bucket.keys().includes(abandoned), false);
  assert.equal(w.bucket.keys().includes(second), true, "a picture in use stays");
});

test("an approval applies only to the version the admin saw", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  const owner = await w.signIn(OWNER);
  const seen = (await admin(w, owner, { action: "queue" })).json.games[0].updatedAt as string;
  assert.ok(seen);
  w.clock.ms += 60_000;
  await w.call("PUT", `/games/${id}`, { cookie: gm, body: { ...GAME, description: "A different game entirely." } });
  const late = await admin(w, owner, { action: "review", kind: "game", ids: [id], status: "approved", seen: { [id]: seen } });
  assert.deepEqual(late.json.stale, [id]);
  assert.deepEqual(late.json.updated, []);
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM games WHERE status = 'approved'"), 0, "nothing was approved");
  const fresh = (await admin(w, owner, { action: "queue" })).json.games[0].updatedAt as string;
  const ok = await admin(w, owner, { action: "review", kind: "game", ids: [id], status: "approved", seen: { [id]: fresh } });
  assert.deepEqual(ok.json.updated, [id]);
});

test("marking a game full shares the write limit, and a profile has a limit on games", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  let refused = 0;
  for (let i = 0; i < 35; i++) if ((await w.call("POST", `/games/${id}/full`, { cookie: gm, body: { full: i % 2 === 0 } })).status === 429) refused++;
  assert.ok(refused >= 4, "flipping the badge over and over is stopped");

  w.clock.ms += 2 * 3_600_000;
  let last = 0;
  for (let i = 1; i < MAX_GAMES_PER_PROFILE + 1; i++) {
    if (i % 25 === 0) w.clock.ms += 2 * 3_600_000; // stay under the hourly write limit
    last = (await w.call("POST", "/games", { cookie: gm, body: { ...GAME, title: `Game ${i}` } })).status;
  }
  assert.equal(last, 409, "the 31st open game is refused");
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM games WHERE removed = 0"), MAX_GAMES_PER_PROFILE);
});

test("a huge list in a profile costs no more than a small one, and a profile lists a few others sharing its number, not all", async () => {
  const started = performance.now();
  const parsed = parseProfile({ ...PROFILE, systems: Array.from({ length: 200_000 }, (_, i) => `System ${i % 50}`) });
  assert.ok(performance.now() - started < 250, "no quadratic de-duplication");
  assert.ok(parsed.ok && parsed.value.systems.length <= 10);
  assert.equal(parseProfile({ ...PROFILE, systems: ["A", "a", "A", " ", "B"] }).ok, true);

  const w = makeWorld();
  for (let i = 0; i < 9; i++) {
    const cookie = await w.signIn(`same${i}@example.com`);
    await w.call("PUT", "/profile", { cookie, body: { ...PROFILE, name: `Same Number ${i}` } });
  }
  const owner = await w.signIn(OWNER);
  const gms = (await admin(w, owner, { action: "queue" })).json.gms as any[];
  assert.ok(gms.every((g) => g.sharesPhoneWith.length <= 5));
});

test("the picture lookup for an unknown key uses an index, not a scan of both tables", () => {
  const w = makeWorld();
  const plan = (sql: string) => (w.db.raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all("x") as { detail: string }[]).map((r) => r.detail).join(" ");
  assert.match(plan("SELECT 1 FROM profiles WHERE photo_key = ?"), /USING (COVERING )?INDEX/);
  assert.match(plan("SELECT 1 FROM games WHERE cover_key = ?"), /USING (COVERING )?INDEX/);
});

test("no tracked text file holds a live-looking Apps Script id (they belong in the git-ignored local file and the Pages secrets)", () => {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", cwd: new URL("../..", import.meta.url) }).split("\0").filter((f) => /\.(ts|tsx|mjs|js|json|md|toml|yml|yaml|html|gs|txt)$/.test(f) && !f.startsWith("public/") && f !== "package-lock.json");
  const found: string[] = [];
  for (const f of files) {
    const path = new URL(`../../${f}`, import.meta.url);
    let size = 0;
    try { size = statSync(path).size; } catch { continue; } // deleted but not yet committed
    if (size > 1_000_000) continue;
    const text = readFileSync(path, "utf8");
    if (/AKfycb[A-Za-z0-9_-]{40,}/.test(text) || /["'`]1[A-Za-z0-9_-]{55,}["'`]/.test(text)) found.push(f);
  }
  assert.deepEqual(found, []);
});
