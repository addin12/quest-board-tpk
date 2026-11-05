// A game that meets again and again (ADR-51). The Game Master gives the first session and how often it repeats; everyone else sees the NEXT session, worked out
// from that. Indonesia's zones have no daylight saving, so "7 days later" is the same wall-clock time. Pure module.
import type { MsgKey } from "./i18n/core.ts";

/** How many days after each session the next one is: every week, every 2 weeks, every 4 weeks. 0 (not in this list) is a single session. */
export const REPEAT_DAYS = [7, 14, 28] as const;
export const isRepeat = (n: unknown): n is (typeof REPEAT_DAYS)[number] => (REPEAT_DAYS as readonly unknown[]).includes(n);
export const repeatLabelKey = (days: number) => `repeat.${days}` as MsgKey;

const DAY_MS = 86_400_000;
/** A repeating game with no "keep until" date is listed this long after its first session; the Game Master extends it from their account page. */
export const REPEAT_DEFAULT_LISTING_DAYS = 90;
/** One press of "extend" keeps a repeating listing this much longer. */
export const EXTEND_DAYS = 30;
/** The Game Master of a repeating listing is emailed once when it has this long left. */
export const NUDGE_BEFORE_DAYS = 3;

/**
 * The first session at or after `nowMs`: the first session itself if it is still ahead (or the game does not repeat), else the first one in the series that is.
 * @example nextSession(Date.parse("2026-11-07T12:00:00Z"), 7, Date.parse("2026-11-20T00:00:00Z")) // Sat 21 Nov, 12:00 UTC
 */
export function nextSession(startsAtMs: number, repeatDays: number, nowMs: number): number {
  if (!isRepeat(repeatDays) || startsAtMs >= nowMs) return startsAtMs;
  const step = repeatDays * DAY_MS;
  return startsAtMs + Math.ceil((nowMs - startsAtMs) / step) * step;
}
