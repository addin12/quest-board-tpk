/* eslint-disable @typescript-eslint/no-explicit-any */
// The sandbox: the built site plus the REAL backend (worker/src) on a SQLite file and a folder of pictures, so a person can try Quest Board by hand before it
// goes live. It is the browser tests' server (tests/support/test-server.ts) kept for one person instead of thrown away after each test:
//   - the data stays between runs (.sandbox/), real time, one world;
//   - a sign-in mail is not sent anywhere: it lands in the sandbox mailbox, /__sandbox/mail, and its link works, so the real sign-in form can be used;
//   - /__sandbox/ has one-click sign-ins for the demo accounts, a sign-in as any address, and a reset.
// Nothing here can reach the live site: no Cloudflare credentials, no mail relay, no network calls (the deploy hook is answered locally).
// Run it with `npm run sandbox` (scripts/sandbox.mjs builds the site first).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { serveStatic } from "../../scripts/preview.mjs";
import { makeWorld, HELD, OWNER, type memoryBucket } from "./worker-env.ts";
import { loadDemo } from "./demo-data.ts";

const PORT = Number(process.env.PORT ?? 4180);
const ORIGIN = `http://localhost:${PORT}`;
// Shared mode (`npm run sandbox -- --share`): the address other people reach this through (a tunnel). The page then is for guests: no admin sign-in without the key
// printed at start, no reset, no sign-in as an arbitrary address, no mail to the owner in the mailbox. The sandbox still holds nothing real and reaches nothing real.
const PUBLIC = (process.env.SANDBOX_PUBLIC_URL ?? "").replace(/\/$/, "");
const GUEST = PUBLIC !== "";
const ADMIN_KEY = randomBytes(12).toString("hex");
const keyOk = (k: string) => k.length === ADMIN_KEY.length && timingSafeEqual(Buffer.from(k), Buffer.from(ADMIN_KEY));
const DIR = process.env.SANDBOX_DIR ?? path.join(process.cwd(), ".sandbox");
const PICTURES = path.join(DIR, "pictures");

/** The accounts on the switcher page: what each one is for, and where it lands. */
const ACCOUNTS = [
  { email: "sari@example.com", name: "Sari Dewanti", about: "A Game Master with a profile and three games (two with dates, one open-ended).", to: "/en/account/" },
  { email: "baru@example.com", name: "A new Game Master", about: "Signed in but with no profile yet: the first-time form.", to: "/en/account/" },
  { email: "dewi@example.com", name: "Dewi Lestari", about: "A profile and a game held back for a look (the scam check caught some wording).", to: "/en/account/" },
  { email: OWNER, name: "The admin (owner)", about: "Reviews what is held, manages admins, sees the backups and the mail budget.", to: "/en/admin/" },
];

/** A picture store on disk: the file is the key written as one file name, with its type beside it. */
function fileBucket(dir: string): ReturnType<typeof memoryBucket> {
  mkdirSync(dir, { recursive: true });
  const file = (key: string) => path.join(dir, encodeURIComponent(key));
  return {
    put: async (key, value, options) => { writeFileSync(file(key), Buffer.from(value)); writeFileSync(`${file(key)}.type`, options?.httpMetadata?.contentType ?? ""); },
    get: async (key) => {
      if (!existsSync(file(key))) return null;
      const b = readFileSync(file(key));
      return { body: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, httpMetadata: { contentType: existsSync(`${file(key)}.type`) ? readFileSync(`${file(key)}.type`, "utf8") : "" } };
    },
    delete: async (key) => { rmSync(file(key), { force: true }); rmSync(`${file(key)}.type`, { force: true }); },
    list: async ({ prefix }) => ({ objects: readdirSync(dir).filter((n) => !n.endsWith(".type")).map((n) => ({ key: decodeURIComponent(n), uploaded: statSync(path.join(dir, n)).mtime })).filter((o) => o.key.startsWith(prefix)) }),
    keys: () => readdirSync(dir).filter((n) => !n.endsWith(".type")).map(decodeURIComponent),
  };
}

