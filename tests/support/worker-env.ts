/* eslint-disable @typescript-eslint/no-explicit-any */
// The backend (worker/src) wired to Node's built-in SQLite, an in-memory bucket and a mailer that records its mails,
// so the tests run the real code, the real migration and the real HTTP handler without Cloudflare.
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import type { Bucket, Db, Stmt } from "../../worker/src/db.ts";
import type { Mail, Mailer } from "../../worker/src/email.ts";
import { handle, type Env } from "../../worker/src/handler.ts";

const MIGRATIONS = new URL("../../worker/migrations/", import.meta.url);
/** Every migration, in order: the tests run the schema exactly as the live database has it. */
const MIGRATION = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(new URL(f, MIGRATIONS), "utf8")).join("\n");

export function sqliteDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  raw.exec(MIGRATION);
  const stmt = (sql: string, values: unknown[] = []): Stmt => ({
    bind: (...v) => stmt(sql, v),
    first: async <T>() => ((raw.prepare(sql).get(...(values as never[])) as T | undefined) ?? null),
    all: async <T>() => ({ results: raw.prepare(sql).all(...(values as never[])) as T[] }),
    run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...(values as never[])).changes) } }),
  });
  return {
    raw,
    prepare: (sql) => stmt(sql),
    batch: async (statements) => {
      raw.exec("BEGIN");
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        raw.exec("COMMIT");
        return out;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

export function memoryBucket(): Bucket & { keys(): string[] } {
  const files = new Map<string, { data: ArrayBuffer; type: string }>();
  return {
    put: async (key, value, options) => { files.set(key, { data: value, type: options?.httpMetadata?.contentType ?? "" }); },
    get: async (key) => { const f = files.get(key); return f ? { body: f.data, httpMetadata: { contentType: f.type } } : null; },
    delete: async (key) => { files.delete(key); },
    list: async ({ prefix }) => ({ objects: [...files.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
    keys: () => [...files.keys()],
  };
}

export const SITE = "https://board.example";
export const OWNER = "owner@example.com";
export const BUILD_KEY = "build-key-for-tests";

export function makeWorld(startMs = Date.parse("2026-10-28T03:00:00Z")) {
  const db = sqliteDb();
  const mails: Mail[] = [];
  const mailer: Mailer = { send: async (m) => { mails.push(m); } };
  const bucket = memoryBucket();
  const hook: string[] = [];
  const clock = { ms: startMs };
  const env: Env = {
    ctx: { db, mailer, now: () => clock.ms, siteUrl: SITE, owner: OWNER },
    images: bucket,
    buildKey: BUILD_KEY,
    deployHook: "https://hook.example/deploy",
    turnstileSecret: "",
    fetcher: (async (url: string) => { hook.push(String(url)); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch,
  };

  const pending: Promise<unknown>[] = [];
  /** One API call as a browser on the site would make it; `cookie` is the session cookie value. */
  async function call(method: string, path: string, init: { body?: unknown; cookie?: string; origin?: string | null; raw?: ArrayBuffer; type?: string } = {}) {
    const headers: Record<string, string> = {};
    if (init.origin !== null) headers.Origin = init.origin ?? env.ctx.siteUrl;
    if (init.cookie) headers.Cookie = `tpk_session=${init.cookie}`;
    let body: BodyInit | undefined;
    if (init.raw) { body = init.raw; headers["Content-Type"] = init.type ?? "image/webp"; }
    else if (init.body !== undefined) { body = JSON.stringify(init.body); headers["Content-Type"] = "application/json"; }
    const res = await handle(new Request(`${env.ctx.siteUrl}/api${path}`, { method, headers, body }), env, (p) => pending.push(p));
    await Promise.all(pending.splice(0));
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* an image */ }
    return { status: res.status, json, res, text };
  }

  /** Signs in as `email`: asks for a link, reads the token out of the mail, opens it. Returns the session cookie value. */
  async function signIn(email: string): Promise<string> {
    const before = mails.length;
    const asked = await call("POST", "/login/request", { body: { email } });
    if (asked.status !== 200) throw new Error(`login request failed: ${asked.status} ${asked.text}`);
    const token = /#t=([A-Za-z0-9_-]+)/.exec(mails[before]!.body)![1]!;
    const verified = await call("POST", "/login/verify", { body: { token } });
    return /tpk_session=([A-Za-z0-9_-]+)/.exec(verified.res.headers.get("Set-Cookie") ?? "")![1]!;
  }

  return { db, mails, bucket, hook, clock, env, call, signIn };
}

export const PROFILE = { name: "Raka Pratama", bio: "Horror GM.", city: "Depok", systems: "Call of Cthulhu, Mothership", whatsapp: "0812-3456-7890", discord: "raka_gm", consent: true };

export const GAME = {
  title: "Mercusuar di Pulau Kabut", system: "Call of Cthulhu", summary: "The lighthouse keeper stopped answering the radio.", description: "A classic Call of Cthulhu investigation for three to five players.",
  format: "one_shot", locationType: "in_person", city: "Depok", venueName: "Kumu Ground Coffee", venueMapsRaw: "https://maps.app.goo.gl/abc123", date: "2026-11-08", time: "19:00", zone: "WIB",
  priceIdr: 75000, seats: 5, language: "both", level: "beginner", minAge: 16, genres: ["horror"], styles: ["roleplay-heavy"], consent: true,
};

/** A few bytes that pass for a WebP file. */
export const WEBP = (() => { const b = new Uint8Array(64); b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); return b.buffer; })();
