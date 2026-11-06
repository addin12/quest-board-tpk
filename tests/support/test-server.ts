/* eslint-disable @typescript-eslint/no-explicit-any */
// The server the browser tests run against: the built site (out/, served like Cloudflare Pages) and, under /api, the REAL backend
// (worker/src) on an in-memory SQLite database, an in-memory bucket and a mailer that records what it sends. Nothing is stubbed in
// the page: it makes the same calls it makes on the live site.
//
// Every test gets its own "world" (database, bucket, mailbox, clock): POST /__test/new returns an id, and the test puts it in the
// `tpk_world` cookie, so tests running side by side never see each other's data. The other /__test/* calls read and change the world:
//   GET  /__test/state            { mails, hooks, dirty, lastDeploy }
//   POST /__test/seed             demo accounts, profiles and games (see seed())
//   POST /__test/demo             the demo data the static pages were built from (data/sample.json), as live rows: the pages ask the API for what is true now
//   POST /__test/sql {sql, args}  runs SQL on the world's database (to plant a state the API itself would refuse)
//   POST /__test/clock {ms}       moves the world's clock
//   POST /__test/session {email}  a session cookie for that email without the mail round trip
//   GET  /__test/enter?email=&to=  for trying the site by hand: signs the browser in as that address (no mail, no link that expires) and goes on to `to`
import { readFileSync } from "node:fs";
import path from "node:path";
import { createServer, type IncomingMessage } from "node:http";
import { serveStatic } from "../../scripts/preview.mjs";
import sharp from "sharp";
import { makeWorld, GAME, PROFILE, OWNER } from "./worker-env.ts";

const PORT = Number(process.env.PORT ?? 4174);
const ORIGIN = `http://localhost:${PORT}`;

type World = ReturnType<typeof makeWorld>;
const worlds = new Map<string, World>();
let counter = 0;

function newWorld(): string {
  const id = `w${++counter}`;
  const w = makeWorld(Date.now());
  w.env.ctx.siteUrl = ORIGIN;
  worlds.set(id, w);
  return id;
}

const cookieOf = (req: IncomingMessage, name: string) => new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie ?? "")?.[1] ?? "";

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

const DESCRIPTION = "A longer description of the game that is comfortably more than eighty characters, so that no check complains about it.";

/**
 * Accounts, profiles and games made through the real API, as GMs would: Raka (approved profile, one approved game, Mercusuar and
 * Neon Run waiting, Panen Harapan approved), Dewi (a profile waiting, one game waiting), and admin@example.com as an admin.
 */
/**
 * The demo data (data/sample.json) as live rows of the world's database, with the ids, slugs and dates the static pages were built from
 * (src/generated/data.json, dates already moved to the present) and the phone numbers from the sample (they are not in the built data), so a page that
 * asks /api/live and /api/contact gets the same Game Masters and games it was built with.
 */
function loadDemo(w: World) {
  const built = JSON.parse(readFileSync(path.join(process.cwd(), "src", "generated", "data.json"), "utf8"));
  const sample = JSON.parse(readFileSync(path.join(process.cwd(), "data", "sample.json"), "utf8"));
  const phones = new Map<string, string>(sample.gms.map((g: any) => [g.id, g.whatsapp]));
  const at = new Date(w.clock.ms).toISOString();
  const db = w.db.raw;
  for (const gm of built.gms) {
    db.prepare("INSERT INTO accounts (id, email, created_at) VALUES (?, ?, ?)").run(`acc-${gm.id}`, `${gm.id}@demo.example`, at);
    db.prepare("INSERT INTO profiles (id, account_id, slug, name, bio, city, systems, whatsapp, discord, instagram, photo_key, consent, status, was_live, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'approved', 1, ?, ?)")
      .run(gm.id, `acc-${gm.id}`, gm.slug, gm.name, gm.bio, gm.city, JSON.stringify(gm.systems), phones.get(gm.id) ?? "", gm.discord, gm.instagram, gm.photoKey ?? "", gm.joinedAt || at, at);
  }
  for (const g of built.games) {
    db.prepare("INSERT INTO games (id, profile_id, slug, title, system, summary, description, format, location_type, platform, city, venue_name, venue_maps_raw, starts_at, zone, schedule_note, expires_at, price_idr, seats, language, level, min_age, content_warnings, safety_tools, genres, styles, mechanics, cover_key, session_hours, characters, needs, safety_keys, no_warnings, consent, status, full, was_live, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'approved', ?, 1, ?, ?)")
      .run(g.id, g.gmId, g.slug, g.title, g.system, g.summary, g.description, g.format, g.locationType, g.platform, g.city, g.venueName, g.venueMapsUrl, g.startsAt, g.zone, g.scheduleNote, g.expiresAt, g.priceIdr, g.seats, g.language, g.level, g.minAge, g.contentWarnings, g.safetyTools, JSON.stringify(g.genres), JSON.stringify(g.styles), JSON.stringify(g.mechanics), g.coverKey ?? "", g.sessionHours, g.characters, JSON.stringify(g.needs), JSON.stringify(g.safetyKeys), g.noWarnings ? 1 : 0, g.full ? 1 : 0, at, at);
    db.prepare("UPDATE games SET cities = ?, on_demand = ? WHERE id = ?").run(JSON.stringify(g.cities ?? []), g.onDemand ? 1 : 0, g.id);
  }
}