mkdirSync(DIR, { recursive: true });
const dbFile = path.join(DIR, "quest-board.sqlite");
const fresh = !existsSync(dbFile);
const world = makeWorld(Date.now(), { dbFile, bucket: fileBucket(PICTURES) });
// Real time, this address, and a deploy hook that answers at once: publishing needs no site build here, because the pages ask the API for what is live now.
world.env.ctx.now = () => Date.now();
world.env.ctx.siteUrl = GUEST ? PUBLIC : ORIGIN; // the backend accepts writes only from this address, and mail links point at it
world.env.fetcher = (async (url: string) => new Response(String(url).includes("/build.json") ? JSON.stringify({ generatedAt: new Date(Date.now() + 60_000).toISOString() }) : "{}", { status: 200 })) as unknown as typeof fetch;

const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const DESCRIPTION = "Lima penyelidik, satu malam, dan sesuatu yang bergerak di antara pepohonan. A longer description, comfortably over eighty characters.";
const GAME = {
  system: "Call of Cthulhu 7e", summary: "Penyelidikan horor satu malam di kebun raya.", description: DESCRIPTION, format: "one_shot", locationType: "in_person", city: "Depok", cities: ["Depok"],
  venueName: "Kumu Ground Coffee", venueMapsRaw: "", time: "19:00", zone: "WIB", priceIdr: 75000, seats: 5, language: "both", level: "beginner", minAge: 16, genres: ["horror"], styles: [],
  mechanics: [], consent: true, sessionHours: 3, characters: "pregen", needs: [], safetyKeys: ["x-card"], noWarnings: true,
};

/** The demo Game Masters and games the pages were built from, plus the accounts above, made through the real API as people would. */
async function seed() {
  loadDemo(world);
  const sari = await world.signIn("sari@example.com");
  await world.call("PUT", "/profile", { cookie: sari, body: { name: "Sari Dewanti", bio: "Horror GM who runs quiet, slow-burning investigations.", city: "Depok", systems: ["Call of Cthulhu 7e", "Mothership"], whatsapp: "0813-5555-0009", discord: "", instagram: "sari.plays", consent: true } });
  for (const [title, extra] of [["Kabut di Kebun Raya", { date: soon(9) }], ["Rumah di Ujung Gang", { date: soon(23) }], ["Abomination Vaults", { onDemand: true, format: "campaign", date: "" }]] as const) {
    await world.call("POST", "/games", { cookie: sari, body: { ...GAME, title, ...extra } });
  }
  const dewi = await world.signIn("dewi@example.com");
  await world.call("PUT", "/profile", { cookie: dewi, body: { name: "Dewi Lestari", bio: `Horror GM. ${HELD}`, city: "Depok", systems: ["Call of Cthulhu 7e"], whatsapp: "0812-9999-0000", discord: "", instagram: "", consent: true } });
  await world.call("POST", "/games", { cookie: dewi, body: { ...GAME, title: "Naga-naga Hutan Bara", description: `${DESCRIPTION} ${HELD}`, date: soon(14) } });
  await world.signIn(OWNER); // the owner's account exists from the start
  // The seeding is not part of what the sandbox's own counters and limits should show.
  world.mails.length = 0;
  world.hook.length = 0;
  world.db.raw.prepare("DELETE FROM meta WHERE key IN ('dirty', 'lastDeploy')").run();
  world.db.raw.prepare("DELETE FROM rate_events").run();
}

