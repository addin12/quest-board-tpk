/* eslint-disable @typescript-eslint/no-explicit-any */
// The Cloudflare backend (worker/src): accounts, one profile per account, games, review, self-service, images, builds.
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeEmail } from "../../worker/src/email.ts";
import { parseGame, parseProfile, normalizePhone, zonedInstant } from "../../worker/src/rules.ts";
import { deployIfDue, MIN_GAP_MS } from "../../worker/src/deploy.ts";
import { parsePublicData } from "../../src/lib/public-data.ts";
import { BUILD_KEY, GAME, OWNER, PROFILE, WEBP, makeWorld } from "../support/worker-env.ts";

test("an email is one account however it is typed: case, Gmail dots and +tags, googlemail", () => {
  assert.equal(normalizeEmail("  Raka.Pratama+games@Gmail.com "), "rakapratama@gmail.com");
  assert.equal(normalizeEmail("a.b@googlemail.com"), "ab@gmail.com");
  assert.equal(normalizeEmail("Dots.Stay@example.com"), "dots.stay@example.com", "only Gmail ignores dots");
  assert.equal(normalizeEmail("not an email"), "");
  assert.equal(normalizeEmail(42), "");
});

test("phones and dates are normalised at the edge", () => {
  assert.equal(normalizePhone("0812-3456-7890"), "6281234567890");
  assert.equal(normalizePhone("+62 812 3456 7890"), "6281234567890");
  assert.equal(normalizePhone("123"), "");
  assert.equal(zonedInstant("2026-11-08", "19:00", "WIB"), "2026-11-08T12:00:00.000Z");
  assert.equal(zonedInstant("2026-11-08", "19:00", "WITA"), "2026-11-08T11:00:00.000Z");
  assert.equal(zonedInstant("2026-02-30", "19:00", "WIB"), null);
  assert.equal(zonedInstant("2026-11-08", "25:00", "WIB"), null);
});

test("a game must fit Jabodetabek and online, and its short description 80 characters", () => {
  const now = Date.parse("2026-10-28T03:00:00Z");
  assert.equal(parseGame(GAME, now).ok, true);
  const bad = (patch: object) => { const r = parseGame({ ...GAME, ...patch }, now); return r.ok ? {} : r.errors; };
  assert.equal(bad({ city: "Surabaya" }).city, "choose_one");
  assert.equal(bad({ locationType: "online", city: "" }).city, undefined, "an online game needs no city");
  assert.equal(bad({ summary: "x".repeat(81) }).summary, "too_long");
  assert.equal(bad({ seats: 0 }).seats, "invalid_number");
  assert.equal(bad({ genres: ["horror", "sci-fi", "mystery", "cozy"] }).genres, "invalid");
  assert.equal(bad({ genres: ["not-a-genre"] }).genres, "invalid");
  assert.equal(bad({ venueMapsRaw: "https://evil.example" }).venueMapsRaw, "invalid_link");
  assert.equal(bad({ date: "2026-10-01" }).date, "in_the_past");
  assert.equal(bad({ consent: false }).consent, "required");
  assert.equal(bad({ coverKey: "../../etc/passwd" }).coverKey, "invalid");
  assert.equal(parseProfile({ ...PROFILE, city: "Medan" }).ok, false);
  assert.equal(parseProfile({ ...PROFILE, city: "Online only" }).ok, true);
});

test("signing in: a link works once, expires, and never says who has an account", async () => {
  const w = makeWorld();
  const before = w.mails.length;
  assert.equal((await w.call("POST", "/login/request", { body: { email: "Nobody@Example.com" } })).status, 200);
  assert.equal(w.mails.length, before + 1);
  assert.match(w.mails[before]!.body, /expires in 15 minutes/);
  const token = /#t=([A-Za-z0-9_-]+)/.exec(w.mails[before]!.body)![1]!;
  assert.equal((await w.call("POST", "/login/verify", { body: { token: "x".repeat(30) } })).status, 400, "a made-up token");
  const ok = await w.call("POST", "/login/verify", { body: { token } });
  assert.equal(ok.status, 200);
  assert.match(ok.res.headers.get("Set-Cookie")!, /HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await w.call("POST", "/login/verify", { body: { token } })).status, 400, "the second use of a link");

  await w.call("POST", "/login/request", { body: { email: "late@example.com" } });
  const late = /#t=([A-Za-z0-9_-]+)/.exec(w.mails.at(-1)!.body)![1]!;
  w.clock.ms += 16 * 60_000;
  assert.equal((await w.call("POST", "/login/verify", { body: { token: late } })).status, 400, "after 15 minutes");
  assert.equal((await w.call("POST", "/login/request", { body: { email: "nope" } })).status, 400);
});