async function seed(w: World) {
  const { call, signIn } = w;
  const raka = await signIn("raka@example.com");
  await call("PUT", "/profile", { cookie: raka, body: PROFILE });
  const mk = (cookie: string, patch: object) => call("POST", "/games", { cookie, body: { ...GAME, description: DESCRIPTION, ...patch } });
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const picture = await sharp({ create: { width: 80, height: 100, channels: 3, background: { r: 90, g: 50, b: 40 } } }).webp().toBuffer();
  const cover = await call("POST", "/images?kind=cover", { cookie: raka, raw: picture.buffer.slice(picture.byteOffset, picture.byteOffset + picture.byteLength) as ArrayBuffer, type: "image/webp" });
  await mk(raka, { title: "Mercusuar di Pulau Kabut", date: day(10), coverKey: cover.json.key });
  await mk(raka, { title: "Neon Run", date: day(11), description: "Send me your OTP first, then pay the admin fee to my new account to join. ".repeat(3) });
  await mk(raka, { title: "Date Unknown", date: day(12) });
  await mk(raka, { title: "Panen Harapan", date: day(13) });
  const dewi = await signIn("dewi@example.com");
  await call("PUT", "/profile", { cookie: dewi, body: { ...PROFILE, name: "Dewi Lestari", whatsapp: "0812-9999-0000", discord: "", instagram: "" } });
  await mk(dewi, { title: "Naga-naga Hutan Bara", date: day(14) });

  const owner = await signIn(OWNER);
  await call("POST", "/admin", { cookie: owner, body: { action: "admin.add", email: "admin@example.com" } });
  const queue = (await call("POST", "/admin", { cookie: owner, body: { action: "queue" } })).json;
  const id = (title: string) => queue.games.find((g: any) => g.title === title).id as string;
  const rakaId = queue.gms.find((g: any) => g.name === "Raka Pratama").id as string;
  await call("POST", "/admin", { cookie: owner, body: { action: "review", kind: "gm", ids: [rakaId], status: "approved" } });
  await call("POST", "/admin", { cookie: owner, body: { action: "review", kind: "game", ids: [id("Panen Harapan")], status: "approved" } });
  // What a Game Master saves is live at once now (ADR-48); the browser tests of the admin page and the account page want things waiting for a look, so these
  // rows are put into the held state the way the scam check would leave them: Mercusuar, Date Unknown, Neon Run, and Dewi's profile and game.
  w.db.raw.prepare("UPDATE games SET status = 'pending', was_live = 0 WHERE title IN ('Mercusuar di Pulau Kabut', 'Neon Run', 'Date Unknown', 'Naga-naga Hutan Bara')").run();
  w.db.raw.prepare("UPDATE profiles SET status = 'pending', was_live = 0 WHERE name = 'Dewi Lestari'").run();
  // The API refuses a game with no date; a row that arrived broken (an old edit, a hand edit) must still be shown and blocked.
  w.db.raw.prepare("UPDATE games SET starts_at = '' WHERE title = 'Date Unknown'").run();
  // The seeding itself is not part of what a test measures.
  w.hook.length = 0;
  w.mails.length = 0;
  w.db.raw.prepare("DELETE FROM meta WHERE key IN ('dirty', 'lastDeploy')").run();
  w.db.raw.prepare("DELETE FROM rate_events").run();
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", ORIGIN);
  const send = (status: number, body: unknown) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
  try {
    if (url.pathname === "/__test/new") return send(200, { id: newWorld() });
    const world = worlds.get(cookieOf(req, "tpk_world")) ?? worlds.get([...worlds.keys()].at(-1) ?? "");

    if (url.pathname.startsWith("/__test/")) {
      if (!world) return send(400, { error: "no_world" });
      const body = req.method === "POST" ? JSON.parse((await readBody(req)).toString() || "{}") : {};
      const sql = (q: string) => world.db.raw.prepare(q);
      switch (url.pathname) {
        case "/__test/state":
          return send(200, { mails: world.mails, hooks: world.hook.length, dirty: Boolean((sql("SELECT value FROM meta WHERE key = 'dirty'").get() as any)?.value), lastDeploy: (sql("SELECT value FROM meta WHERE key = 'lastDeploy'").get() as any)?.value ?? "" });
        case "/__test/seed": await seed(world); return send(200, { ok: true });
        case "/__test/demo": loadDemo(world); return send(200, { ok: true });
        case "/__test/sql": return send(200, { rows: sql(String(body.sql)).all(...(body.args ?? [])) });
        case "/__test/exec": sql(String(body.sql)).run(...(body.args ?? [])); return send(200, { ok: true });
        case "/__test/clock": world.clock.ms = Number(body.ms); return send(200, { ok: true });
        case "/__test/hook": world.env.deployHook = body.on ? "https://hook.example/deploy" : ""; return send(200, { ok: true });
        // For a person trying the site by hand: opening /__test/enter?email=gm@example.com&to=/en/account/ signs the browser in as that address (no mail, no
        // link that expires) and goes on to `to`. owner@example.com is the site's owner and an admin.
        case "/__test/enter": {
          const email = url.searchParams.get("email") ?? "";
          const to = url.searchParams.get("to") ?? "/en/";
          if (!email.includes("@") || !to.startsWith("/") || to.startsWith("//")) return send(400, { error: "bad_request" });
          const mailsBefore = world.mails.length;
          const cookie = await world.signIn(email);
          world.mails.length = mailsBefore;
          const worldId = [...worlds].find(([, w]) => w === world)?.[0] ?? "";
          res.writeHead(302, { Location: to, "Set-Cookie": [`tpk_session=${cookie}; Path=/; HttpOnly; SameSite=Lax`, `tpk_world=${worldId}; Path=/; SameSite=Lax`] }).end();
          return;
        }
        case "/__test/session": {
          const mailsBefore = world.mails.length; // the sign-in mail is not part of what a test measures
          const cookie = await world.signIn(String(body.email));
          world.mails.length = mailsBefore;
          return send(200, { cookie });
        }
        default: return send(404, { error: "unknown" });
      }
    }

    if (url.pathname.startsWith("/api/")) {
      if (!world) return send(400, { error: "no_world" });
      const bodyBuf = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      headers.set("CF-Connecting-IP", "127.0.0.1");
      const pending: Promise<unknown>[] = [];
      const { handle } = await import("../../worker/src/handler.ts");
      const response = await handle(new Request(url, { method: req.method, headers, body: bodyBuf as any }), world.env, (p) => pending.push(p));
      await Promise.all(pending);
      const out: Record<string, string | string[]> = {};
      response.headers.forEach((v, k) => { out[k] = v; });
      const cookie = response.headers.get("set-cookie");
      if (cookie) out["set-cookie"] = [cookie];
      res.writeHead(response.status, out).end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    serveStatic(req, res);
  } catch (e) {
    console.error(e);
    send(500, { error: String(e) });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Quest Board test server: ${ORIGIN}`));
