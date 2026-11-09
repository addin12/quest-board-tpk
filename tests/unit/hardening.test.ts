/* eslint-disable @typescript-eslint/no-explicit-any */
// Regression tests for the second security review (2026-11-07): each test is one thing a person could do that the backend now refuses or survives.
import assert from "node:assert/strict";
import { test } from "node:test";
import { handle } from "../../worker/src/handler.ts";
import { MAX_TOMBSTONES } from "../../worker/src/public.ts";
import { NUDGE_RETRY_MS, digestReviewers, nudgeExpiring } from "../../worker/src/watch.ts";
import { MAX_LISTED_AHEAD_DAYS } from "../../src/lib/on-demand.ts";
import { DAY_MS } from "../../worker/src/util.ts";
import { GAME, HELD_PROFILE, OWNER, PROFILE, WEBP, makeWorld } from "../support/worker-env.ts";

type World = ReturnType<typeof makeWorld>;
const admin = (w: World, cookie: string, body: Record<string, unknown>) => w.call("POST", "/admin", { cookie, body });
const count = (w: World, sql: string, ...v: unknown[]) => (w.db.raw.prepare(sql).get(...(v as never[])) as { n: number }).n;
const reportFrom = (w: World, ip: string, id: string) =>
  w.call("POST", "/report", { body: { kind: "game", id, reason: "scam" }, headers: { "CF-Connecting-IP": ip } });

test("a listing held back after reports stays held when its Game Master edits it", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  for (const ip of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) await reportFrom(w, ip, id);
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM games WHERE id = ? AND status = 'pending'", id), 1, "three people held it");
  const edited = await w.call("PUT", `/games/${id}`, { cookie: gm, body: { ...GAME, title: "Mercusuar yang Lain" } });
  assert.equal(edited.status, 200);
  assert.equal(edited.json.status, "pending", "editing does not bring it back");
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM games WHERE id = ? AND status = 'approved'", id), 0);
  const owner = await w.signIn(OWNER);
  await admin(w, owner, { action: "review", kind: "game", ids: [id], status: "approved" });
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM games WHERE id = ? AND status = 'approved'", id), 1, "an admin can");
});

test("a picture of someone else cannot be used, and a file another record still shows is never deleted", async () => {
  const w = makeWorld();
  const a = await w.signIn("a@example.com");
  const b = await w.signIn("b@example.com");
  await w.call("PUT", "/profile", { cookie: a, body: PROFILE });
  await w.call("PUT", "/profile", { cookie: b, body: { ...PROFILE, name: "Bima Saputra", whatsapp: "0811-1111-2222" } });
  const cover = (await w.call("POST", "/images?kind=cover", { cookie: a, raw: WEBP })).json.key as string;
  await w.call("POST", "/games", { cookie: a, body: { ...GAME, coverKey: cover } });
  const taken = await w.call("POST", "/games", { cookie: b, body: { ...GAME, coverKey: cover } });
  assert.equal(taken.status, 422, "B cannot point a game at A's file");
  assert.equal(taken.json.fields.coverKey, "invalid");
  const photo = await w.call("PUT", "/profile", { cookie: b, body: { ...PROFILE, name: "Bima Saputra", whatsapp: "0811-1111-2222", photoKey: cover } });
  assert.equal(photo.status, 422);
  assert.ok(w.bucket.keys().includes(cover), "A's file is still there");
});

test("a file shared by two records of one account survives until the last one lets go", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const shared = (await w.call("POST", "/images?kind=cover", { cookie: gm, raw: WEBP })).json.key as string;
  const g1 = (await w.call("POST", "/games", { cookie: gm, body: { ...GAME, coverKey: shared } })).json.id as string;
  await w.call("POST", "/games", { cookie: gm, body: { ...GAME, title: "Kedua", coverKey: shared } });
  await w.call("PUT", `/games/${g1}`, { cookie: gm, body: { ...GAME, coverKey: "" } });
  assert.ok(w.bucket.keys().includes(shared), "the other game still shows it");
});