/** Everything back to the demo data: every row deleted, every picture removed, then seeded again. */
async function reset() {
  const raw = world.db.raw;
  raw.exec("PRAGMA foreign_keys = OFF");
  for (const t of raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]) raw.exec(`DELETE FROM "${t.name}"`);
  raw.exec("PRAGMA foreign_keys = ON");
  rmSync(PICTURES, { recursive: true, force: true });
  mkdirSync(PICTURES, { recursive: true });
  await seed();
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const linkify = (s: string) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`);

function page(title: string, body: string, refresh = false): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${refresh ? '<meta http-equiv="refresh" content="6">' : ""}<title>${esc(title)}</title><style>
:root{color-scheme:light dark;--bg:#faf7f0;--ink:#1c1511;--muted:#6b5f55;--rule:#d9d0c2;--card:#fff;--accent:#8f2a21;--accent-ink:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#131010;--ink:#f1ebe0;--muted:#a79d90;--rule:#3a322d;--card:#1d1816;--accent:#e87a68;--accent-ink:#160d0b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
main{max-width:46rem;margin:0 auto;padding:2rem 1rem 4rem}h1{font:600 2rem/1.2 Georgia,serif;margin:0 0 .5rem}h2{font:600 1.15rem/1.3 system-ui;margin:2rem 0 .75rem}
p{margin:.25rem 0}.muted{color:var(--muted)}ul{list-style:none;margin:0;padding:0;display:grid;gap:.75rem}li,.card{background:var(--card);border:1px solid var(--rule);border-radius:8px;padding:1rem}
a.btn,button{display:inline-flex;align-items:center;min-height:44px;padding:0 1rem;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
button.quiet,a.quiet{background:transparent;color:var(--ink);border-color:var(--ink)}label{display:block;font-weight:600;margin-bottom:.35rem}
input{width:100%;min-height:44px;padding:0 .75rem;border:1px solid var(--ink);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit}
.row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between}pre{white-space:pre-wrap;word-break:break-word;margin:.5rem 0 0;font:inherit}a{color:var(--accent)}
</style></head><body><main>${body}</main></body></html>`;
}

function switcher(): string {
  const accounts = ACCOUNTS.filter((a) => !GUEST || a.email !== OWNER).map((a) => `<li><strong>${esc(a.name)}</strong><p class="muted">${esc(a.email)}</p><p>${esc(a.about)}</p><p style="margin-top:.75rem"><a class="btn" href="/__sandbox/enter?email=${encodeURIComponent(a.email)}&amp;to=${encodeURIComponent(a.to)}">Sign in as this</a></p></li>`).join("");
  return page("Quest Board sandbox", `
<h1>Quest Board sandbox</h1>
<p class="muted">${GUEST ? "A practice copy of Quest Board. Nothing here is real: what you add is only for trying the site, and it may be wiped at any time. No email is ever sent; the sign-in links appear in the mailbox below." : "A copy of the site with the real backend, on your computer. Nothing here is sent anywhere: sign-in mails land in the mailbox below, and the data stays between runs."}</p>
<p style="margin-top:1rem" class="row"><a class="btn" href="/en/">Open the site</a><a class="btn quiet" href="/__sandbox/mail">Mailbox (${world.mails.length})</a></p>
<h2>Sign in with one click</h2><ul>${accounts}</ul>
${GUEST ? "" : `<h2>Or any address</h2>
<form class="card" action="/__sandbox/enter" method="get"><label for="e">Email address</label><input id="e" name="email" type="email" required placeholder="someone@example.com"><input type="hidden" name="to" value="/en/account/"><p style="margin-top:.75rem"><button type="submit">Sign in as this address</button></p></form>`}
<p class="muted" style="margin-top:.75rem">To try the real sign-in form instead, type an address at /en/account/, then open the link from the <a href="/__sandbox/mail">mailbox</a>.</p>
${GUEST ? "" : `<h2>Start over</h2>
<form class="card" action="/__sandbox/reset" method="post"><p>Deletes everything made here (accounts, games, pictures) and loads the demo data again.</p><p style="margin-top:.75rem"><button class="quiet" type="submit">Reset the sandbox</button></p></form>`}`);
}

