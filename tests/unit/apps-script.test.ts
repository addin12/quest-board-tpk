/* eslint-disable @typescript-eslint/no-explicit-any */
// The Google Sheet's script (apps-script/Code.gs) is the whole backend. It runs in a vm sandbox with none of the
// browser or Node globals (like Apps Script itself: no URL class, no fetch), against an in-memory sheet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { GENRES, STYLES } from "../../src/lib/categories.ts";
import { makeT } from "../../src/lib/i18n/dict.ts";
import { optionsMarkdown, patchedForms, patchedScript } from "../../scripts/build-form-options.mjs";
import { GAME_COLS, GAME_FORM, GM_FORM, call, constant as constantOf, fixture, loadScript, makeDeps, makeRow, makeStore, plain } from "../support/fake-sheet.ts";

const ctx = loadScript();

test("the script knows exactly the genres and play styles of the site, by the names the form shows", () => {
  assert.deepEqual([...constantOf<string[]>(ctx, "GENRE_KEYS")].sort(), GENRES.map((g) => g.key).sort());
  assert.deepEqual([...constantOf<string[]>(ctx, "STYLE_KEYS")].sort(), STYLES.map((s) => s.key).sort());
  const t = makeT("en");
  const labels = { ...constantOf<Record<string, string>>(ctx, "GENRE_LABELS"), ...constantOf<Record<string, string>>(ctx, "STYLE_LABELS") };
  for (const g of GENRES) assert.equal(labels[t(`genre.${g.key}` as never)], g.key);
  for (const s of STYLES) assert.equal(labels[t(`style.${s.key}` as never)], s.key);
  assert.ok(!Object.keys(labels).some((l) => l.includes(",")), "a checkbox answer is a comma-separated list, so no option may contain a comma");
});

test("the generated parts (Code.gs's labels, docs/form-options.md) are up to date: run npm run form-options", () => {
  const gs = readFileSync(new URL("../../apps-script/Code.gs", import.meta.url), "utf8");
  assert.equal(patchedScript(gs), gs);
  assert.equal(readFileSync(new URL("../../docs/form-options.md", import.meta.url), "utf8"), optionsMarkdown());
  const forms = readFileSync(new URL("../../apps-script/CreateForms.gs", import.meta.url), "utf8");
  assert.equal(patchedForms(forms), forms);
});

test("CreateForms.gs asks exactly the questions Code.gs reads (bar the two file uploads), with the site's own options", () => {
  type Rec = Record<string, unknown[]>;
  const made: { form: Rec; items: Rec[] }[] = [];
  const chain = (rec: Rec, onItem?: (item: Rec) => void): any =>
    new Proxy(rec, {
      get: (_t, name: string) => {
        if (name === "build") return () => ({});
        if (/^add\w+Item$/.test(name)) return () => { const item: Rec = {}; onItem?.(item); return chain(item); };
        if (name === "getId" || name === "getTitle") return () => `${name}:${String(rec.create?.[0] ?? "")}`;
        if (/^get\w*Url$/.test(name)) return () => "https://example.test/";
        return (...args: unknown[]) => { rec[name] = args; return chain(rec, onItem); };
      },
    });
  const sandbox = vm.createContext({
    Logger: { log: () => {} },
    FormApp: {
      DestinationType: { SPREADSHEET: "SPREADSHEET" },
      create: (title: string) => { const entry = { form: { create: [title] } as Rec, items: [] as Rec[] }; made.push(entry); return chain(entry.form, (i) => entry.items.push(i)); },
      createTextValidation: () => chain({}),
      createParagraphTextValidation: () => chain({}),
      createCheckboxValidation: () => chain({}),
    },
    SpreadsheetApp: { create: () => ({ getId: () => "sheet", getUrl: () => "https://example.test/", getSheets: () => [], getSheetByName: () => null }), flush: () => {} },
  });
  vm.runInContext(readFileSync(new URL("../../apps-script/CreateForms.gs", import.meta.url), "utf8"), sandbox);
  (sandbox as any).createForms();

  const titles = (i: number) => made[i].items.map((it) => String(it.setTitle?.[0]));
  const uploads = { gm: "Photo", game: "Cover image (4:5 portrait)" };
  const expectTitles = (cols: Record<string, string>, upload: string) => Object.values(cols).filter((c) => c !== upload).sort();
  assert.deepEqual(titles(0).sort(), expectTitles(constantOf(ctx, "GM_COLUMNS"), uploads.gm));
  assert.deepEqual(titles(1).sort(), expectTitles(GAME_COLS, uploads.game));

  const choices = (title: string) => plain<string[]>(made[1].items.find((it) => it.setTitle?.[0] === title)?.setChoiceValues?.[0]);
  assert.deepEqual(choices("Genres (pick up to 3)"), Object.keys(constantOf(ctx, "GENRE_LABELS")));
  assert.deepEqual(choices("Play styles (pick up to 3)"), Object.keys(constantOf(ctx, "STYLE_LABELS")));
  assert.ok(choices("Game system").includes("Other"));
});

