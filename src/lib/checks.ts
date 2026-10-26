// What the admin page tells a reviewer about a submission before they decide: what is missing, what looks
// wrong, what looks like a scam. An "error" means the listing could not show correctly (the Approve button
// stays off until the GM fixes it); a "warn" is worth a look; an "info" is just good to know.
// Pure module. Messages are translation keys (check.*).
import { scamSignals } from "./scam-signals.ts";
import type { MsgKey } from "./i18n/core.ts";
import type { GameRecord, GmRecord } from "./types.ts";

export type CheckLevel = "error" | "warn" | "info";
export type Check = { id: string; level: CheckLevel; key: MsgKey; vars?: Record<string, string | number> };

const ORDER: Record<CheckLevel, number> = { error: 0, warn: 1, info: 2 };
const sorted = (checks: Check[]) => checks.sort((a, b) => ORDER[a.level] - ORDER[b.level]);

export const hasErrors = (checks: readonly Check[]): boolean => checks.some((c) => c.level === "error");

/** Checks on a game. `gm` is the profile of the same Google account (undefined if there is none). */
export function checkGame(game: GameRecord, ctx: { gm: GmRecord | undefined; games: readonly GameRecord[]; nowMs: number }): Check[] {
  const out: Check[] = [];
  const add = (id: string, level: CheckLevel, key: MsgKey, vars?: Check["vars"]) => out.push({ id, level, key, vars });

  if (!game.consent) add("consent", "error", "check.consent");
  if (!game.startsAt) add("date", "error", "check.dateUnreadable");
  else if (Date.parse(game.startsAt) < ctx.nowMs) add("datePast", "warn", "check.datePast");
  if (!ctx.gm) add("gmMissing", "error", "check.gmMissing", { email: game.email });
  else if (ctx.gm.status !== "approved") add("gmNotApproved", "warn", "check.gmNotApproved", { name: ctx.gm.name });
  if (!game.system) add("system", "error", "check.noSystem");
  if (game.locationType === "in_person" && !game.city) add("city", "error", "check.noCity");
  if (game.locationType === "online" && !game.platform) add("platform", "warn", "check.noPlatform");
  if (game.venueMapsRaw) add("maps", "warn", "check.mapsInvalid");
  const signals = scamSignals([game.title, game.summary, game.description, game.venueName, game.scheduleNote, game.platform].join("\n"));
  if (signals.length) add("scam", "warn", "check.scam", { signals: signals.join(",") });
  const title = game.title.toLowerCase();
  if (ctx.games.some((g) => g.id !== game.id && !g.superseded && g.email === game.email && g.title.toLowerCase() === title)) add("duplicate", "warn", "check.duplicate");
  if (!game.coverId) add("cover", "info", "check.noCover");
  if (game.description.length < 80) add("short", "info", "check.shortDescription");
  if (game.priceIdr > 500_000) add("price", "info", "check.priceHigh");
  if (game.genres.length === 0) add("genres", "info", "check.noGenres");
  return sorted(out);
}

export function checkGm(gm: GmRecord): Check[] {
  const out: Check[] = [];
  const add = (id: string, level: CheckLevel, key: MsgKey, vars?: Check["vars"]) => out.push({ id, level, key, vars });
  if (!gm.consent) add("consent", "error", "check.consent");
  if (!gm.whatsapp) add("phone", "error", "check.phone");
  if (gm.name.length < 2) add("name", "error", "check.noName");
  const signals = scamSignals([gm.name, gm.bio].join("\n"));
  if (signals.length) add("scam", "warn", "check.scam", { signals: signals.join(",") });
  if (!gm.bio) add("bio", "info", "check.noBio");
  if (!gm.photoId) add("photo", "info", "check.noPhoto");
  return sorted(out);
}
