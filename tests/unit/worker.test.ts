/* eslint-disable @typescript-eslint/no-explicit-any */
// The Cloudflare backend (worker/src): accounts, one profile per account, games, review, self-service, images, builds.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeEmail } from "../../worker/src/email.ts";
import { parseGame, parseProfile, normalizePhone, zonedInstant } from "../../worker/src/rules.ts";
import { deployIfDue, MIN_GAP_MS } from "../../worker/src/deploy.ts";
import { parsePublicData } from "../../src/lib/public-data.ts";
import { GAME, HELD_GAME, HELD_PROFILE, OWNER, PROFILE, WEBP, makeWorld, sqliteDb as sqliteDbForTests } from "../support/worker-env.ts";

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
  assert.equal(bad({ city: "Surabaya" }).cities, "invalid", "a place outside the list");
  assert.equal(bad({ locationType: "online", city: "" }).cities, undefined, "an online game needs no place");
  assert.equal(bad({ summary: "x".repeat(81) }).summary, "too_long");
  assert.equal(bad({ seats: 0 }).seats, "invalid_number");
  assert.equal(bad({ genres: ["horror", "sci-fi", "mystery", "cozy"] }).genres, undefined, "four genres are fine now (up to five)");
  assert.equal(bad({ genres: ["horror", "sci-fi", "mystery", "cozy", "urban", "western"] }).genres, "invalid");
  assert.equal(bad({ genres: ["not-a-genre"] }).genres, "invalid");
  assert.equal(bad({ mechanics: ["d20", "pbta"] }).mechanics, undefined, "up to three known mechanics are fine");
  assert.equal(bad({ mechanics: ["year-zero", "2d20", "mork-borg"] }).mechanics, undefined, "and so are the ones taken over from StartPlaying");
  assert.equal(bad({ mechanics: ["d20", "d100", "2d6", "pbta"] }).mechanics, "invalid");
  assert.equal(bad({ mechanics: ["roll-under-the-moon"] }).mechanics, "invalid");
  const saved = parseGame({ ...GAME, mechanics: ["d20"] }, now);
  assert.deepEqual(saved.ok ? saved.value.mechanics : null, ["d20"]);
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
  assert.ok(games.every((g: any) => g.status === "approved"), "what a Game Master saves is live at once");
});

test("what a Game Master saves is live at once and public without a phone number; a held profile stays off until an admin releases it", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const game = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  const profileId = (await w.call("GET", "/me", { cookie: gm })).json.profile.id as string;

  assert.equal((await w.call("GET", "/public")).status, 403, "the public data needs the build key");
  const pub = (await w.call("GET", "/public", { build: true })).json;
  assert.equal(pub.gms.length, 1, "the profile is live without anyone approving it");
  assert.equal(pub.games.length, 1);
  assert.equal(pub.games[0].gmId, profileId);
  assert.deepEqual(pub.games[0].mechanics, ["d100"], "mechanics survive the database and reach the public data");
  assert.equal(pub.gms[0].instagram, "raka.plays", "the Instagram link given in the profile is stored and published as a plain username");
  assert.equal(JSON.stringify(pub).includes("raka@example.com"), false, "no email in the public data");
  assert.equal(JSON.stringify(pub).includes("adminNote"), false);
  assert.equal("whatsapp" in pub.gms[0], false, "no phone number in the public data");
  assert.equal(JSON.stringify(pub).includes("81234567890"), false);
  const parsed = parsePublicData(pub);
  assert.equal(parsed.data.games.length, 1);
  assert.deepEqual(parsed.warnings, [], "the site's own parser accepts it without complaint");

  assert.equal((await w.call("POST", "/admin", { cookie: gm, body: { action: "queue" } })).status, 403, "a GM is not an admin");
  const admin = await w.signIn(OWNER);
  const queue = (await w.call("POST", "/admin", { cookie: admin, body: { action: "queue" } })).json;
  assert.equal(queue.gms[0].email, "raka@example.com");
  assert.equal(queue.games[0].title, GAME.title);
  assert.equal(queue.games[0].startsAt, "2026-11-08T12:00:00.000Z");
  assert.equal(game, queue.games[0].id);

  // wording that often means a scam is saved but held for a look
  const other = await w.signIn("held@example.com");
  const held = await w.call("PUT", "/profile", { cookie: other, body: { ...HELD_PROFILE, name: "Held One", whatsapp: "0811-1111-1111" } });
  assert.equal(held.json.status, "pending");
  assert.equal((await w.call("GET", "/public", { build: true })).json.gms.length, 1, "a held profile is not public");
  const heldId = (await w.call("GET", "/me", { cookie: other })).json.profile.id as string;
  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "gm", ids: [heldId], status: "approved", notify: true } });
  assert.match(w.mails.at(-1)!.subject, /Approved: Held One/);
  assert.equal((await w.call("GET", "/public", { build: true })).json.gms.length, 2, "released by an admin");
});

test("an Instagram name is optional, and one that is not a username or a profile link is refused", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  for (const instagram of ["", "@raka_plays", "raka.plays", "instagram.com/raka.plays/"]) {
    assert.equal((await w.call("PUT", "/profile", { cookie: gm, body: { ...PROFILE, instagram } })).status, 200, `"${instagram}" is accepted`);
  }
  for (const instagram of ["raka plays", "raka..plays", ".raka", "raka.", "https://evil.example/raka", "https://instagram.com.evil.example/raka", "https://www.instagram.com/p/abc123/", "a".repeat(31)]) {
    const res = await w.call("PUT", "/profile", { cookie: gm, body: { ...PROFILE, instagram } });
    assert.equal(res.status, 422, `"${instagram}" is refused`);
    assert.equal(res.json.fields.instagram, "invalid_instagram");
  }
  const me = (await w.call("GET", "/me", { cookie: gm })).json.profile;
  assert.equal(me.instagram, "raka.plays", "the last good value is what is stored");
});

test("editing a live game keeps it live; wording that looks like a scam holds it, and a clean fix releases it again; the same content changes nothing", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  const live = async () => ((await w.call("GET", "/public", { build: true })).json.games as any[]).find((g) => g.id === id);

  const same = await w.call("PUT", `/games/${id}`, { cookie: gm, body: GAME });
  assert.deepEqual([same.json.changed, same.json.status], [false, "approved"]);
  const changed = await w.call("PUT", `/games/${id}`, { cookie: gm, body: { ...GAME, title: "A different title", seats: 6, priceIdr: 120000 } });
  assert.deepEqual([changed.json.changed, changed.json.status], [true, "approved"], "no review for an edit");
  const now = await live();
  assert.deepEqual([now.title, now.seats, now.priceIdr], ["A different title", 6, 120000], "and the site data has it at once");

  const held = await w.call("PUT", `/games/${id}`, { cookie: gm, body: { ...HELD_GAME, title: "A different title" } });
  assert.equal(held.json.status, "pending", "scam wording holds it back");
  assert.equal(await live(), undefined, "a held game is off the site");
  const fixed = await w.call("PUT", `/games/${id}`, { cookie: gm, body: GAME });
  assert.equal(fixed.json.status, "approved", "a clean fix of something only the checks held releases it");
  assert.ok(await live());

  const other = await w.signIn("other@example.com");
  await w.call("PUT", "/profile", { cookie: other, body: { ...PROFILE, whatsapp: "0811-1111-1111" } });
  assert.equal((await w.call("PUT", `/games/${id}`, { cookie: other, body: GAME })).status, 404, "nobody edits another GM's game");
});