test("phone numbers become digits with the country code; anything else is dropped", () => {
  const p = ctx.normalizePhone_;
  assert.equal(p("0812-3456-7890"), "6281234567890");
  assert.equal(p("+62 812 3456 7890"), "6281234567890");
  assert.equal(p("6281234567890"), "6281234567890");
  assert.equal(p("0062 812 3456 7890"), "6281234567890");
  assert.equal(p("+1 (415) 555-0100"), "14155550100");
  assert.equal(p("call me"), "");
  assert.equal(p("123"), "");
});

test("Discord: usernames and invite links only", () => {
  const d = ctx.normalizeDiscord_;
  assert.equal(d("@Raka_GM"), "raka_gm");
  assert.equal(d("https://discord.gg/abc123?x=1"), "https://discord.gg/abc123");
  assert.equal(d("https://discord.com/invite/abc123"), "https://discord.com/invite/abc123");
  assert.equal(d("https://evil.example/invite/abc"), "");
  assert.equal(d("http://discord.gg/abc"), "");
  assert.equal(d("has space"), "");
  assert.equal(d(""), "");
});

test("Google Maps links: the Share links and google.com/maps only, with no URL class available", () => {
  const m = ctx.isGoogleMapsUrl_;
  assert.equal(m("https://maps.app.goo.gl/AbC123"), true);
  assert.equal(m("https://www.google.com/maps/place/Kumu+Ground+Coffee"), true);
  assert.equal(m("https://goo.gl/maps/abc"), true);
  assert.equal(m("https://maps.google.co.id/?q=x"), true);
  assert.equal(m("https://evil.example/maps/x"), false);
  assert.equal(m("http://maps.app.goo.gl/AbC123"), false);
  assert.equal(m("https://user:pw@maps.app.goo.gl/AbC123"), false);
  assert.equal(m("https://maps.app.goo.gl:8443/AbC123"), false);
  assert.equal(m("https://maps.app.goo.gl/ab c"), false);
  assert.equal(m("javascript:alert(1)"), false);
});

test("the sheet's en_US date and time cells, and 24-hour entries, become the instant they mean", () => {
  assert.equal(ctx.parseDate_("9/28/2026"), "2026-09-28");
  assert.equal(ctx.parseDate_("2026-09-28"), "2026-09-28");
  assert.equal(ctx.parseDate_("2/30/2026"), "");
  assert.equal(ctx.parseDate_("tomorrow"), "");
  assert.equal(ctx.parseTime_("7:00:00 PM"), "19:00");
  assert.equal(ctx.parseTime_("12:30 AM"), "00:30");
  assert.equal(ctx.parseTime_("12:00:00 PM"), "12:00");
  assert.equal(ctx.parseTime_("19.00"), "19:00");
  assert.equal(ctx.parseTime_("25:00"), "");
  assert.equal(ctx.toStartsAt_("10/12/2026", "7:00:00 PM", "WIB"), "2026-10-12T12:00:00.000Z");
  assert.equal(ctx.toStartsAt_("10/12/2026", "7:00:00 PM", "WITA"), "2026-10-12T11:00:00.000Z");
  assert.equal(ctx.toStartsAt_("10/12/2026", "7:00:00 PM", "WIT"), "2026-10-12T10:00:00.000Z");
  assert.equal(ctx.toStartsAt_("", "7:00 PM", "WIB"), "");
});