test("a date or an end date far in the future is refused, and Extend has a ceiling", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const far = await w.call("POST", "/games", { cookie: gm, body: { ...GAME, date: "2031-01-01" } });
  assert.equal(far.status, 422);
  assert.equal(far.json.fields.date, "invalid_date");
  const forever = await w.call("POST", "/games", { cookie: gm, body: { ...GAME, keepUntil: "9999-12-31" } });
  assert.equal(forever.status, 422);
  assert.equal(forever.json.fields.keepUntil, "invalid_date");

  const id = (await w.call("POST", "/games", { cookie: gm, body: { ...GAME, onDemand: true } })).json.id as string;
  let until = "";
  for (let i = 0; i < 25; i++) until = (await w.call("POST", `/games/${id}/extend`, { cookie: gm })).json.expiresAt as string;
  assert.ok(Date.parse(until) <= w.clock.ms + MAX_LISTED_AHEAD_DAYS * DAY_MS, `pressing Extend 25 times ends at ${until}`);
  assert.ok(until.startsWith("20"), "and the stored text still sorts as a date");
});

test("a merge never publishes a game of a profile that was not live, and a request does not outlive the admin who asked", async () => {
  const w = makeWorld();
  const owner = await w.signIn(OWNER);
  const real = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: real, body: PROFILE });
  const dup = await w.signIn("raka.second@example.com");
  await w.call("PUT", "/profile", { cookie: dup, body: { ...PROFILE, name: "Raka Duplicate" } });
  const gameId = (await w.call("POST", "/games", { cookie: dup, body: GAME })).json.id as string;
  const gms = (await admin(w, owner, { action: "queue" })).json.gms as any[];
  const from = gms.find((g) => g.name === "Raka Duplicate").id as string;
  const into = gms.find((g) => g.name === "Raka Pratama").id as string;
  await admin(w, owner, { action: "review", kind: "gm", ids: [from], status: "rejected", reason: "spam" });
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM games WHERE id = ? AND status = 'approved'", gameId), 1, "the game itself was approved before");

  assert.equal((await admin(w, owner, { action: "merge", fromId: from, intoId: into })).status, 200);
  const offer = ((await w.call("GET", "/me", { cookie: real })).json.mergeOffers as any[])[0];
  assert.equal((await w.call("POST", "/merge/respond", { cookie: real, body: { id: offer.id, accept: true } })).status, 200);
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM games WHERE id = ? AND status = 'pending'", gameId), 1, "it waits for an admin's look under its new profile");

  // an admin asks, then loses the role: the request is gone, and one that is somehow left cannot be accepted
  const helper = await w.signIn("helper@example.com");
  await admin(w, owner, { action: "admin.add", email: "helper@example.com" });
  const one = await w.signIn("one@example.com");
  await w.call("PUT", "/profile", { cookie: one, body: { ...PROFILE, name: "One", whatsapp: "0811-2222-3333" } });
  const two = await w.signIn("two@example.com");
  await w.call("PUT", "/profile", { cookie: two, body: { ...PROFILE, name: "Two", whatsapp: "0811-2222-3333" } });
  const all = (await admin(w, owner, { action: "queue" })).json.gms as any[];
  const oneId = all.find((g) => g.name === "One").id as string;
  const twoId = all.find((g) => g.name === "Two").id as string;
  assert.equal((await admin(w, helper, { action: "merge", fromId: oneId, intoId: twoId })).status, 200);
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM merge_requests WHERE requested_by = 'helper@example.com'"), 1);
  await admin(w, owner, { action: "admin.remove", email: "helper@example.com" });
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM merge_requests WHERE requested_by = 'helper@example.com'"), 0, "removing the admin takes their requests with them");

  assert.equal((await admin(w, owner, { action: "merge", fromId: oneId, intoId: twoId })).status, 200);
  w.db.raw.prepare("UPDATE merge_requests SET requested_by = 'ghost@example.com'").run();
  const pending = ((await w.call("GET", "/me", { cookie: two })).json.mergeOffers as any[])[0];
  assert.equal((await w.call("POST", "/merge/respond", { cookie: two, body: { id: pending.id, accept: true } })).status, 404, "a request from someone who is no longer an admin cannot be accepted");
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM profiles WHERE name = 'One'"), 1, "nothing moved");
});

test("a request body larger than the limit is refused, whether it is JSON or a picture", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  const big = await w.call("PUT", "/profile", { cookie: gm, body: { ...PROFILE, bio: "x".repeat(200_000) } });
  assert.equal(big.status, 400, "a 200 KB profile is not read");
  const huge = new Uint8Array(1_600_000);
  huge.set(new Uint8Array(WEBP));
  assert.equal((await w.call("POST", "/images?kind=cover", { cookie: gm, raw: huge.buffer })).status, 413);
  assert.equal((await w.call("PUT", "/profile", { cookie: gm, body: PROFILE })).status, 200, "an ordinary save still works");
  // a stream with no length, as a client may send it, is cut off at the limit as well
  const stream = new ReadableStream({ start(c) { for (let i = 0; i < 40; i++) c.enqueue(new TextEncoder().encode(" ".repeat(10_000))); c.close(); } });
  const res = await handle(new Request(`${w.env.ctx.siteUrl}/api/login/request`, { method: "POST", headers: { Origin: w.env.ctx.siteUrl, "Content-Type": "application/json" }, body: stream, duplex: "half" } as RequestInit), w.env);
  assert.equal(res.status, 400);
});