function mailbox(): string {
  const items = [...world.mails].filter((m) => !GUEST || m.to !== OWNER).reverse().map((m) => `<li><p class="muted">To ${esc(m.to)}</p><p><strong>${esc(m.subject)}</strong></p><pre>${linkify(m.body)}</pre></li>`).join("");
  return page("Sandbox mailbox", `<h1>Sandbox mailbox</h1><p class="muted">Every mail the site would have sent, newest first. This page refreshes itself.</p><p style="margin:1rem 0" class="row"><a class="btn quiet" href="/__sandbox/">Back to the sandbox</a><a class="btn quiet" href="/en/">Open the site</a></p>${items ? `<ul>${items}</ul>` : '<p class="card muted">No mail yet.</p>'}`, true);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", ORIGIN);
  const html = (status: number, body: string) => res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" }).end(body);

  res.setHeader("X-Robots-Tag", "noindex, nofollow"); // a practice copy must never be found through a search engine
  if (url.pathname === "/__sandbox" || url.pathname === "/__sandbox/") return html(200, switcher());
  if (url.pathname === "/__sandbox/mail") return html(200, mailbox());
  if (url.pathname === "/__sandbox/enter") {
    const email = url.searchParams.get("email") ?? "";
    const to = url.searchParams.get("to") ?? "/en/account/";
    if (!email.includes("@") || !to.startsWith("/") || to.startsWith("//")) return html(400, page("Not valid", '<h1>Not valid</h1><p><a href="/__sandbox/">Back</a></p>'));
    // Shared: guests may take only the demo accounts; the admin account needs the key printed at start.
    if (GUEST && !ACCOUNTS.some((a) => a.email === email && a.email !== OWNER) && !(email === OWNER && keyOk(url.searchParams.get("key") ?? ""))) return html(403, page("Not allowed", '<h1>Not allowed</h1><p>This copy is shared: only the demo accounts can be signed into with one click. Use the sign-in form and the mailbox for any other address.</p><p><a href="/__sandbox/">Back</a></p>'));
    const before = world.mails.length;
    const cookie = await world.signIn(email);
    world.mails.length = before; // a one-click sign-in leaves no mail behind
    return void res.writeHead(302, { Location: to, "Set-Cookie": `tpk_session=${cookie}; Path=/; HttpOnly; SameSite=Lax` }).end();
  }
  if (url.pathname === "/__sandbox/reset" && req.method === "POST") {
    if (GUEST) return html(403, page("Not allowed", '<h1>Not allowed</h1><p>A shared copy cannot be reset by a visitor.</p><p><a href="/__sandbox/">Back</a></p>'));
    await reset();
    return void res.writeHead(303, { Location: "/__sandbox/" }).end();
  }

  if (url.pathname.startsWith("/api/")) {
    const bodyBuf = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    // Shared: the tunnel (Cloudflare) sets the visitor's real address, so each guest has their own rate limits instead of all sharing 127.0.0.1's.
    if (!GUEST || !headers.has("CF-Connecting-IP")) headers.set("CF-Connecting-IP", "127.0.0.1");
    const pending: Promise<unknown>[] = [];
    const { handle } = await import("../../worker/src/handler.ts");
    const response = await handle(new Request(url, { method: req.method, headers, body: bodyBuf as any }), world.env, (p) => pending.push(p));
    await Promise.all(pending);
    const out: Record<string, string | string[]> = {};
    response.headers.forEach((v, k) => { out[k] = v; });
    const cookie = response.headers.get("set-cookie");
    if (cookie) out["set-cookie"] = [cookie];
    return void res.writeHead(response.status, out).end(Buffer.from(await response.arrayBuffer()));
  }
  serveStatic(req, res);
}

if (fresh) await seed();
createServer((req, res) => {
  route(req, res).catch((e) => { console.error(e); if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain" }); res.end(String(e)); });
}).listen(PORT, "127.0.0.1", () => {
  if (GUEST) console.log(`\nQuest Board sandbox, SHARED\n  give guests:  ${PUBLIC}/__sandbox/\n  you as admin: ${PUBLIC}/__sandbox/enter?email=${encodeURIComponent(OWNER)}&key=${ADMIN_KEY}&to=%2Fen%2Fadmin%2F   (keep this one to yourself)\n  data:         ${DIR}\n  open the site through ${PUBLIC}, not localhost: it accepts requests only from that address while shared\n`);
  else console.log(`\nQuest Board sandbox: ${ORIGIN}/__sandbox/\n  site:    ${ORIGIN}/en/\n  mailbox: ${ORIGIN}/__sandbox/mail\n  data:    ${DIR} (delete the folder, or press Reset, to start over)\n`);
});