test("category labels from the form map back to keys; unknown ones and extras are dropped", () => {
  const genres = constantOf(ctx, "GENRE_LABELS");
  const styles = constantOf(ctx, "STYLE_LABELS");
  assert.deepEqual(plain(ctx.categoryKeys_("Dark fantasy, Horror, Urban fantasy, Nonsense, Cozy", genres)), ["dark-fantasy", "horror", "urban"]);
  assert.deepEqual(plain(ctx.categoryKeys_("horror, HORROR, Mystery", genres)), ["horror", "mystery"], "case doesn't matter, repeats count once");
  assert.deepEqual(plain(ctx.categoryKeys_("Rule of cool, Theater of the mind, Puzzles & mysteries, Hexcrawl & exploration", styles)), ["rule-of-cool", "theater-of-mind", "puzzle-mystery"], "at most three");
});

test("Drive file ids come out of upload answers", () => {
  assert.equal(ctx.driveId_("https://drive.google.com/open?id=1AbC_dEfGhIjKlMn-op"), "1AbC_dEfGhIjKlMn-op");
  assert.equal(ctx.driveId_("https://drive.google.com/file/d/1AbC_dEfGhIjKlMn-op/view, https://drive.google.com/open?id=other_file_id_xyz"), "1AbC_dEfGhIjKlMn-op");
  assert.equal(ctx.driveId_(""), "");
});

test("new responses get an id, a slug and a pending status; syncing again changes nothing", () => {
  const { store, deps } = fixture();
  const first = plain(ctx.sync_(store, deps.now()));
  assert.deepEqual(first.newPending.map((p: any) => p.kind).sort(), ["game", "gm"]);
  const game = store.load("game")[0];
  assert.match(game.cells.Id, /^g[a-z0-9]{8}$/);
  assert.equal(game.cells.Status, "pending");
  assert.match(game.cells.Slug, /^mercusuar-di-pulau-kabut-[a-z0-9]{4}$/);
  assert.equal(store.shared["1AbC_dEfGhIjKlMn-op"], true, "a new cover is viewable by link at once, so every admin can see it while reviewing");
  const second = plain(ctx.sync_(store, deps.now()));
  assert.deepEqual(second, { newPending: [], edited: 0, dirty: false });
});

test("a GM who edits an approved response sends it back to review and it leaves the public site", () => {
  const { store, deps } = fixture();
  ctx.sync_(store, deps.now());
  const id = store.load("game")[0].cells.Id;
  store.update("game", 2, { Status: "approved" });
  store.update("gm", 2, { Status: "approved" });
  assert.equal(plain(ctx.buildPublic_(ctx.loadRecords_(store, "game"), ctx.loadRecords_(store, "gm"), deps.now())).games.length, 1);
  // the GM edits the title through the form's edit link
  store.update("game", 2, { [GAME_COLS.title]: "Mercusuar (edited)" });
  const result = plain(ctx.sync_(store, deps.now()));
  assert.equal(result.edited, 1);
  assert.equal(result.dirty, true);
  assert.equal(store.load("game")[0].cells.Status, "pending");
  assert.equal(store.load("game")[0].cells.Id, id, "same listing, same id");
  assert.equal(plain(ctx.buildPublic_(ctx.loadRecords_(store, "game"), ctx.loadRecords_(store, "gm"), deps.now())).games.length, 0);
});

