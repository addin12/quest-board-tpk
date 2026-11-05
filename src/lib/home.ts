// What the home page shows of the games: the soonest, the beginner-friendly ones, the most listed systems and genres, and a picture for the play-style and mechanic doors.
// Pure, so the build computes it for the first paint and the browser computes it again from the live data. Pure module.
import { GENRES } from "./categories.ts";
import { genreTiles, sortGames, systemTiles, type GameView, type Tile } from "./games.ts";

export type HomeModel = {
  soon: GameView[];
  beginner: GameView[];
  systems: Tile[];
  genres: Tile[];
  /** Play styles and mechanics have no pictures of their own: their doors borrow the cover of a listed game that has one. */
  styledCover: string | null;
  mechanicalCover: string | null;
};

export function homeModel(games: readonly GameView[]): HomeModel {
  const soon = sortGames([...games], "soonest").slice(0, 6);
  const beginner = sortGames(games.filter((g) => g.level === "beginner" && !soon.slice(0, 3).includes(g)), "soonest").slice(0, 3);
  const pictured = games.filter((g) => g.cover);
  const styled = pictured.find((g) => g.styles.length > 0);
  const mechanical = pictured.find((g) => g.mechanics.length > 0 && g !== styled) ?? pictured.find((g) => g.mechanics.length > 0);
  return {
    soon,
    beginner,
    systems: systemTiles(games).slice(0, 10),
    genres: genreTiles(games, GENRES.map((g) => g.key)).slice(0, 10),
    styledCover: styled?.cover ?? null,
    mechanicalCover: mechanical?.cover ?? null,
  };
}
