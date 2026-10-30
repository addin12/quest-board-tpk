// What the admin page shows, worked out from the script's queue: each submission with its checks, who its GM is,
// the lists by status, the search, and the wording of a rejection. Pure module, so it is tested without a browser.
import { checkGame, checkGm, hasErrors, type Check } from "./checks.ts";
import { adminPictureUrl } from "./pictures.ts";
import type { GameView } from "./games.ts";
import type { GameRecord, GmRecord, Status } from "./types.ts";
import type { MsgKey, T } from "./i18n/core.ts";

export type Item =
  | { kind: "game"; id: string; rec: GameRecord; gm: GmRecord | undefined; checks: Check[] }
  | { kind: "gm"; id: string; rec: GmRecord; gm: undefined; checks: Check[] };

export const titleOf = (item: Item): string => (item.kind === "game" ? item.rec.title : item.rec.name);

/** Every submission with its checks. `gms` are the current profiles (one per Google account). */
export function buildItems(games: readonly GameRecord[], gms: readonly GmRecord[], nowMs: number): { games: Item[]; gms: Item[] } {
  const byEmail = new Map(gms.map((g) => [g.email, g]));
  return {
    games: games.map((rec) => ({ kind: "game" as const, id: rec.id, rec, gm: byEmail.get(rec.email), checks: checkGame(rec, { gm: byEmail.get(rec.email), games, nowMs }) })),
    gms: gms.map((rec) => ({ kind: "gm" as const, id: rec.id, rec, gm: undefined, checks: checkGm(rec) })),
  };
}

export const canApprove = (item: Item): boolean => !hasErrors(item.checks);

export function countByStatus(items: readonly Item[]): Record<Status, number> {
  const out: Record<Status, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const i of items) out[i.rec.status]++;
  return out;
}

/** The items of one status that match the search, in review order: oldest waiting first, newest decisions first. */
export function filterItems(items: readonly Item[], status: Status, q: string): Item[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = (i: Item) => [titleOf(i), i.rec.email, i.kind === "game" ? `${i.rec.system} ${i.gm?.name ?? ""} ${i.rec.city}` : `${i.rec.city} ${i.rec.systems.join(" ")}`].join(" ").toLowerCase();
  const matches = items.filter((i) => i.rec.status === status && words.every((w) => hay(i).includes(w)));
  const time = (i: Item) => Date.parse(status === "pending" ? i.rec.submittedAt : i.rec.reviewedAt || i.rec.submittedAt) || 0;
  return matches.sort((a, b) => (status === "pending" ? time(a) - time(b) : time(b) - time(a)));
}

export const REASONS = ["incomplete", "date", "contact", "unsuitable", "duplicate", "other"] as const;
export type Reason = (typeof REASONS)[number];

/**
 * The reason a GM is emailed: the chosen reasons in English, then in Indonesian (their language isn't known), then the
 * admin's own note. @example reasonText(["date"], "", tEn, tId) // "The date or time is missing or has passed / Tanggal atau jamnya…"
 */
export function reasonText(reasons: readonly Reason[], note: string, tEn: T, tId: T): string {
  const say = (t: T) => reasons.map((r) => t(`admin.reason.${r}` as MsgKey)).join("; ");
  const parts = reasons.length ? `${say(tEn)} / ${say(tId)}` : "";
  const extra = note.trim();
  return [parts, extra].filter(Boolean).join(". ");
}

/** A game as the public card would show it, with the picture straight from Drive (it is not on the site yet). */
export function previewGame(rec: GameRecord, gm: GmRecord | undefined, nowIso: string): GameView {
  const startsAt = rec.startsAt || nowIso;
  return {
    id: rec.id, slug: rec.slug, gmId: gm?.id ?? "", gmName: gm?.name ?? "", title: rec.title, system: rec.system, summary: rec.summary, description: rec.description,
    format: rec.format, locationType: rec.locationType, platform: rec.platform, city: rec.city, venueName: rec.venueName, venueMapsUrl: rec.venueMapsUrl,
    startsAt, zone: rec.zone, scheduleNote: rec.scheduleNote, expiresAt: rec.expiresAt || startsAt, priceIdr: rec.priceIdr, seats: rec.seats, language: rec.language,
    level: rec.level, minAge: rec.minAge, contentWarnings: rec.contentWarnings, safetyTools: rec.safetyTools, genres: rec.genres, styles: rec.styles,
    cover: rec.coverId ? adminPictureUrl(rec.coverId) : null, featured: rec.featured, full: rec.full, listedAt: rec.submittedAt || startsAt,
  };
}

/** How long ago, in plain words that the dictionary already has: used for "Updated {when}". */
export function whenLabel(iso: number | string | null, lang: "en" | "id", nowMs: number): string {
  if (iso === null) return "";
  const then = typeof iso === "number" ? iso : Date.parse(iso);
  const mins = Math.max(0, Math.round((nowMs - then) / 60_000));
  const rtf = new Intl.RelativeTimeFormat(lang === "id" ? "id-ID" : "en-GB", { numeric: "auto" });
  if (mins < 60) return rtf.format(-mins, "minute");
  if (mins < 60 * 24) return rtf.format(-Math.round(mins / 60), "hour");
  return rtf.format(-Math.round(mins / 1440), "day");
}

/**
 * Whether the newest publish is missing from the page in front of you: it was started more than `graceMs` ago, yet this
 * page was built before it. Either this tab is old (reload) or the build failed (the old site stays up, so nothing else
 * would say so). `builtAt` is when the data of this page's build was read.
 */
export function siteBehind(builtAt: string, lastDeployAt: number | null, nowMs: number, graceMs = 10 * 60_000): boolean {
  const built = Date.parse(builtAt);
  return lastDeployAt !== null && !Number.isNaN(built) && nowMs - lastDeployAt > graceMs && built < lastDeployAt;
}