test("a warning about a game that is running out is tried again when the mail fails, and digests leave room for it", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: { ...GAME, onDemand: true } })).json.id as string;
  w.db.raw.prepare("UPDATE games SET expires_at = ? WHERE id = ?").run(new Date(w.clock.ms + 2 * DAY_MS).toISOString(), id);
  const real = w.env.ctx.mailer;
  w.env.ctx.mailer = { send: async () => { throw new Error("mail_budget_notice"); } };
  const before = w.mails.length;
  await nudgeExpiring(w.env.ctx);
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM games WHERE id = ? AND nudged_at = ''", id), 1, "the note that it was sent is taken off again");
  w.env.ctx.mailer = real;
  await nudgeExpiring(w.env.ctx);
  assert.equal(w.mails.length, before, "and it is not tried again every minute");
  w.clock.ms += NUDGE_RETRY_MS + 1000;
  await nudgeExpiring(w.env.ctx);
  assert.equal(w.mails.length, before + 1, "but half an hour later it goes out");
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM games WHERE id = ? AND nudged_at != ''", id), 1);

  // digests: with most of the day's notice mails used, a digest waits instead of using the rest
  const w2 = makeWorld();
  const g2 = await w2.signIn("raka@example.com");
  await w2.call("PUT", "/profile", { cookie: g2, body: HELD_PROFILE });
  w2.clock.ms += 11 * 60_000;
  const insert = w2.db.raw.prepare("INSERT INTO rate_events (key, at) VALUES ('mail:notice', ?)");
  for (let i = 0; i < 14; i++) insert.run(w2.clock.ms - i * 1000);
  const mails2 = w2.mails.length;
  await digestReviewers(w2.env.ctx);
  assert.equal(w2.mails.length, mails2, "six left of twenty: the digest keeps out of the way of the warnings");
  w2.db.raw.prepare("DELETE FROM rate_events WHERE key = 'mail:notice'").run();
  await digestReviewers(w2.env.ctx);
  assert.equal(w2.mails.length, mails2 + 1, "with the share free it is sent");
});

test("an admin cannot erase their own account (it would blank the record of their decisions); anyone else can", async () => {
  const w = makeWorld();
  const owner = await w.signIn(OWNER);
  assert.equal((await w.call("DELETE", "/account", { cookie: owner })).status, 403);
  await admin(w, owner, { action: "admin.add", email: "helper@example.com" });
  const helper = await w.signIn("helper@example.com");
  const refused = await w.call("DELETE", "/account", { cookie: helper });
  assert.equal(refused.status, 403);
  assert.equal(refused.json.error, "admin_account");
  assert.equal(count(w, "SELECT COUNT(*) AS n FROM accounts WHERE email = 'helper@example.com'"), 1);
  const gm = await w.signIn("raka@example.com");
  assert.equal((await w.call("DELETE", "/account", { cookie: gm })).status, 200);
});

test("the build keeps at most MAX_TOMBSTONES notices for games that are gone, the newest ones", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const id = (await w.call("POST", "/games", { cookie: gm, body: GAME })).json.id as string;
  w.db.raw.prepare("CREATE TEMP TABLE t AS SELECT * FROM games WHERE id = ?").run(id);
  w.db.raw.prepare("DELETE FROM games WHERE id = ?").run(id);
  const total = MAX_TOMBSTONES + 50;
  for (let i = 0; i < total; i++) {
    w.db.raw.prepare("UPDATE t SET id = ?, slug = ?, removed = 1, was_live = 1, gone_at = ?").run(`g${i}`, `gone-${i}`, new Date(w.clock.ms - i * 1000).toISOString());
    w.db.raw.prepare("INSERT INTO games SELECT * FROM t").run();
  }
  const pub = (await w.call("GET", "/public", { build: true })).json;
  assert.equal(pub.goneGames.length, MAX_TOMBSTONES);
  assert.ok(pub.goneGames.includes("gone-0"), "the newest is kept");
  assert.equal(pub.goneGames.includes(`gone-${total - 1}`), false, "the oldest is dropped");
});
