// The site's pure library: the data check at the boundary, the filters, the contact links, the admin view.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GENRES, MAX_PER_GAME, STYLES } from "../../src/lib/categories.ts";
import { SUMMARY_MAX } from "../../src/lib/areas.ts";
import { checkGame, checkGm, hasErrors } from "../../src/lib/checks.ts";
import { contactMessage, decodeContact, encodeContact, messageLang, waLink } from "../../src/lib/contact.ts";
import { formatDay, formatIdr, formatWhen, initialsOf } from "../../src/lib/format.ts";
import { EMPTY_FILTERS, activeFilterCount, applyFilters, filterOptions, filtersToQuery, isLive, parseFilters, type GameView } from "../../src/lib/games.ts";
import { DICTIONARIES, makeT } from "../../src/lib/i18n/dict.ts";
import { cleanDiscord, isGoogleMapsUrl, isPhone, parsePublicData, text } from "../../src/lib/public-data.ts";
import { buildItems, canApprove, countByStatus, filterItems, previewGame, reasonText, siteBehind, whenLabel } from "../../src/lib/admin-view.ts";
import { flatName } from "../../scripts/fix-export.mjs";
import { parseConfig } from "../../scripts/push-apps-script.mjs";
import { PLACEHOLDER_SLUG, slugParams } from "../../src/lib/static-params.ts";
import { constant, loadScript, plain } from "../support/fake-sheet.ts";
import type { GameRecord, GmRecord, SiteGame } from "../../src/lib/types.ts";

const sample = JSON.parse(readFileSync(new URL("../../data/sample.json", import.meta.url), "utf8"));

// ── the data check ────────────────────────────────────────────────────────────────────────────
test("the sample data passes the check untouched", () => {
  const { data, warnings } = parsePublicData(sample);
  assert.deepEqual(warnings, []);
  assert.equal(data.games.length, sample.games.length);
  assert.equal(data.gms.length, sample.gms.length);
});

test("bad records are dropped with a warning; the rest of the data is kept", () => {
  const bad = structuredClone(sample);
  bad.games[0].startsAt = "not a date";
  bad.games[1].gmId = "m-nobody";
  bad.games[2].format = "weekend";
  bad.games[3].priceIdr = -5;
  bad.games[4].venueMapsUrl = "https://evil.example/maps";
  bad.gms[3].whatsapp = "0812-call-me";
  const { data, warnings } = parsePublicData(bad);
  assert.equal(warnings.length, 8, warnings.join("\n")); // 4 bad games, the bad link, the bad number, and the 2 games of the dropped GM
  assert.ok(!data.games.some((g) => g.id === bad.games[0].id));
  assert.ok(!data.gms.some((g) => g.id === bad.gms[3].id), "a GM without a valid number is not listed");
  assert.ok(!data.games.some((g) => g.gmId === bad.gms[3].id), "and neither are their games");
  assert.equal(data.games.find((g) => g.id === bad.games[4].id)?.venueMapsUrl, "", "the game stays; only the link goes");
});

test("duplicates keep the first; text is cleaned and cut; categories are limited to the known ones", () => {
  const dup = structuredClone(sample);
  dup.games.push({ ...dup.games[0], id: "g0other01" });
  dup.games[1].title = "  Tab\there \u0000 x ".repeat(40);
  dup.games[2].genres = ["horror", "nonsense", "horror", "fantasy", "cozy", "comedy"];
  const { data, warnings } = parsePublicData(dup);
  assert.equal(data.games.length, sample.games.length);
  assert.ok(warnings.some((w) => /duplicate/.test(w)));
  assert.ok(data.games[1].title.length <= 100 && !/[\u0000\t]/.test(data.games[1].title));
  assert.deepEqual(data.games[2].genres, ["horror", "fantasy", "cozy"]);
  assert.throws(() => parsePublicData({ nope: true }), /no gms and games/);
  assert.equal(text("a\r\nb", 10, true), "a\nb");
});

