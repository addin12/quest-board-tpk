// What a GM may send, checked at the edge: every field is cleaned, bounded and, where it has a fixed set of answers,
// matched against it. The same limits as the site's lists (src/lib/areas.ts, categories.ts). Pure module.
import { AREAS, SUMMARY_MAX } from "../../src/lib/areas.ts";
import { GENRES, MAX_PER_GAME, MECHANICS, STYLES } from "../../src/lib/categories.ts";
import { cleanDiscord, isGoogleMapsUrl, isPhone } from "../../src/lib/public-data.ts";
import { clip, iso } from "./util.ts";

export type Errors = Record<string, string>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Errors };

export const ONLINE_ONLY = "Online only";
const OFFSET_HOURS = { WIB: 7, WITA: 8, WIT: 9 } as const;
const KEY = /^(?:covers|photos)\/[a-z0-9]{8,40}\.(?:webp|jpg|png)$/;

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | "" => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : "");

/** "0812-3456-7890", "+62 812 3456 7890" and "62812…" all become "6281234567890"; "" when it is not a phone number. */
export function normalizePhone(raw: unknown): string {
  let d = typeof raw === "string" ? raw.replace(/[^\d+]/g, "") : "";
  if (!d) return "";
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `62${d.slice(1)}`;
  return isPhone(d) ? d : "";
}

const list = (v: unknown, max: number, each: number): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [])
    .map((x) => clip(x, each))
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .slice(0, max);

export type ProfileInput = { name: string; bio: string; city: string; systems: string[]; whatsapp: string; discord: string; photoKey: string };

export function parseProfile(raw: unknown): Parsed<ProfileInput> {
  const r = asRecord(raw);
  const errors: Errors = {};
  const name = clip(r.name, 60);
  if (name.length < 2) errors.name = "required";
  const city = oneOf(r.city, [...AREAS, ONLINE_ONLY] as const);
  if (!city) errors.city = "choose_one";
  const whatsapp = normalizePhone(r.whatsapp);
  if (!whatsapp) errors.whatsapp = "invalid_phone";
  const discordRaw = clip(r.discord, 200);
  const discord = cleanDiscord(discordRaw);
  if (discordRaw && !discord) errors.discord = "invalid_discord";
  const photoKey = typeof r.photoKey === "string" ? r.photoKey : "";
  if (photoKey && !KEY.test(photoKey)) errors.photoKey = "invalid";
  if (r.consent !== true) errors.consent = "required";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, bio: clip(r.bio, 800, true), city: city as string, systems: list(r.systems, 10, 60), whatsapp, discord, photoKey } };
}

export type GameInput = {
  title: string; system: string; summary: string; description: string; format: "one_shot" | "campaign"; locationType: "online" | "in_person";
  platform: string; city: string; venueName: string; venueMapsRaw: string; startsAt: string; zone: "WIB" | "WITA" | "WIT"; scheduleNote: string; expiresAt: string;
  priceIdr: number; seats: number; language: "id" | "en" | "both"; level: "beginner" | "any" | "experienced"; minAge: number;
  contentWarnings: string; safetyTools: string; genres: string[]; styles: string[]; mechanics: string[]; coverKey: string;
};

const intIn = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** "2026-11-08" and "19:00" in a zone as an ISO instant in UTC; null if either is not a real date or time. */
export function zonedInstant(date: unknown, time: unknown, zone: keyof typeof OFFSET_HOURS): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof date === "string" ? date : "");
  const t = /^(\d{2}):(\d{2})$/.exec(typeof time === "string" ? time : "");
  if (!d || !t) return null;
  const [y, mo, day, h, mi] = [+d[1]!, +d[2]!, +d[3]!, +t[1]!, +t[2]!];
  const probe = new Date(Date.UTC(y, mo - 1, day));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== day || h > 23 || mi > 59) return null;
  return iso(Date.UTC(y, mo - 1, day, h, mi) - OFFSET_HOURS[zone] * 3_600_000);
}