test("a game or profile an admin hid stays hidden when its Game Master edits it: the edit only puts it in the held list", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  const admin = await w.signIn(OWNER);
  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "game", ids: [id], status: "rejected", reason: "Not a tabletop game" } });
  assert.equal(((await w.call("GET", "/public", { build: true })).json.games as any[]).length, 0, "hidden");
  const edited = await w.call("PUT", `/games/${id}`, { cookie: gm, body: { ...GAME, title: "Now a tabletop game" } });
  assert.equal(edited.json.status, "pending", "back in front of an admin, not live by itself");
  assert.equal(((await w.call("GET", "/public", { build: true })).json.games as any[]).length, 0);
  await w.call("PUT", `/games/${id}`, { cookie: gm, body: { ...GAME, title: "Now a tabletop game", seats: 4 } });
  assert.equal((await w.call("GET", "/me", { cookie: gm })).json.games[0].status, "pending", "another edit does not release it either");
  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "game", ids: [id], status: "approved" } });
  assert.equal(((await w.call("GET", "/public", { build: true })).json.games as any[]).length, 1, "an admin brings it back");
});

test("approving a held game whose Game Master is also held is flagged, and the email does not promise a listing", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: HELD_PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: HELD_GAME })).json.id as string;
  const profileId = (await w.call("GET", "/me", { cookie: gm })).json.profile.id as string;
  const admin = await w.signIn(OWNER);
  const first = await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "game", ids: [id], status: "approved", notify: true } });
  assert.deepEqual(first.json.hidden, [id], "the admin is told it stays off the site");
  assert.equal(first.json.publishing, false, "nothing public changed, so no rebuild");
  const mail = w.mails.find((m) => /^Approved/.test(m.subject))!;
  assert.match(mail.subject, /waiting for your profile/);
  assert.match(mail.body, /only once your Game Master profile is approved/);
  assert.ok(!/will appear on the Quest Board within a few minutes/.test(mail.body));

  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "gm", ids: [profileId], status: "approved" } });
  const second = await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "game", ids: [id], status: "approved" } });
  assert.deepEqual(second.json.hidden, [], "nothing hidden when the profile is approved");
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
  let pub = (await w.call("GET", "/public", { build: true })).json;
  assert.equal(pub.games[0].full, true);

  const stranger = await w.signIn("stranger@example.com");
  await w.call("PUT", "/profile", { cookie: stranger, body: { ...PROFILE, whatsapp: "0811-1111-1111" } });
  assert.equal((await w.call("POST", `/games/${id}/full`, { cookie: stranger, body: { full: false } })).status, 404);
  assert.equal((await w.call("DELETE", `/games/${id}`, { cookie: stranger })).status, 404);

  assert.equal((await w.call("DELETE", `/games/${id}`, { cookie: gm })).status, 200);
  pub = (await w.call("GET", "/public", { build: true })).json;
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
  assert.equal((await w.call("GET", "/me", { cookie: a })).json.games.length, 0, "asking moves nothing");
  const offer = (await w.call("GET", "/me", { cookie: a })).json.mergeOffers[0];
  assert.equal(offer.email, "raka.second@example.com", "the owner of the real account is shown which address asks to join");
  assert.equal((await w.call("POST", "/merge/respond", { cookie: a, body: { id: offer.id, accept: true } })).status, 200);
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

  const id = (await w.call("POST", "/games", { cookie: gm, body: { ...HELD_GAME, coverKey: key } })).json.id as string;
  assert.equal((await w.call("GET", `/img/${key}`)).status, 404, "the cover of a held game is private");
  assert.equal((await w.call("GET", `/img/${key}`, { build: true })).status, 200, "the build can read it");
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
  assert.equal(await deployIfDue(w.env.ctx, w.env.deployHook, w.env.fetcher), "wait", "the change stays marked until the site says it has the build");
  w.site.generatedAt = new Date(w.clock.ms).toISOString();
  w.clock.ms += MIN_GAP_MS + 1000;
  assert.equal(await deployIfDue(w.env.ctx, w.env.deployHook, w.env.fetcher), "idle", "the site has caught up: nothing is waiting now");
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
  const h = await w.call("GET", "/health", { build: true });
  assert.deepEqual(h.json, { ok: true, accounts: 0, profiles: 0, games: 0, admins: 0, deployConfigured: true, deploy: { pending: false, lastSentAt: null, attempts: 0, failingSince: null }, turnstileConfigured: false, lastBackupAt: null, backupError: null, lastMailOkAt: null, lastMailError: null });
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

test("every table the migrations make is either in the backup or left out on purpose", async () => {
  const { TABLES, NOT_BACKED_UP } = await import("../../worker/src/backup.ts");
  const dir = new URL("../../worker/migrations/", import.meta.url);
  const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
  const made = [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g)].map((m) => m[1]!).sort();
  assert.deepEqual(made, [...TABLES, ...Object.keys(NOT_BACKED_UP)].sort(), "a new table needs a place in TABLES (worker/src/backup.ts) or a reason in NOT_BACKED_UP");
});

test("a nightly backup restores: loaded into a fresh database, every table it holds comes back row for row", async () => {
  const { TABLES, restoreSql } = await import("../../worker/src/backup.ts");
  const { daily } = await import("../../worker/src/handler.ts");
  const w = makeWorld();
  // A duplicate account merged into one made after it (accounts.merged_into points forward, so the restore must check references at the end),
  // a second duplicate whose merge still waits, a live game with a report on it, a second admin, and text with quotes, a semicolon and a new line.
  const dup = await w.signIn("raka.second@example.com");
  await w.call("PUT", "/profile", { cookie: dup, body: { ...PROFILE, name: "Raka P." } });
  const real = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: real, body: { ...PROFILE, bio: "It's \"quiet\" horror; -- two lines\nof it." } });
  const other = await w.signIn("raka.third@example.com");
  await w.call("PUT", "/profile", { cookie: other, body: { ...PROFILE, name: "R. Pratama" } });
  const game = (await w.call("POST", "/games", { cookie: real, body: GAME })).json.id as string;
  await w.call("POST", "/report", { body: { kind: "game", id: game, reason: "the 'date' looks wrong" }, headers: { "CF-Connecting-IP": "203.0.113.9" } });
  const admin = await w.signIn(OWNER);
  await w.call("POST", "/admin", { cookie: admin, body: { action: "admin.add", email: "helper@example.com" } });
  const gms = (await w.call("POST", "/admin", { cookie: admin, body: { action: "queue" } })).json.gms as { id: string; name: string }[];
  const idOf = (name: string) => gms.find((g) => g.name === name)!.id;
  await w.call("POST", "/admin", { cookie: admin, body: { action: "merge", fromId: idOf("Raka P."), intoId: idOf("Raka Pratama") } });
  const offer = (await w.call("GET", "/me", { cookie: real })).json.mergeOffers[0];
  assert.equal((await w.call("POST", "/merge/respond", { cookie: real, body: { id: offer.id, accept: true } })).status, 200);
  await w.call("POST", "/admin", { cookie: admin, body: { action: "merge", fromId: idOf("R. Pratama"), intoId: idOf("Raka Pratama") } });

  await daily(w.env);
  const key = w.bucket.keys().find((k) => /^backups\/\d{4}-\d{2}-\d{2}\.json$/.test(k))!;
  const snap = JSON.parse(new TextDecoder().decode((await w.bucket.get(key))!.body as ArrayBuffer));
  for (const t of TABLES) assert.ok(snap.tables[t].length > 0, `the test puts rows in ${t}`);
  assert.ok(snap.tables.accounts.some((a: { merged_into: string | null }) => a.merged_into), "a merged account is in the backup");

  const fresh = sqliteDbForTests();
  fresh.raw.exec(`BEGIN;\n${restoreSql(snap)}COMMIT;`); // D1 runs a file as one transaction; Node's SQLite checks foreign keys like D1
  const rows = (db: ReturnType<typeof sqliteDbForTests>, t: string) => db.raw.prepare(`SELECT * FROM ${t}`).all().map((r) => JSON.stringify(r)).sort();
  for (const t of TABLES) assert.deepEqual(rows(fresh, t), rows(w.db, t), `${t} comes back as it was`);
});

