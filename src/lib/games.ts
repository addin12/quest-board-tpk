// Finding games: the filters, how they read from and write to the URL, and the sort orders. Pure module, so the
// same code runs while the site is built (the first render lists everything) and in the browser (filtering).
import { matchesWords, norm, queryWords, searchText } from "./search.ts";
import type { GameFormat, Level, LocationType, SiteGame } from "./types.ts";

export type SortKey = "soonest" | "newest" | "priceAsc";
export type Filters = {
  q: string;
  system: string;
  genre: string;
  style: string;
  mechanic: string;
  format: "" | GameFormat;
  where: "" | LocationType;
  level: "" | Level;
  language: "" | "id" | "en";
  free: boolean;
  /** Starts on the coming Saturday or Sunday (Jakarta time). */
  weekend: boolean;
  /** Listed in the last seven days. */
  fresh: boolean;
  /** Only games with no fixed date (ADR-52). */
  onRequest: boolean;
  sort: SortKey;
  /** 1-based page of the list; not a filter, so it is not counted and any change to a filter sends the list back to page 1. */
  page: number;
};

export const PAGE_SIZE = 9;

/**
 * The page buttons to draw: every page up to 7, else the first, the last and the pages around the current one, with 0 where pages are skipped.
 * @example pageList(5, 12) // [1, 0, 4, 5, 6, 0, 12]
 */
export function pageList(page: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = [...new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return keep.flatMap((n, i) => (i > 0 && n - keep[i - 1] > 1 ? [0, n] : [n]));
}

export const EMPTY_FILTERS: Filters = { q: "", system: "", genre: "", style: "", mechanic: "", format: "", where: "", level: "", language: "", free: false, weekend: false, fresh: false, onRequest: false, sort: "soonest", page: 1 };

const oneOf = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Reads filters from a query string ("?q=horror&where=online"); unknown values are ignored. */
export function parseFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    q: (p.get("q") ?? "").slice(0, 80),
    system: (p.get("system") ?? "").slice(0, 80),
    genre: (p.get("genre") ?? "").slice(0, 40),
    style: (p.get("style") ?? "").slice(0, 40),
    mechanic: (p.get("mechanic") ?? "").slice(0, 40),
    format: oneOf(p.get("format"), ["", "one_shot", "campaign"] as const, ""),
    where: oneOf(p.get("where"), ["", "online", "in_person"] as const, ""),
    level: oneOf(p.get("level"), ["", "beginner", "experienced"] as const, ""), // "all experience levels" is no filter, so an old ?level=any is read as that
    language: oneOf(p.get("language"), ["", "id", "en"] as const, ""),
    free: p.get("free") === "1",
    weekend: p.get("weekend") === "1",
    fresh: p.get("new") === "1",
    onRequest: p.get("request") === "1",
    sort: oneOf(p.get("sort"), ["soonest", "newest", "priceAsc"] as const, "soonest"),
    page: Math.min(Math.max(Math.trunc(Number(p.get("page"))) || 1, 1), 999),
  };
}

