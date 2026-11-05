// Friendly hints shown to a Game Master while they write a game, so the listing says what a player needs to decide (ADR-49). Never blocks saving: what the server
// requires is in worker/src/rules.ts. Pure module; the messages are translation keys (tip.*).
import type { MsgKey } from "./i18n/core.ts";

export type TipInput = {
  description: string;
  coverKey: string;
  genres: readonly string[];
  characters: string;
  needs: readonly string[];
  locationType: string;
  format: string;
  scheduleNote: string;
};
export type Tip = { id: string; key: MsgKey };

/** The hints that still apply, most useful first. A form that is complete shows none. */
export function listingTips(v: TipInput): Tip[] {
  const tips: Tip[] = [];
  if (v.description.trim().length < 250) tips.push({ id: "description", key: "tip.description" });
  if (!v.coverKey) tips.push({ id: "cover", key: "tip.cover" });
  if (!v.characters) tips.push({ id: "characters", key: "tip.characters" });
  if (v.locationType === "online" && v.needs.length === 0) tips.push({ id: "needs", key: "tip.needs" });
  if (v.format === "campaign" && !v.scheduleNote.trim()) tips.push({ id: "schedule", key: "tip.schedule" });
  if (v.genres.length === 0) tips.push({ id: "genres", key: "tip.genres" });
  return tips;
}