test("a restore refuses a backup with a column name that is not one", async () => {
  const { restoreSql } = await import("../../worker/src/backup.ts");
  assert.throws(() => restoreSql({ tables: { accounts: [{ "id) VALUES (1); DROP TABLE games; --": "x" }] } }), /not a column name/);
  assert.equal(restoreSql({ tables: {} }), "PRAGMA defer_foreign_keys = true;\n", "an empty or older backup gives an empty load");
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
  const tick = await w.call("POST", "/cron?job=tick", { origin: null, build: true });
  assert.deepEqual([tick.status, tick.json.result], [200, "sent"]);
  assert.equal(w.hook.length, 2);
  const daily = await w.call("POST", "/cron?job=daily", { origin: null, build: true });
  assert.equal(daily.status, 200);
  assert.ok(w.bucket.keys().some((k) => k.startsWith("backups/")));
});

const DAY = 86_400_000;
const health = async (w: ReturnType<typeof makeWorld>) => (await w.call("GET", "/health", { build: true })).json;

test("health shows when mail last worked and when it last failed, with the error but never the address", async () => {
  const w = makeWorld();
  const working = w.env.ctx.mailer;
  w.env.ctx.mailer = { send: async () => { throw new Error("mail_failed_quota"); } };
  await w.call("POST", "/login/request", { body: { email: "raka@example.com" } });
  const failed = await health(w);
  assert.equal(failed.lastMailOkAt, null);
  assert.equal(failed.lastMailError.error, "mail_failed_quota");
  assert.equal(JSON.stringify(failed).includes("raka@example.com"), false);
  w.env.ctx.mailer = working;
  await w.call("POST", "/login/request", { body: { email: "raka@example.com" } });
  assert.ok((await health(w)).lastMailOkAt, "the next success is recorded");
});

test("a failed daily backup is recorded, emailed to the owner, does not stop the rebuild, and fails the timer", async () => {
  const w = makeWorld();
  const put = w.bucket.put;
  w.bucket.put = async () => { throw new Error("r2 is down"); };
  const { daily } = await import("../../worker/src/handler.ts");
  await assert.rejects(() => daily(w.env), /r2 is down/);
  const h = await health(w);
  assert.match(h.backupError, /r2 is down/);
  assert.equal(h.lastBackupAt, null);
  assert.equal(w.mails.filter((m) => m.to === OWNER && /backup failed/.test(m.subject)).length, 1);
  assert.equal(w.hook.length, 1, "the rebuild still went out");
  w.bucket.put = put;
  await daily(w.env);
  const ok = await health(w);
  assert.ok(ok.lastBackupAt);
  assert.equal(ok.backupError, null, "a good backup clears the error");
});

test("the tick tells the owner once a day when no backup has been made for 36 hours, and stays quiet otherwise", async () => {
  const w = makeWorld();
  const tick = () => w.call("POST", "/cron?job=tick", { origin: null, build: true });
  const alerts = () => w.mails.filter((m) => /no backup/i.test(m.subject)).length;
  await tick();
  w.clock.ms += 35 * 3_600_000;
  await tick();
  assert.equal(alerts(), 0, "not yet");
  w.clock.ms += 2 * 3_600_000;
  await tick();
  await tick();
  assert.equal(alerts(), 1, "once, however often the tick runs");
  w.clock.ms += DAY;
  await tick();
  assert.equal(alerts(), 2, "and again the next day while it stays broken");
  const { daily } = await import("../../worker/src/handler.ts");
  await daily(w.env);
  w.clock.ms += 10 * 3_600_000;
  await tick();
  assert.equal(alerts(), 2, "a good backup ends it");
});