test("sign-in requests are limited per address", async () => {
  const w = makeWorld();
  for (let i = 0; i < 5; i++) assert.equal((await w.call("POST", "/login/request", { body: { email: "spam@example.com" } })).status, 200);
  assert.equal((await w.call("POST", "/login/request", { body: { email: "spam@example.com" } })).status, 429);
  assert.equal((await w.call("POST", "/login/request", { body: { email: "other@example.com" } })).status, 200);
});

test("writes need the site's own Origin and a session", async () => {
  const w = makeWorld();
  assert.equal((await w.call("POST", "/login/request", { body: { email: "a@example.com" }, origin: "https://evil.example" })).status, 403);
  assert.equal((await w.call("POST", "/login/request", { body: { email: "a@example.com" }, origin: null })).status, 403);
  assert.equal((await w.call("GET", "/me")).status, 401);
  assert.equal((await w.call("PUT", "/profile", { body: PROFILE })).status, 401);
});

test("one account has one profile and any number of games, however the email is typed", async () => {
  const w = makeWorld();
  const a = await w.signIn("raka.pratama@gmail.com");
  assert.equal((await w.call("POST", "/games", { cookie: a, body: GAME })).status, 409, "a game needs a profile first");
  const bad = await w.call("PUT", "/profile", { cookie: a, body: { ...PROFILE, whatsapp: "12", consent: false } });
  assert.equal(bad.status, 422);
  assert.deepEqual(Object.keys(bad.json.fields).sort(), ["consent", "whatsapp"]);
  assert.equal((await w.call("PUT", "/profile", { cookie: a, body: PROFILE })).status, 200);

  const second = await w.signIn("RakaPratama+games@gmail.com");
  const me = await w.call("GET", "/me", { cookie: second });
  assert.equal(me.json.profile.name, "Raka Pratama", "the +tag and the dots are the same account");
  assert.equal((await w.call("PUT", "/profile", { cookie: second, body: { ...PROFILE, bio: "Changed." } })).json.id, me.json.profile.id, "the same profile, not a second one");
  assert.equal((w.db.raw.prepare("SELECT COUNT(*) AS n FROM profiles").get() as { n: number }).n, 1);
  assert.equal((w.db.raw.prepare("SELECT COUNT(*) AS n FROM accounts").get() as { n: number }).n, 1);

  assert.equal((await w.call("POST", "/games", { cookie: a, body: GAME })).status, 201);
  assert.equal((await w.call("POST", "/games", { cookie: a, body: { ...GAME, title: "Darah di Balik Tirai", summary: "Intrik politik antar vampir." } })).status, 201);
  const games = (await w.call("GET", "/me", { cookie: a })).json.games;
  assert.equal(games.length, 2);
  assert.ok(games.every((g: any) => g.status === "pending"));
});

test("an admin approves; the public data shows only approved things of an approved profile, in the old shape", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const game = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  const profileId = (await w.call("GET", "/me", { cookie: gm })).json.profile.id as string;

  assert.equal((await w.call("GET", "/public")).status, 403, "the public data needs the build key");
  const empty = (await w.call("GET", `/public?key=${BUILD_KEY}`)).json;
  assert.deepEqual([empty.gms.length, empty.games.length], [0, 0], "nothing is public before approval");

  assert.equal((await w.call("POST", "/admin", { cookie: gm, body: { action: "queue" } })).status, 403, "a GM is not an admin");
  const admin = await w.signIn(OWNER);
  const queue = (await w.call("POST", "/admin", { cookie: admin, body: { action: "queue" } })).json;
  assert.equal(queue.gms[0].email, "raka@example.com");
  assert.equal(queue.games[0].title, GAME.title);
  assert.equal(queue.games[0].startsAt, "2026-11-08T12:00:00.000Z");

  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "game", ids: [game], status: "approved", notify: true } });
  assert.equal((await w.call("GET", `/public?key=${BUILD_KEY}`)).json.games.length, 0, "a game of a pending profile stays off");
  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "gm", ids: [profileId], status: "approved", notify: true } });
  assert.match(w.mails.at(-1)!.subject, /Approved: Raka Pratama/);

  const pub = (await w.call("GET", `/public?key=${BUILD_KEY}`)).json;
  assert.equal(pub.gms.length, 1);
  assert.equal(pub.games.length, 1);
  assert.equal(pub.games[0].gmId, profileId);
  assert.equal(JSON.stringify(pub).includes("raka@example.com"), false, "no email in the public data");
  assert.equal(JSON.stringify(pub).includes("adminNote"), false);
  const parsed = parsePublicData(pub);
  assert.equal(parsed.data.games.length, 1);
  assert.deepEqual(parsed.warnings, [], "the site's own parser accepts it without complaint");
});