test("phone numbers, Discord names and map links are checked on this side as well", () => {
  assert.equal(isPhone("6281234567890"), true);
  assert.equal(isPhone("+6281234567890"), false);
  assert.equal(cleanDiscord("@Raka_GM"), "raka_gm");
  assert.equal(cleanDiscord("https://discord.gg/abc"), "https://discord.gg/abc");
  assert.equal(cleanDiscord("https://discord.gg.evil.example/abc"), "");
  assert.equal(isGoogleMapsUrl("https://maps.app.goo.gl/x"), true);
  assert.equal(isGoogleMapsUrl("https://google.com.evil.example/maps/x"), false);
});

test("the script limits a game to as many genres and styles as the site does", () => {
  assert.equal(constant<number>(loadScript(), "MAX_PER_GAME"), MAX_PER_GAME);
  assert.ok(GENRES.length > 0 && STYLES.length > 0);
  assert.equal(makeT("en")("genre.urban"), "Urban fantasy");
});

// ── languages ────────────────────────────────────────────────────────────────────────────────
test("English and Indonesian have the same strings, with the same placeholders", () => {
  const en = DICTIONARIES.en as Record<string, string>;
  const id = DICTIONARIES.id as Record<string, string>;
  assert.deepEqual(Object.keys(id).sort(), Object.keys(en).sort());
  const vars = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join();
  const differ = Object.keys(en).filter((k) => vars(en[k]) !== vars(id[k]));
  assert.deepEqual(differ, [], "a placeholder is missing in one language");
  const plural = Object.keys(en).filter((k) => en[k].includes("|") !== id[k].includes("|") && id[k].includes("|"));
  assert.deepEqual(plural, [], "Indonesian has no plural forms: a | in id.ts is a mistake");
  assert.equal(makeT("en")("games.results", { n: 1 }), "Showing 1 game");
  assert.equal(makeT("en")("games.results", { n: 3 }), "Showing 3 games");
  assert.equal(makeT("id")("games.results", { n: 3 }), "Menampilkan 3 game");
});

// ── formatting ───────────────────────────────────────────────────────────────────────────────
test("money and times", () => {
  assert.equal(formatIdr(75000), "Rp 75.000");
  assert.equal(initialsOf("Raka Pratama Putra"), "RP");
  assert.equal(formatWhen("2026-10-12T12:00:00.000Z", "en", "WIB"), "Mon 12 Oct, 19.00 WIB");
  assert.equal(formatWhen("2026-10-12T12:00:00.000Z", "id", "WITA"), "Sen, 12 Okt, 20.00 WITA");
  assert.equal(formatDay("2026-10-12T12:00:00.000Z", "en", "WIT"), "12 October 2026");
});

// ── finding games ────────────────────────────────────────────────────────────────────────────
const games = (): GameView[] => {
  const { data } = parsePublicData(sample);
  const names = new Map(data.gms.map((g) => [g.id, g.name]));
  return data.games.map(({ coverId, ...g }) => ({ ...g, cover: coverId, gmName: names.get(g.gmId) ?? "" }));
};

test("filters narrow the list, together, and read from and write to the address", () => {
  const all = games();
  assert.equal(applyFilters(all, EMPTY_FILTERS).length, all.length);
  const f = parseFilters("?q=horror&where=online&free=1&level=beginner&sort=nonsense&where2=x");
  assert.deepEqual({ ...f }, { ...EMPTY_FILTERS, q: "horror", where: "online", free: true, level: "beginner" });
  assert.equal(filtersToQuery(f), "?q=horror&where=online&level=beginner&free=1");
  assert.deepEqual({ ...parseFilters(filtersToQuery(f)) }, { ...f }, "what is written can be read back");
  assert.equal(filtersToQuery(EMPTY_FILTERS), "");
  assert.equal(activeFilterCount(f), 4);
  const inPerson = applyFilters(all, { ...EMPTY_FILTERS, where: "in_person" });
  assert.ok(inPerson.length >= 3 && inPerson.every((g) => g.locationType === "in_person"));
  assert.ok(applyFilters(all, { ...EMPTY_FILTERS, language: "en" }).every((g) => g.language === "en" || g.language === "both"));
  assert.equal(applyFilters(all, { ...EMPTY_FILTERS, q: "kumu" }).length, 1, "a venue name is searchable");
  assert.equal(applyFilters(all, { ...EMPTY_FILTERS, q: "RAKA cthulhu" }).length >= 1, true, "every word must match somewhere, in any order");
  assert.equal(applyFilters(all, { ...EMPTY_FILTERS, q: "zzzz" }).length, 0);
});