test("an account nobody signs in to is warned after two years and erased a month later; signing in saves it", async () => {
  const { daily } = await import("../../worker/src/handler.ts");
  const w = makeWorld();
  const count = (t: string) => (w.db.raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  const gone = await w.signIn("gone@example.com");
  await w.call("PUT", "/profile", { cookie: gone, body: PROFILE });
  const up = await w.call("POST", "/images?kind=cover", { cookie: gone, raw: WEBP });
  await w.call("POST", "/games", { cookie: gone, body: { ...GAME, coverKey: up.json.key } });
  await w.signIn("kept@example.com");
  await w.signIn(OWNER);
  const files = w.bucket.keys().length;
  const warnings = () => w.mails.filter((m) => /will be erased/.test(m.subject));

  w.clock.ms += 700 * DAY;
  await daily(w.env);
  assert.equal(warnings().length, 0, "not yet two years");
  w.clock.ms += 31 * DAY;
  await daily(w.env);
  assert.deepEqual(warnings().map((m) => m.to).sort(), ["gone@example.com", "kept@example.com"], "the owner is never warned");
  assert.equal(count("accounts"), 3, "warned, not erased");
  assert.match(warnings()[0]!.body, /30 days/);

  await w.signIn("kept@example.com");
  w.clock.ms += 31 * DAY;
  await daily(w.env);
  assert.equal(count("accounts"), 2, "only the one that did not come back is erased");
  const accountsOf = (email: string) => (w.db.raw.prepare("SELECT COUNT(*) AS n FROM accounts WHERE email = ?").get(email) as { n: number }).n;
  assert.equal(accountsOf("gone@example.com"), 0);
  assert.equal(count("games"), 0);
  assert.ok(w.bucket.keys().filter((k) => k.startsWith("covers/")).length < files, "its picture is deleted");
  const log = JSON.stringify(w.db.raw.prepare("SELECT * FROM activity WHERE kind IN ('expired', 'expiry_warned')").all());
  assert.equal(log.includes("gone@example.com"), false, "the log keeps no email");
  w.clock.ms += 800 * DAY;
  await daily(w.env);
  assert.equal(accountsOf(OWNER), 1, "the owner never expires");
});

test("a daily run erases one account or warns a few, never both, and stays inside the 50 queries a request may make", async () => {
  const { daily } = await import("../../worker/src/handler.ts");
  const { ERASE_PER_RUN, WARN_PER_RUN } = await import("../../worker/src/retention.ts");
  const w = makeWorld();
  for (const n of ["a", "b", "c", "d", "e"]) {
    const c = await w.signIn(`${n}@example.com`);
    await w.call("PUT", "/profile", { cookie: c, body: { ...PROFILE, name: `Person ${n}`, whatsapp: `08123${n.charCodeAt(0)}0000` } });
    await w.call("POST", "/games", { cookie: c, body: GAME }); // an erase with a game and its rows is the heavy kind
  }
  const count = (sql: string) => (w.db.raw.prepare(sql).get() as { n: number }).n;
  const accounts = () => count("SELECT COUNT(*) AS n FROM accounts");
  const marked = () => count("SELECT COUNT(*) AS n FROM accounts WHERE expiry_warned_at IS NOT NULL");
  const warningMails = () => w.mails.filter((m) => /will be erased/.test(m.subject)).length;
  const run = async () => { w.db.count.n = 0; await daily(w.env); return w.db.count.n; };

  w.clock.ms += 731 * DAY;
  const first = await run();
  assert.equal(marked(), WARN_PER_RUN, "a run warns no more than its cap");
  assert.equal(warningMails(), WARN_PER_RUN, "and mails exactly those");
  assert.ok(first <= 50, `${first} queries in a run that warned ${WARN_PER_RUN}`);

  w.clock.ms += 31 * DAY; // the three warned are overdue; the other two have not been warned yet
  for (let i = 1; i <= 3; i++) {
    const before = accounts();
    const used = await run();
    assert.equal(before - accounts(), ERASE_PER_RUN, `run ${i}: one erase`);
    assert.equal(warningMails(), WARN_PER_RUN, `run ${i}: an erase run sends no warning`);
    assert.ok(used <= 50, `${used} queries in a run that erased ${ERASE_PER_RUN} account with a game`);
  }
  const last = await run(); // nothing overdue any more: the two never warned are warned now
  assert.equal(warningMails(), WARN_PER_RUN + 2);
  assert.ok(last <= 50, `${last} queries in the run that warned the rest`);
});

test("a warning that cannot be mailed leaves no mark, so the next run tries again; a warning whose mark cannot be written is not mailed", async () => {
  const { daily } = await import("../../worker/src/handler.ts");
  const w = makeWorld();
  await w.signIn("a@example.com");
  w.clock.ms += 731 * DAY;
  const send = w.env.ctx.mailer.send;
  let fail = true;
  w.env.ctx.mailer.send = async (m) => { if (fail && /will be erased/.test(m.subject)) throw new Error("relay down"); return send(m); };
  await daily(w.env);
  assert.equal((w.db.raw.prepare("SELECT COUNT(*) AS n FROM accounts WHERE expiry_warned_at IS NOT NULL").get() as { n: number }).n, 0, "no mark after a failed mail");
  fail = false;
  await daily(w.env);
  assert.equal((w.db.raw.prepare("SELECT COUNT(*) AS n FROM accounts WHERE expiry_warned_at IS NOT NULL").get() as { n: number }).n, 1, "marked once the mail goes");
  assert.equal(w.mails.filter((m) => /will be erased/.test(m.subject)).length, 1);
  await daily(w.env);
  assert.equal(w.mails.filter((m) => /will be erased/.test(m.subject)).length, 1, "a marked account is not warned again");
});

// ── the review digest and the budget of each kind of mail ───────────────────────────────────────────────

/** Signs in `n` Game Masters, each saving a profile; returns nothing: the digest reads the database. */
async function submit(w: ReturnType<typeof makeWorld>, from: number, n: number) {
  for (let i = from; i < from + n; i++) {
    const cookie = await w.signIn(`gm${i}@example.com`);
    await w.call("PUT", "/profile", { cookie, body: { ...HELD_PROFILE, name: `Person ${i}`, whatsapp: `08123000${String(i).padStart(4, "0")}` } });
  }
}
const tick = (w: ReturnType<typeof makeWorld>) => w.call("POST", "/cron?job=tick", { origin: null, build: true });
const digestsOf = (w: ReturnType<typeof makeWorld>) => w.mails.filter((m) => /^To review:/.test(m.subject));

test("a burst of submissions is one digest to the owner and the admins, sent once it has settled, without the people's details", async () => {
  const { DIGEST_SETTLE_MS } = await import("../../worker/src/watch.ts");
  const w = makeWorld();
  const owner = await w.signIn(OWNER);
  await w.call("POST", "/admin", { cookie: owner, body: { action: "admin.add", email: "helper@example.com" } });
  await submit(w, 0, 3);
  assert.equal(digestsOf(w).length, 0, "no mail for a save");
  await tick(w);
  assert.equal(digestsOf(w).length, 0, "and none the moment a burst arrives");
  w.clock.ms += DIGEST_SETTLE_MS + 1000;
  await tick(w);
  const sent = digestsOf(w);
  assert.deepEqual(sent.map((m) => m.to).sort(), ["helper@example.com", OWNER].sort(), "the owner and each admin, not the Game Masters");
  assert.match(sent[0]!.subject, /To review: 3 waiting \/ Untuk ditinjau: 3 menunggu/);
  for (const name of ["Person 0", "Person 1", "Person 2"]) assert.ok(sent[0]!.body.includes(name), `${name} is listed`);
  assert.match(sent[0]!.body, /board\.example\/en\/admin\//);
  assert.ok(!sent.some((m) => /gm\d@example\.com|08123000|raka_gm/.test(m.subject + m.body)), "no address, phone or handle");
  await tick(w);
  assert.equal(digestsOf(w).length, 2, "the next tick sends nothing more");
});

test("digests keep their distance: new submissions wait for the gap, and something old is mentioned again after three days", async () => {
  const { DIGEST_GAP_MS, DIGEST_SETTLE_MS, NAG_AFTER_MS } = await import("../../worker/src/watch.ts");
  const w = makeWorld();
  await submit(w, 0, 1);
  w.clock.ms += DIGEST_SETTLE_MS + 1000;
  await tick(w);
  assert.equal(digestsOf(w).length, 1);

  w.clock.ms += 1000;
  await submit(w, 1, 1);
  w.clock.ms += DIGEST_SETTLE_MS + 1000;
  await tick(w);
  assert.equal(digestsOf(w).length, 1, "a new submission settles but the gap since the last digest has not passed");
  w.clock.ms += DIGEST_GAP_MS;
  await tick(w);
  assert.equal(digestsOf(w).length, 2, "after the gap it goes out");
  assert.match(digestsOf(w)[1]!.subject, /To review: 2 waiting/, "it counts everything that waits, not only the new one");

  w.clock.ms += NAG_AFTER_MS;
  await tick(w);
  assert.equal(digestsOf(w).length, 3, "nothing new, but two have waited three days: a reminder");
  assert.match(digestsOf(w)[2]!.body, /waiting 3 days|waiting [4-9] days/);
  await tick(w);
  assert.equal(digestsOf(w).length, 3, "and only one a day");
});

test("a digest that cannot be sent never breaks the tick, and is not tried every minute", async () => {
  const { DIGEST_SETTLE_MS } = await import("../../worker/src/watch.ts");
  const w = makeWorld();
  await submit(w, 0, 1);
  let tried = 0;
  w.env.ctx.mailer = { send: async () => { tried++; throw new Error("relay down"); } };
  w.clock.ms += DIGEST_SETTLE_MS + 1000;
  assert.equal((await tick(w)).status, 200);
  const first = tried;
  assert.ok(first > 0);
  await tick(w);
  await tick(w);
  assert.equal(tried, first, "no retry storm against a dead relay");
});

test("each kind of mail has its own share of the day: one kind running out never stops another", async () => {
  const { budgetedMailer, MAIL_BUDGET } = await import("../../worker/src/email.ts");
  const sent: string[] = [];
  const db = sqliteDbForTests();
  const clock = { ms: Date.parse("2026-11-05T03:00:00Z") };
  const mailer = budgetedMailer({ send: async (m) => { sent.push(m.subject); } }, db, () => clock.ms);
  const mail = (kind: "login" | "decision" | "notice" | "system" | undefined, n: number) => ({ to: "a@example.com", subject: `${kind ?? "none"} ${n}`, body: "x", kind });
  for (let i = 0; i < MAIL_BUDGET.notice; i++) await mailer.send(mail("notice", i));
  await assert.rejects(() => mailer.send(mail("notice", 99)), /mail_budget_notice/, "review notices have used their share");
  await mailer.send(mail("decision", 0));
  await mailer.send(mail("system", 0));
  await mailer.send(mail(undefined, 0)); // no kind counts as a system mail
  for (let i = 0; i < 200; i++) await mailer.send(mail("login", i)); // sign-ins are counted at the door (auth.ts), not here
  assert.equal(sent.filter((s) => s.startsWith("login")).length, 200);
  assert.ok(Object.values(MAIL_BUDGET).reduce((a, b) => a + b, 0) <= 90, "the shares add up to the relay's 90 a day");
  clock.ms += 86_400_000 + 1000;
  await mailer.send(mail("notice", 100));
});

test("a decision mail runs into its own share, the admin is told, and sign-ins are not affected", async () => {
  const { MAIL_BUDGET } = await import("../../worker/src/email.ts");
  const w = makeWorld();
  const ids: string[] = [];
  for (let i = 0; i < MAIL_BUDGET.decision + 2; i++) {
    const cookie = await w.signIn(`gm${i}@example.com`);
    if (i % 10 === 9) w.clock.ms += 3_600_000;
    await w.call("PUT", "/profile", { cookie, body: { ...HELD_PROFILE, name: `Person ${i}`, whatsapp: `08123000${String(i).padStart(4, "0")}` } });
  }
  const owner = await w.signIn(OWNER);
  const all = ((await w.call("POST", "/admin", { cookie: owner, body: { action: "queue" } })).json.gms as any[]).map((g) => g.id as string);
  ids.push(...all);
  let failed = 0;
  for (let i = 0; i < ids.length; i += 5) {
    const r = await w.call("POST", "/admin", { cookie: owner, body: { action: "review", kind: "gm", ids: ids.slice(i, i + 5), status: "approved", notify: true } });
    failed += r.json.mailFailed.length;
  }
  assert.equal(failed, 2, "the two beyond the share are reported as not emailed; the decisions themselves stand");
  assert.equal((w.db.raw.prepare("SELECT COUNT(*) AS n FROM profiles WHERE status = 'approved'").get() as { n: number }).n, MAIL_BUDGET.decision + 2);
  await w.signIn("late@example.com"); // a sign-in link still arrives
});

test("a Reply-To is passed to the relay only when one is set, and the relay script keeps only a well-formed one", async () => {
  const { relayMailer } = await import("../../worker/src/email.ts");
  const bodies: any[] = [];
  const fetcher = (async (_url: string, init: { body: string }) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }) as unknown as typeof fetch;
  await relayMailer("https://relay.example/exec", "s", fetcher).send({ to: "a@example.com", subject: "x", body: "y" });
  await relayMailer("https://relay.example/exec", "s", fetcher, "help@example.com").send({ to: "a@example.com", subject: "x", body: "y" });
  assert.equal("replyTo" in bodies[0], false);
  assert.equal(bodies[1].replyTo, "help@example.com");
});

test("a long review makes a handful of database queries, decides every record or none, and refuses more than it can carry", async () => {
  const { REVIEW_MAX_IDS } = await import("../../src/lib/types.ts");
  const w = makeWorld();
  for (let i = 0; i < REVIEW_MAX_IDS + 1; i++) {
    const cookie = await w.signIn(`gm${i}@example.com`);
    await w.call("PUT", "/profile", { cookie, body: { ...HELD_PROFILE, name: `Person ${i}`, whatsapp: `08123000${String(i).padStart(4, "0")}` } });
  }
  const owner = await w.signIn(OWNER);
  const ids = ((await w.call("POST", "/admin", { cookie: owner, body: { action: "queue" } })).json.gms as any[]).map((g) => g.id as string);
  assert.equal((await w.call("POST", "/admin", { cookie: owner, body: { action: "review", kind: "gm", ids, status: "approved" } })).status, 400, "one more than the limit is refused whole");

  const mailsBefore = w.mails.length;
  w.db.count.n = 0;
  const r = await w.call("POST", "/admin", { cookie: owner, body: { action: "review", kind: "gm", ids: ids.slice(0, REVIEW_MAX_IDS), status: "approved", notify: true } });
  assert.equal(r.status, 200);
  assert.equal(r.json.updated.length, REVIEW_MAX_IDS);
  assert.deepEqual(r.json.mailFailed, []);
  const queries = w.db.count.n;
  const mails = w.mails.length - mailsBefore;
  assert.equal(mails, REVIEW_MAX_IDS, "everyone is emailed");
  assert.ok(queries + mails <= 50, `${queries} queries and ${mails} mails in one call: Cloudflare's free plan allows 50 database queries a request`);
  assert.equal((w.db.raw.prepare("SELECT COUNT(*) AS n FROM profiles WHERE status = 'approved'").get() as { n: number }).n, REVIEW_MAX_IDS);
});

test("a decision email that cannot be sent is reported to the admin, and the decision stands", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: HELD_PROFILE });
  const owner = await w.signIn(OWNER);
  const id = ((await w.call("POST", "/admin", { cookie: owner, body: { action: "queue" } })).json.gms as any[])[0].id as string;
  w.env.ctx.mailer = { send: async () => { throw new Error("relay down"); } };
  const r = await w.call("POST", "/admin", { cookie: owner, body: { action: "review", kind: "gm", ids: [id], status: "approved", notify: true } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.mailFailed, [id], "the admin hears that this one was not emailed");
  assert.equal((w.db.raw.prepare("SELECT status FROM profiles WHERE id = ?").get(id) as { status: string }).status, "approved");
});