test("editing a decided game sends it back to review; the same content again changes nothing", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  const admin = await w.signIn(OWNER);
  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "game", ids: [id], status: "approved" } });

  const same = await w.call("PUT", `/games/${id}`, { cookie: gm, body: GAME });
  assert.deepEqual([same.json.changed, same.json.status], [false, "approved"]);
  const changed = await w.call("PUT", `/games/${id}`, { cookie: gm, body: { ...GAME, seats: 6 } });
  assert.deepEqual([changed.json.changed, changed.json.status], [true, "pending"]);
  const other = await w.signIn("other@example.com");
  await w.call("PUT", "/profile", { cookie: other, body: { ...PROFILE, whatsapp: "0811-1111-1111" } });
  assert.equal((await w.call("PUT", `/games/${id}`, { cookie: other, body: GAME })).status, 404, "nobody edits another GM's game");
});

test("a GM marks their own game full without a review, and removes it; the address keeps a notice", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  const profileId = (await w.call("GET", "/me", { cookie: gm })).json.profile.id as string;
  const admin = await w.signIn(OWNER);
  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "gm", ids: [profileId], status: "approved" } });
  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "game", ids: [id], status: "approved" } });

  assert.equal((await w.call("POST", `/games/${id}/full`, { cookie: gm, body: { full: true } })).status, 200);
  let pub = (await w.call("GET", `/public?key=${BUILD_KEY}`)).json;
  assert.equal(pub.games[0].full, true);
  assert.equal(pub.games[0].featured, false);

  const stranger = await w.signIn("stranger@example.com");
  await w.call("PUT", "/profile", { cookie: stranger, body: { ...PROFILE, whatsapp: "0811-1111-1111" } });
  assert.equal((await w.call("POST", `/games/${id}/full`, { cookie: stranger, body: { full: false } })).status, 404);
  assert.equal((await w.call("DELETE", `/games/${id}`, { cookie: stranger })).status, 404);

  assert.equal((await w.call("DELETE", `/games/${id}`, { cookie: gm })).status, 200);
  pub = (await w.call("GET", `/public?key=${BUILD_KEY}`)).json;
  assert.equal(pub.games.length, 0);
  assert.equal(pub.goneGames.length, 1, "a game that was live keeps its address as a notice");
  assert.equal((await w.call("GET", "/me", { cookie: gm })).json.games.length, 0, "and leaves the GM's own list");
});

test("two accounts with one WhatsApp number are flagged, and an admin merges them", async () => {
  const w = makeWorld();
  const a = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: a, body: PROFILE });
  const b = await w.signIn("raka.second@example.com");
  await w.call("PUT", "/profile", { cookie: b, body: { ...PROFILE, name: "Raka P." } });
  await w.call("POST", "/games", { cookie: b, body: GAME });

  const admin = await w.signIn(OWNER);
  const queue = (await w.call("POST", "/admin", { cookie: admin, body: { action: "queue" } })).json;
  const real = queue.gms.find((g: any) => g.name === "Raka Pratama");
  const dup = queue.gms.find((g: any) => g.name === "Raka P.");
  assert.deepEqual(dup.sharesPhoneWith, ["Raka Pratama"]);
  assert.deepEqual(real.sharesPhoneWith, ["Raka P."]);

  assert.equal((await w.call("POST", "/admin", { cookie: admin, body: { action: "merge", fromId: dup.id, intoId: real.id } })).status, 200);
  assert.equal((await w.call("GET", "/me", { cookie: a })).json.games.length, 1, "the game moved to the real profile");
  const again = await w.signIn("raka.second@example.com");
  assert.equal((await w.call("GET", "/me", { cookie: again })).json.profile.name, "Raka Pratama", "the duplicate's email now opens the real account");
  assert.equal((w.db.raw.prepare("SELECT COUNT(*) AS n FROM profiles").get() as { n: number }).n, 1);
});

