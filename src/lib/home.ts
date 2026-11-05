// What the home page shows of the games: the soonest, the beginner-friendly ones, the most listed systems and genres, and a picture for the play-style and mechanic doors.
// Pure, so the build computes it for the first paint and the browser computes it again from the live data. Pure module.
import { GENRES } from "./categories.ts";
import { genreTiles, sortGames, systemTiles, type GameView, type Tile } from "./games.ts";

export type HomeModel = {
  soon: GameView[];
  beginner: GameView[];
  systems: Tile[];
  genres: Tile[];
};

export function homeModel(games: readonly GameView[]): HomeModel {
  // "Starting soon" means a date: games on request (ADR-52) are in the lists, not here
  const soon = sortGames(games.filter((g) => !g.onDemand), "soonest").slice(0, 6);
  const beginner = sortGames(games.filter((g) => g.level === "beginner" && !soon.slice(0, 3).includes(g)), "soonest").slice(0, 3);
  return {
    soon,
    beginner,
    systems: systemTiles(games).slice(0, 10),
    genres: genreTiles(games, GENRES.map((g) => g.key)).slice(0, 10),
  };
}