test("erasing a Game Master with many games stays inside the query budget, in one all-or-none batch", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  for (let i = 0; i < 25; i++) {
    await w.call("POST", "/games", { cookie: gm, body: { ...GAME, title: `Game ${i}` } });
    w.clock.ms += 3 * 3_600_000; // a profile may add ten games a day
  }
  assert.equal((w.db.raw.prepare("SELECT COUNT(*) AS n FROM games").get() as { n: number }).n, 25);
  w.db.count.n = 0;
  assert.equal((await w.call("DELETE", "/account", { cookie: gm })).status, 200);
  assert.ok(w.db.count.n <= 50, `${w.db.count.n} queries to erase an account with 25 games`);
  for (const table of ["accounts", "profiles", "games"]) assert.equal((w.db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n, 0, `${table} is empty`);
});

test("a change stays marked until the site says it has caught up; a build that never lands is sent again, then the owner is told", async () => {
  const { deployState, RETRY_BASE_MS } = await import("../../worker/src/deploy.ts");
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: HELD_PROFILE });
  const owner = await w.signIn(OWNER);
  const id = ((await w.call("POST", "/admin", { cookie: owner, body: { action: "queue" } })).json.gms as any[])[0].id as string;
  await w.call("POST", "/admin", { cookie: owner, body: { action: "review", kind: "gm", ids: [id], status: "approved" } });
  assert.equal(w.hook.length, 1, "the build is sent at once");
  w.site.generatedAt = new Date(w.clock.ms - 3_600_000).toISOString(); // the site still has an older build
  const tick = async () => (await w.call("POST", "/cron?job=tick", { origin: null, build: true })).json.result as string;
  assert.equal((await deployState(w.env.ctx)).pending, true, "accepted by Cloudflare is not the same as published");

  w.clock.ms += RETRY_BASE_MS / 2;
  assert.equal(await tick(), "wait", "a build gets its time");
  assert.equal(w.hook.length, 1);
  w.clock.ms += RETRY_BASE_MS / 2 + 60_000;
  assert.equal(await tick(), "sent", "ten minutes and the site has not got it: the build is sent again");
  w.clock.ms += RETRY_BASE_MS * 2 + 60_000;
  assert.equal(await tick(), "sent", "and again after twice as long");
  assert.equal(w.hook.length, 3);
  const stuck = await deployState(w.env.ctx);
  assert.equal(stuck.attempts, 3);
  assert.ok(stuck.failingSince, "three sends: the publishing counts as stuck");
  assert.equal((await w.call("GET", "/health", { build: true })).json.deploy.failingSince, stuck.failingSince, "health shows it");

  const alerts = () => w.mails.filter((m) => /not getting its changes/.test(m.subject)).length;
  assert.equal(alerts(), 0, "not yet: half an hour of grace");
  w.clock.ms += 31 * 60_000;
  await tick();
  assert.equal(alerts(), 1, "the owner is told");
  w.clock.ms += 5 * 60_000;
  await tick();
  assert.equal(alerts(), 1, "once a day, not every minute");

  w.site.generatedAt = new Date(w.clock.ms).toISOString(); // the build landed
  w.clock.ms += 60_000;
  assert.equal(await tick(), "idle", "the site has caught up");
  assert.deepEqual(await deployState(w.env.ctx), { pending: false, lastSentAt: (await deployState(w.env.ctx)).lastSentAt, attempts: 0, failingSince: null });
});

