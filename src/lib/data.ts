// The site's data, read once from what scripts/build-data.mjs wrote. Server-side only (pages call it while the
// site is built): the browser gets what the page passes down.
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SiteData, SiteGame, SiteGm } from "./types.ts";
import type { GameView } from "./games.ts";

let cache: SiteData | null = null;

export function loadSiteData(): SiteData {
  if (!cache) cache = JSON.parse(readFileSync(path.join(process.cwd(), "src", "generated", "data.json"), "utf8")) as SiteData;
  return cache;
}

/** Games with their Game Master's name attached, soonest first. */
export function gameViews(data: SiteData = loadSiteData()): GameView[] {
  const names = new Map(data.gms.map((g) => [g.id, g.name]));
  return data.games
    .map((g) => ({ ...g, gmName: names.get(g.gmId) ?? "" }))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export const gmById = (data: SiteData, id: string): SiteGm | undefined => data.gms.find((g) => g.id === id);
export const gamesOf = (data: SiteData, gmId: string): SiteGame[] => data.games.filter((g) => g.gmId === gmId).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
