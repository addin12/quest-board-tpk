// Finding games: the filters, how they read from and write to the URL, and the sort orders. Pure module, so the
// same code runs while the site is built (the first render lists everything) and in the browser (filtering).
import type { GameFormat, Level, LocationType, SiteGame } from "./types.ts";

export type SortKey = "soonest" | "newest" | "priceAsc";
export type Filters = {
  q: string;
  system: string;
  genre: string;
  format: "" | GameFormat;
  where: "" | LocationType;
  level: "" | Level;
  language: "" | "id" | "en";
  free: boolean;
  sort: SortKey;
};

export const EMPTY_FILTERS: Filters = { q: "", system: "", genre: "", format: "", where: "", level: "", language: "", free: false, sort: "soonest" };

const oneOf = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Reads filters from a query string ("?q=horror&where=online"); unknown values are ignored. */
export function parseFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    q: (p.get("q") ?? "").slice(0, 80),
    system: (p.get("system") ?? "").slice(0, 80),
    genre: (p.get("genre") ?? "").slice(0, 40),
    format: oneOf(p.get("format"), ["", "one_shot", "campaign"] as const, ""),
    where: oneOf(p.get("where"), ["", "online", "in_person"] as const, ""),
    level: oneOf(p.get("level"), ["", "beginner", "any", "experienced"] as const, ""),
    language: oneOf(p.get("language"), ["", "id", "en"] as const, ""),
    free: p.get("free") === "1",
    sort: oneOf(p.get("sort"), ["soonest", "newest", "priceAsc"] as const, "soonest"),
  };
}

/** The query string for filters ("" when nothing differs from the defaults). @example filtersToQuery({ ...EMPTY_FILTERS, q: "horror" }) // "?q=horror" */
export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  (["q", "system", "genre", "format", "where", "level", "language"] as const).forEach((k) => { if (f[k]) p.set(k, f[k]); });
  if (f.free) p.set("free", "1");
  if (f.sort !== "soonest") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** How many filters are on (the sort doesn't count). */
export function activeFilterCount(f: Filters): number {
  return (["q", "system", "genre", "format", "where", "level", "language"] as const).filter((k) => f[k]).length + (f.free ? 1 : 0);
}

export type GameView = SiteGame & { gmName: string };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Every word of the search must appear somewhere in the title, system, summary, city, venue or GM's name. */
function matchesText(g: GameView, q: string): boolean {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = norm([g.title, g.system, g.summary, g.city, g.venueName, g.gmName, g.platform].join(" "));
  return words.every((w) => hay.includes(w));
}

export function sortGames<G extends GameView>(games: G[], sort: SortKey): G[] {
  const byStart = (a: G, b: G) => Date.parse(a.startsAt) - Date.parse(b.startsAt);
  const notFullFirst = (a: G, b: G) => Number(a.full) - Number(b.full); // a full game sinks, whatever the order
  const copy = [...games];
  if (sort === "newest") return copy.sort((a, b) => notFullFirst(a, b) || Date.parse(b.listedAt) - Date.parse(a.listedAt) || byStart(a, b));
  if (sort === "priceAsc") return copy.sort((a, b) => notFullFirst(a, b) || a.priceIdr - b.priceIdr || byStart(a, b));
  return copy.sort((a, b) => notFullFirst(a, b) || byStart(a, b)); // soonest first, full games last
}

export function applyFilters<G extends GameView>(games: G[], f: Filters): G[] {
  return sortGames(
    games.filter((g) =>
      matchesText(g, f.q) &&
      (!f.system || g.system === f.system) &&
      (!f.genre || g.genres.includes(f.genre)) &&
      (!f.format || g.format === f.format) &&
      (!f.where || g.locationType === f.where) &&
      (!f.level || g.level === f.level) &&
      (!f.language || g.language === f.language || g.language === "both") &&
      (!f.free || g.priceIdr === 0),
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
  };
}
