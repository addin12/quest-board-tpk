// Landing pages (ADR-56): one page for each game system and each area that has a game right now, written when the site is built. They answer what
// people type into a search engine ("Cairn games in Depok", "D&D Jakarta Selatan") with a list, not with an empty filter. Only systems from the
// curated list (systems.ts) and the fixed areas (areas.ts) get one: a name a Game Master typed in themselves never becomes a page title.
// Pure module.
import { AREAS } from "./areas.ts";
import { isLive, type GameView } from "./games.ts";
import { SYSTEMS } from "./systems.ts";

/**
 * A name as the address of its page: lower case, no accents, "&" as "and", anything else that is not a letter or digit as one hyphen.
 * @example slugOfName("Mörk Borg") // "mork-borg"
 * @example slugOfName("Dungeons & Dragons 5e 2014") // "dungeons-and-dragons-5e-2014"
 */
export function slugOfName(name: string): string {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export type LandingPage = { name: string; slug: string; games: GameView[] };

/** The places an in-person game is played (an older game names one `city`). Online games name none. */
const placesOf = (g: Pick<GameView, "locationType" | "cities" | "city">): string[] => (g.locationType === "in_person" ? (g.cities?.length ? g.cities : [g.city]) : []);

/** Most games first, then by name, so the pages that matter most come first in the sitemap and in the links between pages. */
const ranked = (pages: LandingPage[]): LandingPage[] => pages.sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name));

/** A page for each system of the curated list that has a game on the site at `nowMs`. */
export function systemPages(games: readonly GameView[], nowMs: number): LandingPage[] {
  const live = games.filter((g) => isLive(g, nowMs));
  return ranked(SYSTEMS.map((name) => ({ name, slug: slugOfName(name), games: live.filter((g) => g.system === name) })).filter((p) => p.games.length > 0));
}

/** A page for each area that has an in-person game on the site at `nowMs` (a game in several places is on each one's page). */
export function areaPages(games: readonly GameView[], nowMs: number): LandingPage[] {
  const live = games.filter((g) => isLive(g, nowMs));
  return ranked(AREAS.map((name) => ({ name, slug: slugOfName(name), games: live.filter((g) => placesOf(g).includes(name)) })).filter((p) => p.games.length > 0));
}