test("admins: only an admin may act; the owner and yourself cannot be removed", async () => {
  const w = makeWorld();
  const owner = await w.signIn(OWNER);
  const added = await w.call("POST", "/admin", { cookie: owner, body: { action: "admin.add", email: "Helper@Example.com" } });
  assert.deepEqual(added.json.admins.map((x: any) => x.email), ["helper@example.com"]);
  const helper = await w.signIn("helper@example.com");
  assert.equal((await w.call("POST", "/admin", { cookie: helper, body: { action: "queue" } })).status, 200);
  assert.equal((await w.call("POST", "/admin", { cookie: helper, body: { action: "admin.remove", email: OWNER } })).json.message, "owner");
  assert.equal((await w.call("POST", "/admin", { cookie: helper, body: { action: "admin.remove", email: "helper@example.com" } })).json.message, "self");
  assert.equal((await w.call("POST", "/admin", { cookie: owner, body: { action: "admin.remove", email: "helper@example.com" } })).status, 200);
  assert.equal((await w.call("POST", "/admin", { cookie: helper, body: { action: "queue" } })).status, 403);
});

test("pictures: type is read from the bytes, size is limited, and only approved ones are public", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  assert.equal((await w.call("POST", "/images?kind=cover", { cookie: gm, raw: new TextEncoder().encode("<script>alert(1)</script>").buffer as ArrayBuffer, type: "image/webp" })).status, 415);
  assert.equal((await w.call("POST", "/images?kind=photo", { cookie: gm, raw: new Uint8Array(700_000).buffer as ArrayBuffer })).status, 413, "a photo over 600 KB");
  assert.equal((await w.call("POST", "/images?kind=photo", { cookie: gm, raw: new Uint8Array(1000).buffer as ArrayBuffer })).status, 415, "zeros are not an image");
  const up = await w.call("POST", "/images?kind=cover", { cookie: gm, raw: WEBP });
  assert.equal(up.status, 201);
  const key = up.json.key as string;
  assert.match(key, /^covers\/[a-z0-9]{16}\.webp$/);

  const id = (await w.call("POST", "/games", { cookie: gm, body: { ...GAME, coverKey: key } })).json.id as string;
  assert.equal((await w.call("GET", `/img/${key}`)).status, 404, "a pending cover is private");
  assert.equal((await w.call("GET", `/img/${key}?key=${BUILD_KEY}`)).status, 200, "the build can read it");
  const admin = await w.signIn(OWNER);
  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "game", ids: [id], status: "approved" } });
  const shown = await w.call("GET", `/img/${key}`);
  assert.equal(shown.status, 200);
  assert.equal(shown.res.headers.get("Content-Type"), "image/webp");
  assert.equal((await w.call("GET", "/img/covers/..%2F..%2Fsecret.webp")).status, 404);
});

test("builds are coalesced: many changes, at most one build per two minutes, and the daily one is forced", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const profileId = (await w.call("GET", "/me", { cookie: gm })).json.profile.id as string;
  const admin = await w.signIn(OWNER);
  const approve = () => w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "gm", ids: [profileId], status: "approved" } });
  const reject = () => w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "gm", ids: [profileId], status: "rejected", reason: "test" } });

  await approve();
  assert.equal(w.hook.length, 1, "the first change builds at once");
  await reject();
  await approve();
  assert.equal(w.hook.length, 1, "changes within two minutes wait");
  w.clock.ms += MIN_GAP_MS + 1000;
  assert.equal(await deployIfDue(w.env.ctx, w.env.deployHook, w.env.fetcher), "sent", "the timer sends the waiting build");
  assert.equal(w.hook.length, 2);
  assert.equal(await deployIfDue(w.env.ctx, w.env.deployHook, w.env.fetcher), "idle", "nothing is waiting now");
});

test("a person can erase their account: profile, games, pictures and email go; the log keeps no personal data", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const up = await w.call("POST", "/images?kind=cover", { cookie: gm, raw: WEBP });
  await w.call("POST", "/games", { cookie: gm, body: { ...GAME, coverKey: up.json.key } });
  assert.equal(w.bucket.keys().length, 1);
  assert.equal((await w.call("DELETE", "/account", { cookie: gm })).status, 200);
  const count = (t: string) => (w.db.raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  assert.deepEqual([count("accounts"), count("profiles"), count("games"), count("sessions")], [0, 0, 0, 0]);
  assert.deepEqual(w.bucket.keys(), [], "the picture is deleted too");
  assert.equal((await w.call("GET", "/me", { cookie: gm })).status, 401);
  const log = JSON.stringify(w.db.raw.prepare("SELECT * FROM activity WHERE kind = 'erased'").all());
  assert.equal(log.includes("raka@example.com") || log.includes("Raka"), false);
});