test("a rejected build hook leaves the change marked and is retried; a change made while a build was on its way is not lost", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: HELD_PROFILE });
  const owner = await w.signIn(OWNER);
  const id = ((await w.call("POST", "/admin", { cookie: owner, body: { action: "queue" } })).json.gms as any[])[0].id as string;
  const okFetch = w.env.fetcher;
  w.env.fetcher = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
  await w.call("POST", "/admin", { cookie: owner, body: { action: "review", kind: "gm", ids: [id], status: "approved" } });
  const { deployState, MIN_GAP_MS } = await import("../../worker/src/deploy.ts");
  assert.equal((await deployState(w.env.ctx)).pending, true, "the hook said no: still waiting");
  assert.ok((await deployState(w.env.ctx)).failingSince);
  w.env.fetcher = okFetch;
  w.clock.ms += MIN_GAP_MS + 1000;
  assert.equal((await w.call("POST", "/cron?job=tick", { origin: null, build: true })).json.result, "sent", "the next tick sends it");

  // a change made after the build was sent has its own mark: reaching the site with the first build does not clear it
  w.site.generatedAt = new Date(w.clock.ms).toISOString();
  w.clock.ms += 60_000;
  await w.call("POST", "/admin", { cookie: owner, body: { action: "review", kind: "gm", ids: [id], status: "rejected", reason: "x" } });
  assert.equal((await deployState(w.env.ctx)).pending, true, "the newer change is still waiting");
});

// ── publish first: the daily cap, the live data, the phone number on a tap, reports (ADR-48) ───────────────────────────

test("a profile may add ten new games a day, then it must wait", async () => {
  const { MAX_NEW_GAMES_PER_DAY } = await import("../../worker/src/store.ts");
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  let last = 0;
  for (let i = 0; i < MAX_NEW_GAMES_PER_DAY + 1; i++) last = (await w.call("POST", "/games", { cookie: gm, body: { ...GAME, title: `Game ${i}` } })).status;
  assert.equal(last, 409, "the eleventh in a day is refused");
  w.clock.ms += 25 * 3_600_000;
  assert.equal((await w.call("POST", "/games", { cookie: gm, body: { ...GAME, title: "Tomorrow" } })).status, 201, "and allowed again the next day");
});

test("the live data is public, cached for a few seconds at the edge, and never carries a phone number", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  await w.call("POST", "/games", { cookie: gm, body: GAME });
  const store = new Map<string, Response>();
  w.env.cache = {
    match: async (r) => store.get(r.url)?.clone(),
    put: async (r, res) => { store.set(r.url, res); },
  };
  const first = await w.call("GET", "/live");
  assert.equal(first.status, 200, "no key needed");
  assert.match(first.res.headers.get("Cache-Control") ?? "", /s-maxage=20/);
  assert.equal(first.json.games.length, 1);
  assert.equal(JSON.stringify(first.json).includes("whatsapp"), false);
  assert.equal(JSON.stringify(first.json).includes("81234567890"), false);
  await new Promise((r) => setTimeout(r, 20));
  await w.call("POST", "/games", { cookie: gm, body: { ...GAME, title: "A second game" } });
  assert.equal((await w.call("GET", "/live")).json.games.length, 1, "a second read inside the cache window is served from the cache");
  store.clear();
  assert.equal((await w.call("GET", "/live")).json.games.length, 2, "and a fresh one sees the new game");
});

test("a phone number is given only on a tap for a live Game Master, a few at a time, from the site itself", async () => {
  const { REVEALS_PER_IP_HOUR } = await import("../../worker/src/reports.ts");
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("GET", "/me", { cookie: gm })).json.profile.id as string;
  const ask = (gmId: unknown, ip = "203.0.113.5") => w.call("POST", "/contact", { body: { gm: gmId }, headers: { "CF-Connecting-IP": ip } });
  const ok = await ask(id);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.whatsapp, "6281234567890");
  assert.equal((await ask("nobody-here")).status, 404);
  assert.equal((await ask(42)).status, 404);
  assert.equal((await w.call("POST", "/contact", { body: { gm: id }, origin: "https://evil.example" })).status, 403, "only the site itself may ask");

  const other = await w.signIn("held@example.com");
  await w.call("PUT", "/profile", { cookie: other, body: { ...HELD_PROFILE, name: "Held One", whatsapp: "0811-1111-1111" } });
  const heldId = (await w.call("GET", "/me", { cookie: other })).json.profile.id as string;
  assert.equal((await ask(heldId, "203.0.113.6")).status, 404, "a held profile does not give its number");

  let refused = 0;
  for (let i = 0; i < REVEALS_PER_IP_HOUR + 5; i++) if ((await ask(id, "198.51.100.9")).status === 429) refused++;
  assert.ok(refused >= 5, "one address cannot collect numbers in bulk");
  assert.equal((await ask(id, "198.51.100.77")).status, 200, "another address is not affected");
});

