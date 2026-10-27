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

type Rec = Record<string, unknown[]>;

/** Runs one function of CreateForms.gs against a recording stand-in for Google's Forms service. */
function runFormsScript(fn: string) {
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
  (sandbox as any)[fn]();
  return made;
}

test("CreateForms.gs asks exactly the questions Code.gs reads (bar the two file uploads), with the site's own options", () => {
  const made = runFormsScript("createForms");
  assert.equal(made.length, 2, "the profile form and the game form, no report form");
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

test("the report form: anyone can report, so no sign-in question; which listing and what is wrong are required, contact is not", () => {
  const made = runFormsScript("createReportForm");
  assert.equal(made.length, 1);
  const items = made[0].items;
  assert.deepEqual(items.map((i) => i.setTitle?.[0]), ["Which listing? (paste the page address)", "What is wrong?", "Details", "How can we reach you? (optional)"]);
  assert.deepEqual(items.map((i) => i.setRequired?.[0]), [true, true, true, false]);
  assert.equal(made[0].form.setCollectEmail, undefined, "no email or sign-in is asked of a reporter");
  assert.equal((plain(items[1].setChoiceValues?.[0]) as string[]).length, 5);
});

test("a Sheet whose form questions were retitled (capitals, spacing, three renames) is still read by the script's own titles", () => {
  // The headers of the owner's real Sheet on 2026-10-26, after they edited the generated forms.
  const game = ["Timestamp", "Email Address", "Game Title", "Game System", "Other System (if you chose Other)", "One-line summary", "Full description", "Format", "Genres (pick up to 3)", "Play styles (pick up to 3)", "Where will you play?", "Platform (Online Games)", "City (In-person Games)", "Venue Name (In-person Games)", "Google Maps Link (In-person Games)", "Session Date", "Start Time", "Time Zone", "Schedule Notes", "Keep this listing until (optional)", "Price per Seat (Rupiah, 0 = free)", "Seats", "Play Language", "Experience level", "Minimum Age", "Content Warnings", "Safety Tools", "Community Guidelines", "Game Cover Image (4 : 5 Potrait)"];
  const gm = ["Timestamp", "Email Address", "Display Name", "Short Bio", "City", "Systems you usually run", "WhatsApp number", "Discord (optional)", "Public listing", "Photo"];
  const read = (headers: string[]) => headers.map((h) => ctx.canonicalHeader_(h));
  for (const title of Object.values(GAME_COLS)) assert.ok(read(game).includes(title), `Games: ${title}`);
  for (const title of Object.values(constantOf<Record<string, string>>(ctx, "GM_COLUMNS"))) assert.ok(read(gm).includes(title), `GM profiles: ${title}`);
  assert.equal(ctx.canonicalHeader_("Status"), "Status", "the script's own columns are untouched");
  assert.equal(ctx.canonicalHeader_("A question nobody knows"), "A question nobody knows");
  assert.ok(ctx.findTab_({ getSheets: () => [{ getName: () => "GM Profiles" }] }, "GM profiles"));
  assert.equal(ctx.findTab_({ getSheets: () => [{ getName: () => "Games" }] }, "GM profiles"), null);
});

test("the public data (with the GMs' WhatsApp numbers) is only given to the build key; no key set means closed", () => {
  const props: Record<string, string> = {};
  const sandbox: any = vm.createContext({
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null, setProperty: (k: string, v: string) => { props[k] = v; } }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  });
  vm.runInContext(readFileSync(new URL("../../apps-script/Code.gs", import.meta.url), "utf8"), sandbox);
  sandbox.sheetDeps_ = () => fixture().deps;
  const get = (parameter: Record<string, string>) => JSON.parse(sandbox.doGet({ parameter }).text);

  assert.deepEqual(get({ action: "public" }), { ok: false, error: "forbidden" }, "no key configured: closed");
  assert.deepEqual(get({ action: "public", key: "" }), { ok: false, error: "forbidden" }, "an empty key never matches an unset one");
  props.BUILD_KEY = "k".repeat(64);
  assert.deepEqual(get({ action: "public" }), { ok: false, error: "forbidden" }, "no key sent");
  assert.deepEqual(get({ action: "public", key: "k".repeat(63) }), { ok: false, error: "forbidden" }, "a shorter key");
  assert.deepEqual(get({ action: "public", key: "x".repeat(64) }), { ok: false, error: "forbidden" }, "a wrong key");
  assert.ok(Array.isArray(get({ action: "public", key: "k".repeat(64) }).games), "the right key gets the data");
  assert.deepEqual(get({}), { ok: true, name: "quest-board-tpk", version: "1.0.0" }, "the plain address stays harmless");
  assert.deepEqual(get({ action: "health" }), { ok: false, error: "forbidden" }, "the health check needs the key too");
  assert.deepEqual(get({ action: "health", key: "x".repeat(64) }), { ok: false, error: "forbidden" });
  sandbox.health_ = () => ({ ok: true, stand: "in" });
  assert.deepEqual(get({ action: "health", key: "k".repeat(64) }), { ok: true, stand: "in" }, "with the key it reaches the check");
  assert.ok(sandbox.safeEqual_("abc", "abc") && !sandbox.safeEqual_("abc", "abd") && !sandbox.safeEqual_("abc", "abcd") && !sandbox.safeEqual_("", "x"));
});

test("backups: only the newest few are kept, whatever order Drive lists them in", () => {
  const files = [3, 9, 1, 7, 5].map((n) => ({ id: `f${n}`, createdMs: n * 1000 }));
  assert.deepEqual(plain(ctx.backupsToTrash_(files, 3)), ["f3", "f1"], "the two oldest go");
  assert.deepEqual(plain(ctx.backupsToTrash_(files, 8)), [], "fewer than the limit: nothing is trashed");
  assert.deepEqual(plain(ctx.backupsToTrash_([], 8)), []);
  assert.equal(files[0].id, "f3", "the list given is not reordered");
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

test("a listing that was live and is not now keeps its address (for a 'no longer listed' page); one that never was does not", () => {
  const { store, deps } = fixture();
  ctx.sync_(store, deps.now());
  const build = (now = deps.now()) => plain(ctx.buildPublic_(ctx.loadRecords_(store, "game"), ctx.loadRecords_(store, "gm"), now));
  const rec = (kind: string) => plain(ctx.loadRecords_(store, kind))[0];
  const review = (kind: string, status: string) => call(deps, { action: "review", token: "owner", kind, status, ids: [rec(kind).id] });
  const gone = (now?: number) => [build(now).goneGames, build(now).goneGms];

  assert.deepEqual(gone(), [[], []], "never approved: no address at all, so a pending title never leaks");
  review("gm", "approved");
  review("game", "approved");
  assert.equal(build().games.length, 1);
  assert.deepEqual(gone(), [[], []], "live: it has its real page");
  assert.equal(rec("game").wasLive, true, "approving marks it");

  review("game", "rejected");
  assert.deepEqual(gone(), [[rec("game").slug], []], "rejected after being live: the address stays");
  review("game", "approved");
  assert.deepEqual(gone(), [[], []], "approved again: the real page is back");

  const end = Date.parse(rec("game").expiresAt);
  assert.deepEqual(gone(end + 1000)[0], [rec("game").slug], "expired: the address stays");
  assert.deepEqual(gone(end + 179 * 86_400_000)[0], [rec("game").slug], "…for 180 days");
  assert.deepEqual(gone(end + 181 * 86_400_000)[0], [], "…then it is let go");

  store.update("game", 2, { Status: "pending", ReviewedAt: "" }); // the GM edited it: back to review
  assert.deepEqual(gone()[0], [rec("game").slug], "back in review: the old page must not keep its contact buttons");
  assert.ok(!JSON.stringify(build()).includes("Mercusuar"), "an address, never a title");

  review("gm", "rejected");
  assert.deepEqual(gone()[1], [rec("gm").slug]);
});

test("an admin can mark a game full and reopen it: only approved games go live-changed, only games can be full", () => {
  const { store, deps, calls } = fixture();
  ctx.sync_(store, deps.now());
  const id = (kind: string) => plain(ctx.loadRecords_(store, kind))[0].id;
  const patch = (kind: string, body: object) => call(deps, { action: "patch", token: "owner", kind, id: id(kind), ...body });
  const data = () => plain(ctx.buildPublic_(ctx.loadRecords_(store, "game"), ctx.loadRecords_(store, "gm"), deps.now()));

  assert.deepEqual([patch("game", { full: true }).ok, calls.dirty], [true, 0], "a pending game: saved, nothing live changes");
  assert.equal(patch("game", { full: true }).publishing, false);
  call(deps, { action: "review", token: "owner", kind: "gm", status: "approved", ids: [id("gm")] });
  call(deps, { action: "review", token: "owner", kind: "game", status: "approved", ids: [id("game")] });
  assert.equal(data().games[0].full, true, "the public data carries it");
  const before = calls.dirty;
  assert.equal(patch("game", { full: false }).publishing, true, "an approved game: the site must be rebuilt");
  assert.equal(calls.dirty, before + 1);
  assert.equal(data().games[0].full, false);
  assert.deepEqual(patch("gm", { full: true }), { ok: false, error: "bad_request" }, "a Game Master is never full");
  assert.ok(!JSON.stringify(data()).includes("Full\""), "no column names leak, only the flag");
});

test("the Activity tab records each change to a listing and who made it; a title can never run as a formula", () => {
  const { store, deps } = fixture();
  const logs = store.logs;
  const last = () => logs.at(-1)!;
  const [WHEN, WHAT, KIND, ID, TITLE, DETAIL, BY] = [0, 1, 2, 3, 4, 5, 6];

  ctx.sync_(store, deps.now());
  assert.deepEqual(logs.map((l) => l[WHAT]), ["new submission", "new submission"]);
  assert.deepEqual([logs[0][KIND], logs[0][TITLE], logs[0][BY]], ["game", "Mercusuar di Pulau Kabut", "script"]);
  assert.match(logs[0][WHEN], /^2026-10-05T00:00:00\.000Z$/);

  const gameId = plain(ctx.loadRecords_(store, "game"))[0].id;
  call(deps, { action: "review", token: "owner", kind: "game", status: "approved", ids: [gameId] });
  assert.deepEqual([last()[WHAT], last()[ID], last()[DETAIL], last()[BY]], ["decision", gameId, "pending → approved", "owner@example.com"]);
  call(deps, { action: "review", token: "owner", kind: "game", status: "rejected", reason: "Wrong date", ids: [gameId] });
  assert.equal(last()[DETAIL], "approved → rejected: Wrong date");

  call(deps, { action: "patch", token: "owner", kind: "game", id: gameId, full: true });
  assert.deepEqual([last()[WHAT], last()[DETAIL]], ["changed", "Full → yes"]);

  call(deps, { action: "admin.add", token: "owner", email: "new@example.com" });
  assert.deepEqual([last()[WHAT], last()[DETAIL], last()[BY]], ["admin added", "new@example.com", "owner@example.com"]);
  call(deps, { action: "admin.remove", token: "owner", email: "new@example.com" });
  assert.equal(last()[WHAT], "admin removed");

  // the GM edits an approved response: the script sends it back and says so
  call(deps, { action: "review", token: "owner", kind: "game", status: "approved", ids: [gameId] });
  store.update("game", 2, { "Game title": "A new title" });
  ctx.sync_(store, deps.now());
  assert.deepEqual([last()[WHAT], last()[DETAIL], last()[BY]], ["edited by the GM: back to review", "was approved", "script"]);

  // a change that happens with no line here was made by hand: nothing here to say otherwise
  const before = logs.length;
  store.update("game", 2, { Status: "rejected" });
  assert.equal(logs.length, before, "a hand edit in the Sheet leaves no line");

  // a title that starts with = would run as a formula in the sheet: it is stored as plain text
  const evil = makeStore([makeRow("game", 2, { ...GAME_FORM, title: "=IMPORTXML(\"https://evil.example\")" })], [makeRow("gm", 2, GM_FORM)]);
  ctx.sync_(evil, deps.now());
  assert.equal(evil.logs[0][TITLE], "'=IMPORTXML(\"https://evil.example\")");

  // and a failing log never breaks the work it describes
  const broken = { ...makeStore([makeRow("game", 2, GAME_FORM)], [makeRow("gm", 2, GM_FORM)]), log: () => { throw new Error("quota"); } };
  assert.equal(plain(ctx.sync_(broken, deps.now())).newPending.length, 2);
});

test("approving by hand in the Sheet counts as live too, and a replaced profile keeps its old address", () => {
  const byHand = makeStore([makeRow("game", 2, GAME_FORM)], [makeRow("gm", 2, GM_FORM)]);
  ctx.sync_(byHand, Date.parse("2026-10-05T00:00:00Z"));
  byHand.update("game", 2, { Status: "approved" });
  ctx.sync_(byHand, Date.parse("2026-10-05T00:01:00Z"));
  assert.equal(plain(ctx.loadRecords_(byHand, "game"))[0].wasLive, true, "sync marks a row someone approved in the Sheet");

  const admin = (id: string, slug: string) => ({ Id: id, Status: "approved", Slug: slug, WasLive: "yes", ReviewedAt: "2026-10-01T00:00:00.000Z" });
  const twice = makeStore([], [makeRow("gm", 2, GM_FORM, admin("m1old", "raka-old1")), makeRow("gm", 3, { ...GM_FORM, bio: "Newer profile." }, admin("m2new", "raka-new2"))]);
  ctx.sync_(twice, Date.parse("2026-10-05T00:00:00Z"));
  const data = plain(ctx.buildPublic_(ctx.loadRecords_(twice, "game"), ctx.loadRecords_(twice, "gm"), Date.parse("2026-10-05T00:00:00Z")));
  assert.deepEqual(data.gms.map((g: any) => g.slug), ["raka-new2"]);
  assert.deepEqual(data.goneGms, ["raka-old1"], "the older profile is replaced, its address says so");
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
  assert.match(ok.body, /Quest Board within a few minutes\.\nhttps:\/\/quest-board-tpk\.pages\.dev\/en\/games\/mercusuar-1a2b\/\n/);
  assert.match(ok.body, /dalam beberapa menit\.\nhttps:\/\/quest-board-tpk\.pages\.dev\/id\/games\/mercusuar-1a2b\/\n/);
  assert.ok(!/pages\.dev\/games\//.test(ok.body), "a link without /en/ or /id/ is a 404 on the site");
  const gmMail = plain(ctx.decisionEmail_("approved", { record: { kind: "gm", name: "Raka", slug: "raka-0r01" } }, "https://quest-board-tpk.pages.dev"));
  assert.match(gmMail.body, /pages\.dev\/en\/gm\/raka-0r01\//);
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