test("the health check needs the build key and reports counts only", async () => {
  const w = makeWorld();
  assert.equal((await w.call("GET", "/health")).status, 403);
  const h = await w.call("GET", `/health?key=${BUILD_KEY}`);
  assert.deepEqual(h.json, { ok: true, accounts: 0, profiles: 0, games: 0, admins: 0, deployConfigured: true });
});

test("the mail relay is called with the secret; an error from it is an error here", async () => {
  const { relayMailer } = await import("../../worker/src/email.ts");
  const seen: any[] = [];
  const good = relayMailer("https://script.example/exec", "sekret", (async (url: string, init: any) => { seen.push([url, JSON.parse(init.body)]); return new Response(JSON.stringify({ ok: true })); }) as unknown as typeof fetch);
  await good.send({ to: "a@example.com", subject: "S", body: "B" });
  assert.deepEqual(seen[0], ["https://script.example/exec", { action: "mail", secret: "sekret", to: "a@example.com", subject: "S", body: "B" }]);
  const bad = relayMailer("https://script.example/exec", "x", (async () => new Response(JSON.stringify({ ok: false, error: "quota" }))) as unknown as typeof fetch);
  await assert.rejects(bad.send({ to: "a@example.com", subject: "S", body: "B" }), /quota/);
});

test("the daily job: backs up everything to the bucket, keeps two weeks, rebuilds, and clears old sign-ins", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const { daily } = await import("../../worker/src/handler.ts");
  await daily(w.env);
  const keys = w.bucket.keys();
  assert.deepEqual([...keys].sort(), ["backups/2026-10-28-games.csv", "backups/2026-10-28-profiles.csv", "backups/2026-10-28.json"]);
  const snap = JSON.parse(new TextDecoder().decode((await w.bucket.get("backups/2026-10-28.json"))!.body as ArrayBuffer));
  const csv = new TextDecoder().decode((await w.bucket.get("backups/2026-10-28-profiles.csv"))!.body as ArrayBuffer);
  assert.match(csv, /^"id","account_id"/);
  assert.ok(csv.includes('"raka@example.com"'), "the owner's copy has the email, the public data never does");
  assert.equal(snap.tables.profiles.length, 1);
  assert.equal(snap.tables.accounts[0].email, "raka@example.com");
  for (let d = 1; d <= 16; d++) { w.clock.ms += 86_400_000; await daily(w.env); }
  assert.equal(w.bucket.keys().length, 45, "two weeks and today, three files a day");
  assert.equal(w.bucket.keys().includes("backups/2026-10-28.json"), false, "the oldest is gone");
  assert.ok(w.hook.length >= 1, "the daily job asks for a build");
});

test("the CSV copy quotes everything and defuses spreadsheet formulas", async () => {
  const { toCsv } = await import("../../worker/src/backup.ts");
  assert.equal(toCsv([{ a: 'say "hi"', b: "=HYPERLINK(1)", c: "+1", d: "plain, text", e: null }]), '"a","b","c","d","e"\r\n"say ""hi""","\'=HYPERLINK(1)","\'+1","plain, text",""\r\n');
  assert.equal(toCsv([]), "");
});

test("the timers: only the build key may call /cron; tick sends a waiting build, daily backs up", async () => {
  const w = makeWorld();
  assert.equal((await w.call("POST", "/cron?job=tick", { origin: null })).status, 403);
  assert.equal((await w.call("POST", `/cron?job=tick&key=wrong`, { origin: null })).status, 403);
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const profileId = (await w.call("GET", "/me", { cookie: gm })).json.profile.id as string;
  const admin = await w.signIn(OWNER);
  const flip = (status: string) => w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "gm", ids: [profileId], status } });
  await flip("approved");
  await flip("rejected");
  assert.equal(w.hook.length, 1, "the second change waits");
  w.clock.ms += MIN_GAP_MS + 1000;
  const tick = await w.call("POST", `/cron?job=tick&key=${BUILD_KEY}`, { origin: null });
  assert.deepEqual([tick.status, tick.json.result], [200, "sent"]);
  assert.equal(w.hook.length, 2);
  const daily = await w.call("POST", `/cron?job=daily&key=${BUILD_KEY}`, { origin: null });
  assert.equal(daily.status, 200);
  assert.ok(w.bucket.keys().some((k) => k.startsWith("backups/")));
});
