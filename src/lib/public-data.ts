// The site is built from data a form wrote, so it is checked again here, at the boundary, whatever the script
// promised: a bad record is dropped with a warning (it never breaks the build or the page), and every
// string is cut to a sane length. Pure module (explicit .ts imports: scripts/build-data.mjs runs it directly).
import { ZONES, type GameLanguage, type Level, type RawGame, type RawGm, type RawPublicData, type Zone } from "./types.ts";
import { GENRES, MECHANICS, STYLES } from "./categories.ts";

const GENRE_KEYS: readonly string[] = GENRES.map((g) => g.key);
const STYLE_KEYS: readonly string[] = STYLES.map((s) => s.key);
const MECHANIC_KEYS: readonly string[] = MECHANICS.map((m) => m.key);
const MAX_GAMES = 500;
const MAX_GMS = 300;

const SLUG = /^[a-z0-9][a-z0-9-]{2,80}$/;
const ID = /^[a-z0-9][a-z0-9-]{3,40}$/;
/** A Drive file id, or a path inside this project (`local:/images/…`, for the sample data only). */
const PICTURE = /^(?:[A-Za-z0-9_-]{10,100}|(?:covers|photos)\/[a-z0-9]{8,40}\.(?:webp|jpg|png)|local:\/[A-Za-z0-9/_.-]{1,120})$/;

const asRecord = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Trimmed text with control characters removed (newlines kept when `multiline`), cut to `max`. */
export function text(v: unknown, max: number, multiline = false): string {
  if (typeof v !== "string") return "";
  const s = v.replace(/\r\n?/g, "\n").replace(multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function isGoogleMapsUrl(v: string): boolean {
  if (!v || v.length > 500 || /[\s<>"']/.test(v)) return false;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return u.pathname.length > 1;
  if (host === "goo.gl") return u.pathname.startsWith("/maps/");
  if (/^(www\.)?google\.(com|co\.id)$/.test(host)) return u.pathname === "/maps" || u.pathname.startsWith("/maps/");
  return /^maps\.google\.(com|co\.id)$/.test(host);
}

/** Discord: a lower-case username, or an https invite link on discord.gg or discord.com/invite. */
export function cleanDiscord(v: unknown): string {
  const s = text(v, 200);
  if (/^https:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const ok = (u.hostname === "discord.gg" && u.pathname.length > 1) || (/^(www\.)?discord\.com$/.test(u.hostname) && u.pathname.startsWith("/invite/"));
      return ok && !u.username && !u.password && !u.port ? `https://${u.hostname}${u.pathname}` : "";
    } catch {
      return "";
    }
  }
  const handle = s.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_.]{2,32}$/.test(handle) ? handle : "";
}

export const isPhone = (v: unknown): v is string => typeof v === "string" && /^[1-9]\d{7,14}$/.test(v);

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const pickKeys = (v: unknown, allowed: readonly string[]) =>
  (Array.isArray(v) ? v : []).filter((k): k is string => typeof k === "string" && allowed.includes(k)).filter((k, i, a) => a.indexOf(k) === i).slice(0, 3);

const intIn = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;

function parseGm(raw: unknown, warn: (m: string) => void): RawGm | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = typeof r.id === "string" ? r.id : "";
  const name = text(r.name, 60);
  if (!ID.test(id) || !SLUG.test(String(r.slug)) || !name) { warn(`GM ${id || "?"}: missing id, slug or name`); return null; }
  if (!isPhone(r.whatsapp)) { warn(`GM ${name}: the WhatsApp number is not valid`); return null; }
  const photoId = typeof r.photoId === "string" && PICTURE.test(r.photoId) ? r.photoId : "";
  return {
    id, slug: String(r.slug), name, bio: text(r.bio, 800, true), city: text(r.city, 60), whatsapp: r.whatsapp, discord: cleanDiscord(r.discord), photoId,
    systems: (Array.isArray(r.systems) ? r.systems : []).map((s) => text(s, 40)).filter(Boolean).slice(0, 8),
  };
}

function parseGame(raw: unknown, gmIds: ReadonlySet<string>, warn: (m: string) => void): RawGame | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = typeof r.id === "string" ? r.id : "";
  const title = text(r.title, 100);
  const bad = (why: string) => { warn(`Game ${title || id || "?"}: ${why}`); return null; };
  if (!ID.test(id) || !SLUG.test(String(r.slug)) || !title) return bad("missing id, slug or title");
  if (typeof r.gmId !== "string" || !gmIds.has(r.gmId)) return bad("its Game Master is not listed");
  const startsAt = isoOrNull(r.startsAt);
  const expiresAt = isoOrNull(r.expiresAt);
  if (!startsAt || !expiresAt || Date.parse(expiresAt) <= Date.parse(startsAt)) return bad("the date is missing or wrong");
  if (r.format !== "one_shot" && r.format !== "campaign") return bad("format must be one-shot or campaign");
  if (r.locationType !== "online" && r.locationType !== "in_person") return bad("location type must be online or in person");
  const zone = ZONES.includes(r.zone as Zone) ? (r.zone as Zone) : null;
  const priceIdr = intIn(r.priceIdr, 0, 10_000_000);
  const seats = intIn(r.seats, 1, 20);
  const minAge = intIn(r.minAge, 0, 99);
  if (!zone || priceIdr === null || seats === null || minAge === null) return bad("zone, price, seats or minimum age is out of range");
  const language: GameLanguage = r.language === "en" || r.language === "both" ? r.language : "id";
  const level: Level = r.level === "beginner" || r.level === "experienced" ? r.level : "any";
  const system = text(r.system, 80);
  if (!system) return bad("no game system");
  const maps = text(r.venueMapsUrl, 500);
  const venueMapsUrl = isGoogleMapsUrl(maps) ? maps : "";
  if (maps && !venueMapsUrl) warn(`Game ${title}: the venue's map link was not a Google Maps link and was left out`);
  return {
    id, slug: String(r.slug), gmId: r.gmId, title, system, summary: text(r.summary, 200), description: text(r.description, 4000, true),
    format: r.format, locationType: r.locationType, platform: text(r.platform, 80), city: text(r.city, 60), venueName: text(r.venueName, 80), venueMapsUrl,
    startsAt, zone, scheduleNote: text(r.scheduleNote, 400, true), expiresAt, priceIdr, seats, language, level, minAge,
    contentWarnings: text(r.contentWarnings, 400, true), safetyTools: text(r.safetyTools, 200),
    genres: pickKeys(r.genres, GENRE_KEYS), styles: pickKeys(r.styles, STYLE_KEYS), mechanics: pickKeys(r.mechanics, MECHANIC_KEYS),
    coverId: typeof r.coverId === "string" && PICTURE.test(r.coverId) ? r.coverId : "", full: r.full === true, listedAt: isoOrNull(r.listedAt) ?? startsAt,
  };
}

