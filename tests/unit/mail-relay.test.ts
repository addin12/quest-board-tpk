/* eslint-disable @typescript-eslint/no-explicit-any */
// The mail relay (apps-script/Code.gs) runs in a vm sandbox with none of the browser or Node globals, like Apps Script itself,
// against fake Google services.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SECRET = "s".repeat(40);
const source = readFileSync(new URL("../../apps-script/Code.gs", import.meta.url), "utf8");
const plain = <T = any>(v: unknown): T => JSON.parse(JSON.stringify(v));

/** Code.gs with fake services; `secret` replaces the placeholder the way scripts/push-apps-script.mjs does. */
function load(secret: string | null = SECRET, opts: { sendFails?: boolean; triggers?: string[] } = {}) {
  const sent: any[] = [];
  const props: Record<string, string> = {};
  const triggers = [...(opts.triggers ?? [])];
  const ctx: any = vm.createContext({
    console: { error: () => {} },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null, setProperty: (k: string, v: string) => { props[k] = v; } }) },
    Utilities: { formatDate: () => "2026-10-30" },
    MailApp: { sendEmail: (m: any) => { if (opts.sendFails) throw new Error("quota"); sent.push(m); } },
    ScriptApp: { getProjectTriggers: () => [...triggers], deleteTrigger: (t: string) => { triggers.splice(triggers.indexOf(t), 1); } },
  });
  vm.runInContext(secret === null ? source : source.replace("'__MAIL_SECRET__'", JSON.stringify(secret)), ctx);
  const post = (body: unknown) => JSON.parse(ctx.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } }).text);
  return { ctx, sent, props, triggers, post };
}

const ok = { action: "mail", secret: SECRET, to: "Raka@Example.com", subject: "Hi\nthere", body: "Link: https://x.example" };

test("the mail relay: off until it has a secret, and only for the right secret, one plain address and a message", () => {
  const { ctx } = load();
  const send = (req: object, secret = SECRET, sent = 0) => plain<any>(ctx.mailRequest_(req, secret, sent));
  assert.deepEqual(send(ok), { to: "raka@example.com", subject: "Hi there", body: "Link: https://x.example" });
  assert.equal(send(ok, "__MAIL_SECRET__").error, "mail_not_configured", "the placeholder keeps the relay off");
  assert.equal(send({ ...ok, secret: "wrong" }).error, "unauthorized");
  assert.equal(send({ ...ok, to: "a@example.com,b@example.com" }).error, "bad_request", "one recipient only");
  assert.equal(send({ ...ok, body: "" }).error, "bad_request");
  assert.equal(send(ok, SECRET, 90).error, "quota");
});

test("doPost sends the mail, counts it for the day, and stops at the limit", () => {
  const w = load();
  assert.deepEqual(w.post(ok), { ok: true });
  assert.equal(w.sent.length, 1);
  assert.deepEqual(plain(w.sent[0]), { to: "raka@example.com", subject: "Hi there", body: "Link: https://x.example", name: "Quest Board TPK" });
  assert.equal(w.props.MAIL_DAY, "2026-10-30:1");
  w.props.MAIL_DAY = "2026-10-30:90";
  assert.deepEqual(w.post(ok), { ok: false, error: "quota" });
  w.props.MAIL_DAY = "2026-10-29:90";
  assert.deepEqual(w.post(ok), { ok: true }, "a new day starts again at zero");
});

test("doPost answers errors as JSON and never sends without the secret or on a bad request", () => {
  const w = load();
  assert.deepEqual(w.post("not json"), { ok: false, error: "bad_request" });
  assert.deepEqual(w.post({ action: "public" }), { ok: false, error: "bad_request" }, "the old Sheet actions are gone");
  assert.deepEqual(w.post({ ...ok, secret: "nope" }), { ok: false, error: "unauthorized" });
  assert.deepEqual(load(null).post(ok), { ok: false, error: "mail_not_configured" });
  assert.equal(w.sent.length, 0);
  assert.deepEqual(load(SECRET, { sendFails: true }).post(ok), { ok: false, error: "mail_failed" });
});

test("doGet only says the relay is there", () => {
  const out = JSON.parse(load().ctx.doGet().text);
  assert.deepEqual([out.ok, out.name], [true, "quest-board-tpk-mail"]);
});

test("the old Sheet triggers remove themselves: any of the three stubs deletes every trigger", () => {
  for (const stub of ["tick", "nightly", "backup"]) {
    const w = load(SECRET, { triggers: ["t1", "t2", "t3"] });
    w.ctx[stub]();
    assert.deepEqual(w.triggers, [], `${stub} clears the project's triggers`);
  }
});