test("sorting: soonest first with featured games ahead and full games last; cheapest; newest", () => {
  const all = games();
  assert.ok(all.some((g) => g.full), "the demo data has a full game");
  const soon = applyFilters(all, EMPTY_FILTERS);
  const open = soon.filter((g) => !g.full);
  assert.ok(soon.slice(open.length).every((g) => g.full) && soon.slice(0, open.length).every((g) => !g.full), "full games come last, whatever the order");
  const featured = open.filter((g) => g.featured);
  assert.deepEqual(open.slice(0, featured.length).map((g) => g.featured), featured.map(() => true));
  const rest = open.slice(featured.length).map((g) => Date.parse(g.startsAt));
  assert.deepEqual(rest, [...rest].sort((a, b) => a - b));
  const cheapSorted = applyFilters(all, { ...EMPTY_FILTERS, sort: "priceAsc" });
  const cheap = cheapSorted.filter((g) => !g.full).map((g) => g.priceIdr);
  assert.deepEqual(cheap, [...cheap].sort((a, b) => a - b));
  assert.ok(cheapSorted.at(-1)?.full, "cheapest first still puts a full game at the end");
});

test("a game stops showing when its time is up, and the filter choices come from the games that are there", () => {
  const g = games()[0];
  assert.equal(isLive(g, Date.parse(g.expiresAt) - 1), true);
  assert.equal(isLive(g, Date.parse(g.expiresAt)), false);
  const o = filterOptions(games());
  assert.ok(o.systems.includes("Call of Cthulhu"));
});

// ── contacting a GM ──────────────────────────────────────────────────────────────────────────
test("the number is not plain in the page, and the chat opens with the message ready", () => {
  const enc = encodeContact("6281234567890");
  assert.ok(!enc.includes("62812"));
  assert.equal(decodeContact(enc), "6281234567890");
  assert.equal(waLink("6281234567890", "Hi “Naga” & co"), "https://wa.me/6281234567890?text=Hi%20%E2%80%9CNaga%E2%80%9D%20%26%20co");
});

test("the first message is in the game's language, or the page's when the game uses both", () => {
  const g = (language: SiteGame["language"]) => ({ ...games()[0], language }) as SiteGame;
  assert.equal(messageLang(g("id"), "en"), "id");
  assert.equal(messageLang(g("en"), "id"), "en");
  assert.equal(messageLang(g("both"), "id"), "id");
  assert.equal(messageLang(null, "en"), "en");
  const m = contactMessage({ name: "Raka" }, g("id"), "en");
  assert.match(m, /^Halo Raka, aku menemukan “Mercusuar di Pulau Kabut” di Quest Board TPK \(.* WIB\)\. Apakah masih ada kursi\?$/);
  assert.match(contactMessage({ name: "Raka" }, null, "en"), /^Hi Raka, I found your profile/);
});