export function parseGame(raw: unknown, nowMs: number): Parsed<GameInput> {
  const r = asRecord(raw);
  const errors: Errors = {};
  const need = (field: string, ok: boolean, code = "required") => { if (!ok) errors[field] = code; };

  const title = clip(r.title, 100);
  need("title", title.length >= 3);
  let system = clip(r.system, 80);
  if (system === "Other") system = clip(r.otherSystem, 80);
  need("system", system.length > 0);
  const summary = clip(r.summary, 400);
  need("summary", summary.length > 0);
  if (summary.length > SUMMARY_MAX) errors.summary = "too_long";
  const description = clip(r.description, 4000, true);
  need("description", description.length >= 20);
  const format = oneOf(r.format, ["one_shot", "campaign"] as const);
  need("format", Boolean(format), "choose_one");
  const locationType = oneOf(r.locationType, ["online", "in_person"] as const);
  need("locationType", Boolean(locationType), "choose_one");
  const city = locationType === "in_person" ? oneOf(r.city, AREAS) : "";
  if (locationType === "in_person") need("city", Boolean(city), "choose_one");
  const venueMapsRaw = clip(r.venueMapsRaw, 500);
  if (venueMapsRaw && !isGoogleMapsUrl(venueMapsRaw)) errors.venueMapsRaw = "invalid_link";
  const zone = oneOf(r.zone, ["WIB", "WITA", "WIT"] as const);
  need("zone", Boolean(zone), "choose_one");
  const startsAt = zone ? zonedInstant(r.date, r.time, zone) : null;
  need("date", Boolean(startsAt), "invalid_date");
  let expiresAt = "";
  if (startsAt && zone) {
    if (r.keepUntil) {
      const end = zonedInstant(r.keepUntil, "23:59", zone);
      if (!end) errors.keepUntil = "invalid_date";
      else if (Date.parse(end) < Date.parse(startsAt)) errors.keepUntil = "before_start";
      else expiresAt = end;
    } else expiresAt = iso(Date.parse(startsAt) + 86_400_000);
    if (expiresAt && Date.parse(expiresAt) <= nowMs) errors.date = "in_the_past";
  }
  const priceIdr = intIn(r.priceIdr, 0, 10_000_000);
  need("priceIdr", priceIdr !== null, "invalid_number");
  const seats = intIn(r.seats, 1, 20);
  need("seats", seats !== null, "invalid_number");
  const language = oneOf(r.language, ["id", "en", "both"] as const);
  need("language", Boolean(language), "choose_one");
  const level = oneOf(r.level, ["beginner", "any", "experienced"] as const);
  need("level", Boolean(level), "choose_one");
  const minAge = r.minAge === undefined || r.minAge === "" ? 0 : intIn(r.minAge, 0, 99);
  need("minAge", minAge !== null, "invalid_number");
  const genreKeys = GENRES.map((g) => g.key) as readonly string[];
  const styleKeys = STYLES.map((s) => s.key) as readonly string[];
  const mechanicKeys = MECHANICS.map((m) => m.key) as readonly string[];
  const genres = list(r.genres, 50, 40);
  const styles = list(r.styles, 50, 40);
  const mechanics = list(r.mechanics, 50, 40);
  if (genres.length > MAX_PER_GAME || genres.some((g) => !genreKeys.includes(g))) errors.genres = "invalid";
  if (styles.length > MAX_PER_GAME || styles.some((s) => !styleKeys.includes(s))) errors.styles = "invalid";
  if (mechanics.length > MAX_PER_GAME || mechanics.some((m) => !mechanicKeys.includes(m))) errors.mechanics = "invalid";
  const coverKey = typeof r.coverKey === "string" ? r.coverKey : "";
  if (coverKey && !KEY.test(coverKey)) errors.coverKey = "invalid";
  if (r.consent !== true) errors.consent = "required";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title, system, summary, description, format: format as GameInput["format"], locationType: locationType as GameInput["locationType"],
      platform: clip(r.platform, 80), city, venueName: clip(r.venueName, 80), venueMapsRaw, startsAt: startsAt!, zone: zone as GameInput["zone"],
      scheduleNote: clip(r.scheduleNote, 1000, true), expiresAt, priceIdr: priceIdr!, seats: seats!, language: language as GameInput["language"],
      level: level as GameInput["level"], minAge: minAge!, contentWarnings: clip(r.contentWarnings, 1000, true), safetyTools: clip(r.safetyTools, 300),
      genres, styles, mechanics, coverKey,
    },
  };
}