/**
 * Checks what the script returned. Bad records are dropped and described in `warnings` (the build prints them);
 * duplicates by id or slug keep the first; games whose GM didn't survive are dropped.
 */
export function parsePublicData(input: unknown): { data: RawPublicData; warnings: string[] } {
  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);
  const root = asRecord(input);
  if (!root || !Array.isArray(root.gms) || !Array.isArray(root.games)) throw new Error("The public data has no gms and games lists.");
  if (root.gms.length > MAX_GMS || root.games.length > MAX_GAMES) warn(`More than ${MAX_GMS} Game Masters or ${MAX_GAMES} games: the rest are ignored.`);

  const slugs = new Set<string>();
  const gms: RawGm[] = [];
  for (const raw of root.gms.slice(0, MAX_GMS)) {
    const gm = parseGm(raw, warn);
    if (!gm) continue;
    if (gms.some((g) => g.id === gm.id) || slugs.has(gm.slug)) { warn(`GM ${gm.name}: duplicate id or slug, ignored`); continue; }
    slugs.add(gm.slug);
    gms.push(gm);
  }
  const gmIds = new Set(gms.map((g) => g.id));
  const gameSlugs = new Set<string>();
  const games: RawGame[] = [];
  for (const raw of root.games.slice(0, MAX_GAMES)) {
    const game = parseGame(raw, gmIds, warn);
    if (!game) continue;
    if (games.some((g) => g.id === game.id) || gameSlugs.has(game.slug)) { warn(`Game ${game.title}: duplicate id or slug, ignored`); continue; }
    gameSlugs.add(game.slug);
    games.push(game);
  }
  const goneGames = parseGone(root.goneGames, gameSlugs, "games", warn);
  const goneGms = parseGone(root.goneGms, slugs, "Game Masters", warn);
  return { data: { generatedAt: isoOrNull(root.generatedAt) ?? new Date().toISOString(), gms, games, goneGames, goneGms }, warnings };
}

const MAX_GONE = 5000;

/** Addresses of listings that are not live now. Anything that is not a plain address, or is live, is dropped. */
function parseGone(raw: unknown, live: Set<string>, what: string, warn: (m: string) => void): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) { warn(`The list of gone ${what} is not a list: ignored`); return []; }
  const out = new Set<string>();
  for (const item of raw.slice(0, MAX_GONE)) {
    if (typeof item !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(item)) warn(`A gone ${what} address is not a plain address: ignored`);
    else if (live.has(item)) warn(`A gone ${what} address is also live: ignored`);
    else out.add(item);
  }
  return [...out].sort();
}