// ── the admin view ───────────────────────────────────────────────────────────────────────────
const record = (over: Partial<GameRecord> = {}): GameRecord => ({
  kind: "game", id: "g1abc1234", slug: "x-abcd", status: "pending", featured: false, full: false, adminNote: "", reviewedBy: "", reviewedAt: "", rejectReason: "", superseded: false,
  submittedAt: "2026-10-01T03:00:00.000Z", email: "gm@example.com", row: 2, title: "Mercusuar", system: "Call of Cthulhu", summary: "A horror one-shot.", description: "x".repeat(200),
  format: "one_shot", locationType: "in_person", platform: "", city: "Depok", venueName: "Kumu", venueMapsUrl: "https://maps.app.goo.gl/k", startsAt: "2026-10-12T12:00:00.000Z",
  zone: "WIB", scheduleNote: "", expiresAt: "2026-10-13T12:00:00.000Z", priceIdr: 75000, seats: 5, language: "both", level: "beginner", minAge: 16, contentWarnings: "", safetyTools: "",
  genres: ["horror"], styles: [], coverId: "1AbCdEfGhIjKl", venueMapsRaw: "", consent: true, ...over,
});
const gmRecord = (over: Partial<GmRecord> = {}): GmRecord => ({
  kind: "gm", id: "m1abc1234", slug: "raka-abcd", status: "approved", featured: false, full: false, adminNote: "", reviewedBy: "", reviewedAt: "", rejectReason: "", superseded: false,
  submittedAt: "2026-09-30T03:00:00.000Z", email: "gm@example.com", row: 2, name: "Raka", bio: "Horror GM.", city: "Depok", systems: [], whatsapp: "6281234567890", discord: "", photoId: "", consent: true, ...over,
});
const NOW = Date.parse("2026-10-05T00:00:00Z");
const ids = (checks: { id: string }[]) => checks.map((c) => c.id);

test("checks: what blocks approval, what only deserves a look", () => {
  const gm = gmRecord();
  const ok = checkGame(record(), { gm, games: [record()], nowMs: NOW });
  assert.deepEqual(ids(ok), []);
  assert.equal(hasErrors(ok), false);

  const noDate = checkGame(record({ startsAt: "", expiresAt: "" }), { gm, games: [], nowMs: NOW });
  assert.equal(hasErrors(noDate), true);
  assert.ok(ids(noDate).includes("date"));
  assert.ok(ids(checkGame(record({ startsAt: "2026-09-01T12:00:00.000Z" }), { gm, games: [], nowMs: NOW })).includes("datePast"));
  assert.ok(ids(checkGame(record(), { gm: undefined, games: [], nowMs: NOW })).includes("gmMissing"));
  assert.ok(ids(checkGame(record(), { gm: gmRecord({ status: "pending" }), games: [], nowMs: NOW })).includes("gmNotApproved"));
  assert.ok(ids(checkGame(record({ venueMapsRaw: "https://evil.example" }), { gm, games: [], nowMs: NOW })).includes("maps"));
  assert.ok(ids(checkGame(record({ locationType: "online", platform: "" }), { gm, games: [], nowMs: NOW })).includes("platform"));
  assert.ok(ids(checkGame(record({ locationType: "in_person", city: "" }), { gm, games: [], nowMs: NOW })).includes("city"));
  assert.ok(ids(checkGame(record({ locationType: "in_person", city: "Surabaya" }), { gm, games: [], nowMs: NOW })).includes("area"), "a city outside Jabodetabek is flagged");
  assert.ok(!ids(checkGame(record({ locationType: "in_person", city: "Jakarta Selatan" }), { gm, games: [], nowMs: NOW })).includes("area"), "a district of Jakarta is inside");
  assert.ok(!ids(checkGame(record({ locationType: "online", city: "" }), { gm, games: [], nowMs: NOW })).includes("area"), "online games have no area");
  assert.ok(ids(checkGame(record({ summary: "x".repeat(SUMMARY_MAX + 1) }), { gm, games: [], nowMs: NOW })).includes("summaryLong"));
  assert.ok(!ids(checkGame(record({ summary: "x".repeat(SUMMARY_MAX) }), { gm, games: [], nowMs: NOW })).includes("summaryLong"));

  const scam = checkGame(record({ description: "Send me your OTP and pay the admin fee to my new account. ".repeat(3) }), { gm, games: [], nowMs: NOW });
  assert.ok(ids(scam).includes("scam"));
  assert.match(String(scam.find((c) => c.id === "scam")?.vars?.signals), /credentials/);

  const twin = record({ id: "g2other999" });
  assert.ok(ids(checkGame(record(), { gm, games: [record(), twin], nowMs: NOW })).includes("duplicate"));
  assert.deepEqual(ids(checkGame(record({ coverId: "", description: "short" }), { gm, games: [], nowMs: NOW })), ["cover", "short"]);

  assert.deepEqual(ids(checkGm(gmRecord({ whatsapp: "", consent: false }))).slice(0, 2).sort(), ["consent", "phone"]);
  assert.equal(hasErrors(checkGm(gmRecord())), false);
});

