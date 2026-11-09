/* eslint-disable @typescript-eslint/no-explicit-any */
// A Game Master's WhatsApp number can be verified by an admin (they sent a code from it), and a person whose number was listed by someone else can say so.
import assert from "node:assert/strict";
import { test } from "node:test";
import { OWNER, PROFILE, makeWorld } from "../support/worker-env.ts";

type World = ReturnType<typeof makeWorld>;
const admin = (w: World, cookie: string, body: Record<string, unknown>) => w.call("POST", "/admin", { cookie, body });
const gmsOf = async (w: World, owner: string) => (await admin(w, owner, { action: "queue" })).json.gms as any[];
const publicGm = async (w: World) => ((await w.call("GET", "/public", { build: true })).json.gms as any[])[0];

test("an admin verifies a number, the badge reaches the public data, and changing the number takes it away", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const owner = await w.signIn(OWNER);
  const [rec] = await gmsOf(w, owner);
  assert.equal(rec.numberVerified, false);
  assert.match(rec.verifyCode, /^QB-[A-Z0-9]{5}$/);
  assert.equal((await w.call("GET", "/me", { cookie: gm })).json.profile.verifyCode, rec.verifyCode, "the Game Master sees the code to send");
  assert.equal((await publicGm(w)).verified, undefined, "nothing public before a check");

  assert.equal((await admin(w, owner, { action: "verify", id: rec.id, verified: true, number: "6281200000099" })).json.error, "stale", "a number the admin did not look at is not confirmed");
  const ok = await admin(w, owner, { action: "verify", id: rec.id, verified: true, number: rec.whatsapp });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.publishing, true, "the badge is on the public pages: a build is asked for");
  assert.equal((await publicGm(w)).verified, true);
  assert.equal((await w.call("GET", "/me", { cookie: gm })).json.profile.numberVerified, true);

  await w.call("PUT", "/profile", { cookie: gm, body: { ...PROFILE, whatsapp: "0811-5555-6666" } });
  assert.equal((await w.call("GET", "/me", { cookie: gm })).json.profile.numberVerified, false, "a new number is not the one that was checked");
  assert.equal((await publicGm(w)).verified, undefined);

  await admin(w, owner, { action: "verify", id: rec.id, verified: true, number: "628115555666" + "6" });
  const again = (await gmsOf(w, owner))[0];
  assert.equal(again.numberVerified, true);
  assert.equal((await admin(w, owner, { action: "verify", id: rec.id, verified: false })).status, 200);
  assert.equal((await gmsOf(w, owner))[0].numberVerified, false, "an admin can take it back");
});

test("only an admin can verify, and a Game Master cannot do it for themself", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const owner = await w.signIn(OWNER);
  const [rec] = await gmsOf(w, owner);
  assert.equal((await admin(w, gm, { action: "verify", id: rec.id, verified: true, number: rec.whatsapp })).status, 403);
  assert.equal((await gmsOf(w, owner))[0].numberVerified, false);
});

test("one report saying the number is not theirs holds an unverified profile, but not a verified one", async () => {
  const w = makeWorld();
  const gm = await w.signIn("raka@example.com");
  await w.call("PUT", "/profile", { cookie: gm, body: PROFILE });
  const owner = await w.signIn(OWNER);
  const [rec] = await gmsOf(w, owner);
  const report = (ip: string, extra: Record<string, unknown>) => w.call("POST", "/report", { body: { kind: "gm", id: rec.id, reason: "x", ...extra }, headers: { "CF-Connecting-IP": ip } });
  const status = () => (w.db.raw.prepare("SELECT status FROM profiles WHERE id = ?").get(rec.id) as { status: string }).status;

  await report("1.1.1.1", {});
  assert.equal(status(), "approved", "an ordinary report needs three people");

  await admin(w, owner, { action: "verify", id: rec.id, verified: true, number: rec.whatsapp });
  await report("2.2.2.2", { notMyNumber: true });
  assert.equal(status(), "approved", "a verified number: the Game Master has shown it is theirs");

  await admin(w, owner, { action: "verify", id: rec.id, verified: false });
  await report("3.3.3.3", { notMyNumber: true });
  assert.equal(status(), "pending", "an unverified number is held for an admin's look at once");
  const why = (w.db.raw.prepare("SELECT detail FROM activity WHERE kind = 'held' ORDER BY id DESC").get() as { detail: string }).detail;
  assert.match(why, /not theirs/, "and the admin is told why in the activity log");
  assert.equal((await w.call("GET", "/public", { build: true })).json.gms.length, 0, "it is off the site until then");
});