test("three different visitors reporting a listing hold it for an admin's look; the decision clears the reports; one address counts once", async () => {
  const { REPORTS_TO_HOLD } = await import("../../worker/src/reports.ts");
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  const send = (ip: string, reason = "looks wrong") => w.call("POST", "/report", { body: { kind: "game", id, reason }, headers: { "CF-Connecting-IP": ip } });
  const live = async () => ((await w.call("GET", "/public", { build: true })).json.games as any[]).length;

  assert.equal((await send("203.0.113.1")).status, 200);
  assert.equal((await send("203.0.113.1")).status, 200, "the same address again is accepted but counts once");
  assert.equal((await send("203.0.113.2")).status, 200);
  assert.equal(await live(), 1, "two people are not enough");
  assert.equal(REPORTS_TO_HOLD, 3);
  assert.equal((await send("203.0.113.3")).status, 200);
  assert.equal(await live(), 0, "the third holds it back");
  assert.equal((await w.call("GET", "/me", { cookie: gm })).json.games[0].status, "pending");

  const admin = await w.signIn(OWNER);
  const queue = (await w.call("POST", "/admin", { cookie: admin, body: { action: "queue" } })).json;
  assert.equal(queue.games[0].reports, 3, "the admin sees how many people reported it");
  await w.call("POST", "/admin", { cookie: admin, body: { action: "review", kind: "game", ids: [id], status: "approved" } });
  assert.equal(await live(), 1, "an admin releases it");
  assert.equal((await send("203.0.113.4")).status, 200);
  assert.equal(await live(), 1, "the old reports were answered: one new report does not hold it again");

  assert.equal((await w.call("POST", "/report", { body: { kind: "game", id: "no-such-game" } })).status, 404);
  assert.equal((await w.call("POST", "/report", { body: { kind: "other", id } })).status, 400);
  assert.equal((await w.call("POST", "/report", { body: { kind: "game", id }, origin: "https://evil.example" })).status, 403);
});

test("a listing that has just gone live asks for a quick build; an edit waits for the long gap; quick builds stop after a day's worth", async () => {
  const { MIN_GAP_MS, URGENT_GAP_MS, URGENT_MAX_PER_DAY } = await import("../../worker/src/deploy.ts");
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  assert.equal(w.hook.length, 1, "a new profile builds at once");
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  w.site.generatedAt = new Date(w.clock.ms + 1000).toISOString();
  w.clock.ms += URGENT_GAP_MS + 1000;
  const tick = async () => (await w.call("POST", "/cron?job=tick", { origin: null, build: true })).json.result as string;
  assert.equal(await tick(), "sent", "a new game is on the site within ten minutes");
  w.site.generatedAt = new Date(w.clock.ms + 1000).toISOString();
  w.clock.ms += 60_000;
  await tick();
  await w.call("PUT", `/games/${id}`, { cookie: gm, body: { ...GAME, seats: 2 } });
  w.clock.ms += URGENT_GAP_MS + 1000;
  assert.equal(await tick(), "wait", "an edit is not worth a quick build");
  w.clock.ms += MIN_GAP_MS;
  assert.equal(await tick(), "sent", "it goes out with the long gap");
  assert.ok(URGENT_MAX_PER_DAY * URGENT_GAP_MS <= 24 * 3_600_000 * 5, "a sane budget of quick builds");
});

// ── what a player needs before asking for a seat (ADR-49) ───────────────────────────────────────────────────────────

test("a game must say what it warns about and which safety tools it uses; the session length and characters may be left out", () => {
  const NOW = Date.parse("2026-10-28T03:00:00Z");
  const ok = (patch: Record<string, unknown>) => parseGame({ ...GAME, ...patch }, NOW);
  assert.equal(ok({}).ok, true, "the fixture says no warnings and one tool");

  const noWarn = ok({ noWarnings: false, contentWarnings: "" });
  assert.ok(!noWarn.ok && noWarn.errors.contentWarnings === "required", "silence about warnings is not an answer");
  assert.equal(ok({ noWarnings: false, contentWarnings: "Death, gore" }).ok, true, "written warnings are an answer");
  const both = ok({ noWarnings: true, contentWarnings: "Death" });
  assert.ok(both.ok && both.value.noWarnings === false && both.value.contentWarnings === "Death", "warnings written down win over \"none\"");

  const noTool = ok({ safetyKeys: [], safetyTools: "" });
  assert.ok(!noTool.ok && noTool.errors.safetyTools === "required");
  assert.equal(ok({ safetyKeys: [], safetyTools: "We talk it through first" }).ok, true, "a described tool counts");
  const unknown = ok({ safetyKeys: ["x-card", "made-up"] });
  assert.ok(!unknown.ok && unknown.errors.safetyKeys === "invalid");
  assert.ok(!ok({ needs: ["mic", "jetpack"] }).ok);

  const bare = ok({ sessionHours: undefined, characters: undefined, needs: undefined });
  assert.ok(bare.ok && bare.value.sessionHours === 0 && bare.value.characters === "" && bare.value.needs.length === 0, "all three may be left out");
  assert.ok(!ok({ sessionHours: 0.5 }).ok && !ok({ sessionHours: 13 }).ok);
  assert.ok(!ok({ characters: "robots" }).ok);
  const full = ok({ sessionHours: "4", characters: "own", needs: ["mic", "camera", "mic"], safetyKeys: ["x-card", "lines-veils"] });
  assert.ok(full.ok && full.value.sessionHours === 4 && full.value.characters === "own" && full.value.needs.join() === "mic,camera" && full.value.safetyKeys.join() === "x-card,lines-veils");
});

test("the new details are saved, change the game like any other edit, and reach the public data with when it was last changed and since when the Game Master is a member", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const created = await w.call("POST", "/games", { cookie: gm, body: { ...GAME, sessionHours: 4, characters: "own", needs: ["mic", "camera"], safetyKeys: ["x-card", "session-zero"], noWarnings: false, contentWarnings: "Death" } });
  assert.equal(created.status, 201);
  const id = created.json.id as string;
  const pub = (await w.call("GET", "/live")).json;
  const g = pub.games.find((x: any) => x.id === id);
  assert.deepEqual([g.sessionHours, g.characters, g.needs, g.safetyKeys, g.noWarnings], [4, "own", ["mic", "camera"], ["x-card", "session-zero"], false]);
  assert.ok(g.updatedAt && g.listedAt);
  assert.ok(pub.gms[0].joinedAt, "the profile's age is public");
  const parsed = parsePublicData(pub);
  assert.deepEqual(parsed.warnings, []);
  assert.deepEqual(parsed.data.games[0]!.safetyKeys, ["x-card", "session-zero"]);

  const same = await w.call("PUT", "/games/" + id, { cookie: gm, body: { ...GAME, sessionHours: 4, characters: "own", needs: ["mic", "camera"], safetyKeys: ["x-card", "session-zero"], noWarnings: false, contentWarnings: "Death" } });
  assert.equal(same.json.changed, false, "the same details again change nothing");
  w.clock.ms += 60_000;
  const edited = await w.call("PUT", "/games/" + id, { cookie: gm, body: { ...GAME, sessionHours: 2, characters: "own", needs: ["mic", "camera"], safetyKeys: ["x-card", "session-zero"], noWarnings: false, contentWarnings: "Death" } });
  assert.equal(edited.json.changed, true, "only the session length changed, and it counts");
  const later = (await w.call("GET", "/live")).json.games.find((x: any) => x.id === id);
  assert.ok(Date.parse(later.updatedAt) > Date.parse(g.updatedAt), "the last-changed time moves");
  assert.equal(later.sessionHours, 2);
});