test("the admin lists: counts, search, order, and the approve button's rule", () => {
  const gms = [gmRecord(), gmRecord({ id: "m2other999", email: "other@example.com", name: "Dewi", status: "pending" })];
  const gamesIn = [
    record({ id: "g1aaaaaaa", title: "Alpha", submittedAt: "2026-10-02T00:00:00.000Z" }),
    record({ id: "g2bbbbbbb", title: "Beta", submittedAt: "2026-10-01T00:00:00.000Z", email: "other@example.com" }),
    record({ id: "g3ccccccc", title: "Gamma", status: "approved", reviewedAt: "2026-10-03T00:00:00.000Z", slug: "gamma-1111" }),
    record({ id: "g4ddddddd", title: "Delta", status: "rejected", startsAt: "", expiresAt: "" }),
  ];
  const { games: items, gms: gmItems } = buildItems(gamesIn, gms, NOW);
  assert.deepEqual(countByStatus(items), { pending: 2, approved: 1, rejected: 1 });
  assert.deepEqual(filterItems(items, "pending", "").map((i) => i.rec.id), ["g2bbbbbbb", "g1aaaaaaa"], "the one waiting longest comes first");
  assert.deepEqual(filterItems(items, "pending", "dewi").map((i) => i.rec.id), ["g2bbbbbbb"], "a game is found by its GM's name");
  assert.deepEqual(filterItems(items, "pending", "alpha depok").map((i) => i.rec.id), ["g1aaaaaaa"]);
  assert.equal(canApprove(items[0]), true);
  assert.equal(canApprove(items[3]), false, "no readable date, so no approval until the GM fixes it");
  assert.equal(canApprove(items[1]), true, "its GM's profile still waiting is a warning, not a block");
  assert.equal(gmItems.length, 2);
});

test("a rejection's reason is written in both languages, with the admin's own words last", () => {
  const en = makeT("en");
  const id = makeT("id");
  assert.equal(reasonText(["date", "contact"], "", en, id), "The date or time is missing or has passed; The WhatsApp number or contact details look wrong / Tanggal atau jamnya kosong atau sudah lewat; Nomor WhatsApp atau kontaknya tampak salah");
  assert.match(reasonText(["other"], "Please add the venue.", en, id), / — Please add the venue\.$/);
  assert.equal(reasonText([], "  ", en, id), "");
  assert.equal(reasonText([], "Only a note", en, id), "Only a note");
});

test("the preview shows a game as the card would, with the picture straight from Drive and a date even when it is unreadable", () => {
  const p = previewGame(record(), gmRecord(), "2026-10-05T00:00:00.000Z");
  assert.equal(p.cover, "https://drive.google.com/thumbnail?id=1AbCdEfGhIjKl&sz=w480");
  assert.equal(p.gmName, "Raka");
  assert.equal(previewGame(record({ startsAt: "", expiresAt: "" }), undefined, "2026-10-05T00:00:00.000Z").startsAt, "2026-10-05T00:00:00.000Z");
  assert.match(whenLabel(NOW - 5 * 60_000, "en", NOW), /5 minutes ago/);
  assert.match(whenLabel(NOW - 3 * 3600_000, "id", NOW), /3 jam/);
  assert.equal(plain(whenLabel(null, "en", NOW)), "");
});