test("the public data holds only approved, unexpired games of approved GMs, with public fields only", () => {
  const { store, deps } = fixture();
  ctx.sync_(store, deps.now());
  const build = () => plain(ctx.buildPublic_(ctx.loadRecords_(store, "game"), ctx.loadRecords_(store, "gm"), deps.now()));
  assert.deepEqual([build().games.length, build().gms.length], [0, 0], "pending is invisible");
  store.update("game", 2, { Status: "approved" });
  assert.equal(build().games.length, 0, "the GM is not approved yet");
  store.update("gm", 2, { Status: "approved" });
  const data = build();
  assert.equal(data.games.length, 1);
  const g = data.games[0];
  assert.equal(g.startsAt, "2026-10-12T12:00:00.000Z");
  assert.equal(g.expiresAt, "2026-10-13T12:00:00.000Z");
  assert.equal(g.priceIdr, 75000);
  assert.equal(g.language, "both");
  assert.equal(g.level, "beginner");
  assert.deepEqual(g.genres, ["horror", "eldritch-horror"]);
  assert.equal(g.venueMapsUrl, "https://maps.app.goo.gl/Kumu");
  assert.equal(g.coverId, "1AbC_dEfGhIjKlMn-op");
  assert.equal(data.gms[0].whatsapp, "6281234567890");
  assert.equal(data.gms[0].discord, "raka_gm");
  const text = JSON.stringify(data);
  for (const secret of ["gm@example.com", "adminNote", "reviewedBy", "rejectReason", "email", "hash", "Hash"]) assert.ok(!text.includes(secret), `the public data must not contain ${secret}`);
  // expired
  const late = plain(ctx.buildPublic_(ctx.loadRecords_(store, "game"), ctx.loadRecords_(store, "gm"), Date.parse("2026-10-14T00:00:00Z")));
  assert.equal(late.games.length, 0);
  // rejected
  store.update("game", 2, { Status: "rejected" });
  assert.equal(build().games.length, 0);
});

test("'Keep this listing until' extends a listing, but never before it starts", () => {
  const { store, deps } = fixture();
  store.load("game");
  const withUntil = makeStore([makeRow("game", 2, { ...GAME_FORM, listUntil: "11/30/2026" })], [makeRow("gm", 2, GM_FORM)]);
  ctx.sync_(withUntil, deps.now());
  const rec = plain(ctx.loadRecords_(withUntil, "game"))[0];
  assert.equal(rec.expiresAt, "2026-11-30T16:59:00.000Z"); // 23:59 WIB
  const early = makeStore([makeRow("game", 2, { ...GAME_FORM, listUntil: "10/1/2026" })], [makeRow("gm", 2, GM_FORM)]);
  assert.equal(plain(ctx.loadRecords_(early, "game"))[0].expiresAt, "2026-10-13T12:00:00.000Z");
});

test("a profile submitted twice: the latest row is the current one, the earlier is superseded", () => {
  const store = makeStore([], [makeRow("gm", 2, GM_FORM), makeRow("gm", 3, { ...GM_FORM, name: "Raka P." })]);
  const { deps } = makeDeps(store);
  ctx.sync_(store, deps.now());
  assert.equal(store.load("gm")[0].cells.Superseded, "yes");
  assert.equal(store.load("gm")[1].cells.Superseded, "");
});

test("the admin API: who may call it", () => {
  const { deps } = fixture();
  assert.equal(call(deps, { action: "queue", token: "nope" }).error, "unauthorized");
  assert.equal(call(deps, { action: "queue", token: "guest" }).error, "forbidden");
  assert.equal(call(deps, { action: "whoami", token: "admin" }).email, "admin@example.com");
  assert.equal(call(deps, { action: "whoami", token: "owner" }).owner, true);
  assert.equal(call(deps, { action: "nonsense", token: "admin" }).error, "bad_request");
  assert.equal(call(deps, null).error, "bad_request");
});