// ── on request, several places, five genres (ADR-52) ──────────────────────────────────────────────────────────────

test("a game on request needs no date: it is listed from now for 90 days; a dated game still needs its date", () => {
  const NOW = Date.parse("2026-10-28T03:00:00Z");
  const ok = (patch: Record<string, unknown>) => parseGame({ ...GAME, ...patch }, NOW);
  const ask = ok({ onDemand: true, date: "", time: "", keepUntil: "2027-12-31" });
  assert.ok(ask.ok);
  assert.equal(ask.ok && ask.value.onDemand, true);
  assert.equal(ask.ok && ask.value.startsAt, "2026-10-28T03:00:00.000Z", "listed from now");
  assert.equal(ask.ok && Date.parse(ask.value.expiresAt) - Date.parse(ask.value.startsAt), 90 * 86_400_000, "for 90 days; a keep-until date does not apply");
  const dated = ok({ date: "" });
  assert.ok(!dated.ok && dated.errors.date === "invalid_date");
});

test("an in-person game names one or more places; Jakarta comes in five parts, an older 'Jakarta' still counts, and anything else is refused", () => {
  const NOW = Date.parse("2026-10-28T03:00:00Z");
  const ok = (patch: Record<string, unknown>) => parseGame({ ...GAME, ...patch }, NOW);
  const two = ok({ cities: ["Jakarta Selatan", "Depok", "Depok"] });
  assert.ok(two.ok && two.value.cities.join() === "Jakarta Selatan,Depok" && two.value.city === "Jakarta Selatan", "deduplicated, the first is the city");
  const legacy = ok({ cities: undefined, city: "Jakarta" });
  assert.ok(legacy.ok && legacy.value.cities.join() === "Jakarta", "an older single city is still accepted");
  const none = ok({ cities: [], city: undefined });
  assert.ok(!none.ok && none.errors.cities === "choose_one");
  const odd = ok({ cities: ["Depok", "Bandung"] });
  assert.ok(!odd.ok && odd.errors.cities === "invalid", "outside the list");
  const online = ok({ locationType: "online", platform: "Discord", cities: ["Depok"] });
  assert.ok(online.ok && online.value.cities.length === 0 && online.value.city === "", "an online game has no place");
});

test("a game may have up to five genres", () => {
  const NOW = Date.parse("2026-10-28T03:00:00Z");
  const five = parseGame({ ...GAME, genres: ["horror", "mystery", "fantasy", "sci-fi", "cozy"] }, NOW);
  assert.ok(five.ok && five.value.genres.length === 5);
  const six = parseGame({ ...GAME, genres: ["horror", "mystery", "fantasy", "sci-fi", "cozy", "urban"] }, NOW);
  assert.ok(!six.ok && six.errors.genres === "invalid");
  const p = parsePublicData({ gms: [{ id: "m0test0001", slug: "test-gm", name: "Test", whatsapp: "6281", photoId: "" }], games: [{ id: "g0test0001", slug: "test-game", gmId: "m0test0001", title: "T", system: "S", format: "one_shot", locationType: "online", startsAt: "2027-01-01T00:00:00.000Z", expiresAt: "2027-01-02T00:00:00.000Z", zone: "WIB", priceIdr: 0, seats: 4, minAge: 0, genres: ["horror", "mystery", "fantasy", "sci-fi", "cozy", "urban"] }] });
  assert.equal(p.data.games[0]!.genres.length, 5, "the site's own check keeps five");
});

test("a game on request is public with its places, keeps its dates when saved again, and is the only kind that can be extended", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const ask = (await w.call("POST", "/games", { cookie: gm, body: { ...GAME, onDemand: true, cities: ["Jakarta Selatan", "Depok"] } })).json.id as string;
  const dated = (await w.call("POST", "/games", { cookie: gm, body: { ...GAME, title: "Pada Tanggal" } })).json.id as string;
  const pub = (await w.call("GET", "/live")).json;
  const g = (pub.games as any[]).find((x) => x.id === ask);
  assert.deepEqual([g.onDemand, g.cities, g.city], [true, ["Jakarta Selatan", "Depok"], "Jakarta Selatan"]);
  assert.deepEqual(parsePublicData(pub).warnings, []);
  assert.equal((pub.games as any[]).find((x) => x.id === dated).onDemand, false);

  w.clock.ms += 3_600_000;
  const same = await w.call("PUT", `/games/${ask}`, { cookie: gm, body: { ...GAME, onDemand: true, cities: ["Jakarta Selatan", "Depok"] } });
  assert.equal(same.json.changed, false, "saving it again an hour later changes nothing: its dates stay");

  const expires = () => (w.db.raw.prepare("SELECT expires_at FROM games WHERE id = ?").get(ask) as { expires_at: string }).expires_at;
  const was = expires();
  const ext = await w.call("POST", `/games/${ask}/extend`, { cookie: gm });
  assert.equal(ext.status, 200);
  assert.equal(Date.parse(expires()) - Date.parse(was), 30 * 86_400_000);
  assert.equal((await w.call("POST", `/games/${dated}/extend`, { cookie: gm })).status, 404, "a dated game is done after its date");
});

test("the Game Master of a game on request gets one email a few days before it runs out; extending it earns the next warning", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: { ...GAME, onDemand: true } })).json.id as string;
  await w.call("POST", "/games", { cookie: gm, body: { ...GAME, title: "Pada Tanggal" } });
  const tick = () => w.call("POST", "/cron?job=tick", { origin: null, build: true });
  const warnings = () => w.mails.filter((m) => /^Still running/.test(m.subject));
  const start = w.clock.ms;
  w.clock.ms = start + 80 * 86_400_000;
  await tick();
  assert.equal(warnings().length, 0, "plenty of time left");
  w.clock.ms = start + 88 * 86_400_000; // two days before the 90 run out
  await tick();
  await tick();
  assert.equal(warnings().length, 1, "once, and not for the dated game");
  assert.equal(warnings()[0]!.to, "raka@example.com");
  const back = await w.signIn("raka@example.com");
  await w.call("POST", `/games/${id}/extend`, { cookie: back });
  w.clock.ms = start + 118 * 86_400_000;
  await tick();
  assert.equal(warnings().length, 2, "extended, so the next run-out is warned about too");
});