// ── the export fix ───────────────────────────────────────────────────────────────────────────
test("the prefetch file's dotted name is what the browser asks for", () => {
  assert.equal(flatName("__next.$d$lang", "games/$d$slug/__PAGE__.txt"), "__next.$d$lang.games.$d$slug.__PAGE__.txt");
  assert.equal(flatName("__next.$d$lang", "__PAGE__.txt"), "__next.$d$lang.__PAGE__.txt");
});

test("a site with no games or Game Masters yet still has a page to build per route (a static export needs at least one)", () => {
  assert.deepEqual(slugParams([]), [{ lang: "en", slug: PLACEHOLDER_SLUG }, { lang: "id", slug: PLACEHOLDER_SLUG }]);
  assert.deepEqual(slugParams([{ slug: "a-1234" }, { slug: "b-5678" }]).map((p) => `${p.lang}/${p.slug}`), ["en/a-1234", "en/b-5678", "id/a-1234", "id/b-5678"]);
  assert.ok(!/-[0-9a-z]{4}$/.test(PLACEHOLDER_SLUG), "a real slug ends in -xxxx, so the placeholder never clashes with one");
});

test("the admin page warns when the newest publish is missing from the page it is looking at, but not too early", () => {
  const T = Date.parse("2026-10-27T10:00:00Z");
  const min = (n: number) => T + n * 60_000;
  const built = "2026-10-27T09:00:00Z";
  assert.equal(siteBehind(built, null, min(60)), false, "nothing was ever published from here");
  assert.equal(siteBehind(built, T, min(5)), false, "a build takes a few minutes: not yet");
  assert.equal(siteBehind(built, T, min(11)), true, "built before the publish, and the grace has passed");
  assert.equal(siteBehind("2026-10-27T10:03:00Z", T, min(60)), false, "this page was built after the publish: all is well");
  assert.equal(siteBehind("not a date", T, min(60)), false, "unreadable build time: no false alarm");
});

test("gone addresses: plain ones are kept, sorted and without repeats; odd or live ones are dropped; none at all is fine", () => {
  const withGone = { ...structuredClone(sample), goneGames: ["z-old-0001", "a-old-0002", "a-old-0002", "Bad Slug", 5, sample.games[0].slug], goneGms: "nope" };
  const { data, warnings } = parsePublicData(withGone);
  assert.deepEqual(data.goneGames, ["a-old-0002", "z-old-0001"]);
  assert.deepEqual(data.goneGms, [], "not a list: ignored");
  assert.equal(warnings.length, 4, "a bad address, a number, a live one, and the wrong type");
  assert.deepEqual(parsePublicData({ gms: [], games: [] }).data.goneGames, [], "an older script without the lists");
});

test("the script deploy command refuses a missing or mistyped id before it pushes anything", () => {
  const good = { scriptId: "1ZnEWSMsYzAVSS91HI85wH2-tK8cR90gzlt0Ap_d8q91kGW-bA8DtKgwj", deploymentId: "AKfycbzGMrBu01ysA1PDP4M0qnXCJXi3DoLfOWe-vbjwJVTg1aC7QAogs7pigG-ca9ZZaPSS9Q" };
  assert.deepEqual(parseConfig(good), good);
  assert.throws(() => parseConfig(undefined), /scriptId/);
  assert.throws(() => parseConfig({ ...good, scriptId: "short" }), /scriptId/);
  assert.throws(() => parseConfig({ ...good, deploymentId: "has spaces and ; rm -rf" }), /deploymentId/);
  assert.throws(() => parseConfig({ scriptId: good.scriptId }), /deploymentId/);
});