test("the admin API: queue, approve with an email, undo, reject with a reason", () => {
  const { store, deps, calls } = fixture();
  const q = call(deps, { action: "queue", token: "admin" });
  assert.equal(q.ok, true);
  assert.equal(q.games.length, 1);
  assert.equal(q.games[0].email, "gm@example.com", "admins see the submitter's email");
  const gameId = q.games[0].id;
  const gmId = q.gms[0].id;

  const approvedGm = call(deps, { action: "review", token: "admin", kind: "gm", ids: [gmId], status: "approved", notify: true });
  assert.deepEqual([approvedGm.ok, approvedGm.publishing], [true, true]);
  const approved = call(deps, { action: "review", token: "admin", kind: "game", ids: [gameId], status: "approved", notify: true });
  assert.equal(approved.publishing, true);
  assert.equal(calls.dirty, 2);
  assert.deepEqual(calls.notified.map((n) => [n.status, n.kind]), [["approved", "gm"], ["approved", "game"]]);
  assert.equal(store.shared["1AbC_dEfGhIjKlMn-op"], true, "the cover becomes viewable by link so the site can fetch it");
  assert.equal(store.load("game")[0].cells.ReviewedBy, "admin@example.com");

  const undone = call(deps, { action: "review", token: "admin", kind: "game", ids: [gameId], status: "pending" });
  assert.equal(undone.publishing, true);
  assert.equal(calls.notified.length, 2, "undo sends no email");

  const rejected = call(deps, { action: "review", token: "admin", kind: "game", ids: [gameId], status: "rejected", reason: "Please add the real venue.", notify: true });
  assert.equal(rejected.publishing, false, "it wasn't public, so no rebuild");
  assert.equal(calls.notified.at(-1).reason, "Please add the real venue.");
  assert.equal(store.shared["1AbC_dEfGhIjKlMn-op"], false, "a rejected cover is private again");
  assert.equal(call(deps, { action: "review", token: "admin", kind: "game", ids: [gameId], status: "maybe" }).error, "bad_request");
  assert.equal(call(deps, { action: "review", token: "admin", kind: "game", ids: [], status: "approved" }).error, "bad_request");
});

test("the admin API: featuring and notes, and managing admins (the owner and yourself stay)", () => {
  const { deps, calls } = fixture();
  const q = call(deps, { action: "queue", token: "admin" });
  const gameId = q.games[0].id;
  call(deps, { action: "review", token: "admin", kind: "gm", ids: [q.gms[0].id], status: "approved" });
  call(deps, { action: "review", token: "admin", kind: "game", ids: [gameId], status: "approved" });
  const before = calls.dirty;
  assert.equal(call(deps, { action: "patch", token: "admin", kind: "game", id: gameId, featured: true }).publishing, true);
  assert.equal(calls.dirty, before + 1);
  assert.equal(call(deps, { action: "patch", token: "admin", kind: "game", id: gameId, adminNote: "Known GM." }).publishing, false);
  assert.equal(call(deps, { action: "patch", token: "admin", kind: "game", id: "missing", featured: true }).error, "not_found");

  const added = call(deps, { action: "admin.add", token: "admin", email: "  New.Admin@Gmail.com " });
  assert.ok(added.admins.some((a: any) => a.email === "new.admin@gmail.com"));
  assert.equal(call(deps, { action: "admin.add", token: "admin", email: "not an email" }).error, "bad_request");
  assert.equal(call(deps, { action: "admin.remove", token: "admin", email: "owner@example.com" }).message, "owner");
  assert.equal(call(deps, { action: "admin.remove", token: "admin", email: "admin@example.com" }).message, "self");
  assert.ok(!call(deps, { action: "admin.remove", token: "owner", email: "new.admin@gmail.com" }).admins.some((a: any) => a.email === "new.admin@gmail.com"));
  assert.equal(call(deps, { action: "deploy", token: "admin" }).ok, true);
  assert.equal(calls.deploys, 1);
});

test("decision emails say what happened in both languages and link to the listing", () => {
  const rec = { kind: "game", title: "Mercusuar", slug: "mercusuar-1a2b", name: "" };
  const ok = plain(ctx.decisionEmail_("approved", { record: rec }, "https://quest-board-tpk.pages.dev/"));
  assert.match(ok.subject, /Approved: Mercusuar \/ Disetujui: Mercusuar/);
  assert.match(ok.body, /https:\/\/quest-board-tpk\.pages\.dev\/games\/mercusuar-1a2b\//);
  const no = plain(ctx.decisionEmail_("rejected", { record: rec, reason: "No venue." }, ""));
  assert.match(no.body, /Reason: No venue\./);
  assert.match(no.body, /Alasan: No venue\./);
});

test("a game row with unreadable parts still loads, with the problem visible as an empty field", () => {
  const row = makeRow("game", 2, { ...GAME_FORM, date: "someday", venueMapsUrl: "https://evil.example/x", price: "gratis" });
  const rec = plain(ctx.gameFromRow_(row));
  assert.equal(rec.startsAt, "");
  assert.equal(rec.venueMapsUrl, "");
  assert.equal(rec.venueMapsRaw, "https://evil.example/x");
  assert.equal(rec.priceIdr, 0);
});