/** The query string for filters ("" when nothing differs from the defaults). @example filtersToQuery({ ...EMPTY_FILTERS, q: "horror" }) // "?q=horror" */
export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  (["q", "system", "genre", "style", "mechanic", "format", "where", "level", "language"] as const).forEach((k) => { if (f[k]) p.set(k, f[k]); });
  if (f.free) p.set("free", "1");
  if (f.weekend) p.set("weekend", "1");
  if (f.fresh) p.set("new", "1");
  if (f.onRequest) p.set("request", "1");
  if (f.sort !== "soonest") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** How many filters are on (the sort doesn't count). */
export function activeFilterCount(f: Filters): number {
  return (["q", "system", "genre", "style", "mechanic", "format", "where", "level", "language"] as const).filter((k) => f[k]).length + (f.free ? 1 : 0) + (f.weekend ? 1 : 0) + (f.fresh ? 1 : 0) + (f.onRequest ? 1 : 0);
}

export type GameView = SiteGame & { gmName: string };

/** Games with their Game Master's name attached, soonest first. */
export function gameViewsOf(data: { games: readonly SiteGame[]; gms: readonly { id: string; name: string }[] }): GameView[] {
  const names = new Map(data.gms.map((g) => [g.id, g.name]));
  return data.games.map((g) => ({ ...g, gmName: names.get(g.gmId) ?? "" })).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export { norm };

/** Every word of the search must appear somewhere in the title, system, summary, city, venue, GM's name, platform, genres, styles or mechanics; synonyms count (src/lib/search.ts). */
function matchesText(g: GameView, q: string): boolean {
  const words = queryWords(q);
  if (words.length === 0) return true;
  return matchesWords(searchText([g.title, g.system, g.summary, g.city, ...g.cities, g.venueName, g.gmName, g.platform, g.format, g.locationType, ...g.genres, ...g.styles, ...g.mechanics].join(" ")), words);
}

export function sortGames<G extends GameView>(games: G[], sort: SortKey): G[] {
  const byStart = (a: G, b: G) => Date.parse(a.startsAt) - Date.parse(b.startsAt);
  const notFullFirst = (a: G, b: G) => Number(a.full) - Number(b.full); // a full game sinks, whatever the order
  const datedFirst = (a: G, b: G) => Number(a.onDemand) - Number(b.onDemand); // soonest: games on request come after every dated one
  const copy = [...games];
  if (sort === "newest") return copy.sort((a, b) => notFullFirst(a, b) || Date.parse(b.listedAt) - Date.parse(a.listedAt) || byStart(a, b));
  if (sort === "priceAsc") return copy.sort((a, b) => notFullFirst(a, b) || a.priceIdr - b.priceIdr || byStart(a, b));
  return copy.sort((a, b) => notFullFirst(a, b) || datedFirst(a, b) || byStart(a, b)); // soonest first, on request after, full games last
}

export type Tile = { name: string; count: number; cover: string | null };

/** One tile per key that has listings, the most listed first (ties A to Z), with the cover of its soonest listing that has one. */
function rankTiles(games: readonly GameView[], keysOf: (g: GameView) => readonly string[]): Tile[] {
  const byKey = new Map<string, { count: number; cover: string | null }>();
  for (const g of sortGames([...games], "soonest")) {
    for (const key of new Set(keysOf(g))) {
      const entry = byKey.get(key) ?? { count: 0, cover: null };
      entry.count += 1;
      entry.cover ??= g.cover;
      byKey.set(key, entry);
    }
  }
  return [...byKey].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Every key in `known` after the ones with listings, each with a count of 0 and no cover. */
const withUnlisted = (listed: Tile[], known: readonly string[]): Tile[] => {
  const seen = new Set(listed.map((t) => t.name));
  return [...listed, ...known.filter((name) => !seen.has(name)).map((name) => ({ name, count: 0, cover: null }))];
};

/** @example systemTiles(games).slice(0, 10) // the ten the home page shows */
export const systemTiles = (games: readonly GameView[]): Tile[] => rankTiles(games, (g) => [g.system]);

/** Every system in `known` plus any other system that has games: those with games first, then the rest in the order of `known`. */
export const allSystemTiles = (games: readonly GameView[], known: readonly string[]): Tile[] => withUnlisted(systemTiles(games), known);

/** Genre tiles by genre key; only the keys in `known` (the site's taxonomy) are kept. */
export const genreTiles = (games: readonly GameView[], known: readonly string[]): Tile[] => rankTiles(games, (g) => g.genres).filter((t) => known.includes(t.name));

/** Style and mechanic tiles by key, only the keys in `known`; the all-versions list the rest at 0. */
export const styleTiles = (games: readonly GameView[], known: readonly string[]): Tile[] => rankTiles(games, (g) => g.styles).filter((t) => known.includes(t.name));
export const allStyleTiles = (games: readonly GameView[], known: readonly string[]): Tile[] => withUnlisted(styleTiles(games, known), known);
export const mechanicTiles = (games: readonly GameView[], known: readonly string[]): Tile[] => rankTiles(games, (g) => g.mechanics).filter((t) => known.includes(t.name));
export const allMechanicTiles = (games: readonly GameView[], known: readonly string[]): Tile[] => withUnlisted(mechanicTiles(games, known), known);

/** Every genre in `known`: those with games first, then the rest in the order of `known`. */
export const allGenreTiles = (games: readonly GameView[], known: readonly string[]): Tile[] => withUnlisted(genreTiles(games, known), known);

const WIB_MS = 7 * 3_600_000;
const DAY = 86_400_000;

/**
 * The coming weekend as [start, end) in ms: Saturday 00:00 to Monday 00:00 Jakarta time. On a Saturday or Sunday it is this weekend, on a weekday the next one.
 * @example weekendRange(Date.parse("2026-11-05T03:00:00Z")) // Thursday: [Sat 7 Nov 00:00 WIB, Mon 9 Nov 00:00 WIB)
 */
export function weekendRange(nowMs: number): [number, number] {
  const local = new Date(nowMs + WIB_MS); // read with getUTC*: it is the Jakarta wall clock
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const dow = local.getUTCDay(); // 0 Sunday … 6 Saturday
  const start = midnight + (dow === 0 ? -1 : 6 - dow) * DAY - WIB_MS;
  return [start, start + 2 * DAY];
}

/** `nowMs` is what "this weekend" and "new this week" count from. */
export function applyFilters<G extends GameView>(games: G[], f: Filters, nowMs: number = 0): G[] {
  const [from, to] = weekendRange(nowMs);
  return sortGames(
    games.filter((g) =>
      matchesText(g, f.q) &&
      (!f.system || g.system === f.system) &&
      (!f.genre || g.genres.includes(f.genre)) &&
      (!f.style || g.styles.includes(f.style)) &&
      (!f.mechanic || g.mechanics.includes(f.mechanic)) &&
      (!f.format || g.format === f.format) &&
      (!f.where || g.locationType === f.where) &&
      (!f.level || g.level === f.level) &&
      (!f.language || g.language === f.language || g.language === "both") &&
      (!f.free || g.priceIdr === 0) &&
      (!f.weekend || (!g.onDemand && Date.parse(g.startsAt) >= from && Date.parse(g.startsAt) < to)) &&
      (!f.onRequest || g.onDemand) &&
      (!f.fresh || Date.parse(g.listedAt) >= nowMs - 7 * DAY),
    ),
    f.sort,
  );
}

/** Games still on the site at `nowMs` (the build drops the rest; the browser does too, between builds). */
export const isLive = (g: Pick<SiteGame, "expiresAt">, nowMs: number): boolean => Date.parse(g.expiresAt) > nowMs;

/** The distinct values the filters offer, from the games on the site. */
export function filterOptions(games: readonly SiteGame[]) {
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    systems: uniq(games.map((g) => g.system)),
    genres: [...new Set(games.flatMap((g) => g.genres))],
    styles: [...new Set(games.flatMap((g) => g.styles))],
    mechanics: [...new Set(games.flatMap((g) => g.mechanics))],
  };
}
