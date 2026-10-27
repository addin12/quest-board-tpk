// The shapes of the data. Pure module (no imports), shared by the site, the build script, the admin page and tests.
//
// Where the data comes from: the Google Sheet's script (apps-script/Code.gs) answers
//   GET  ?action=public  -> RawPublicData   (approved, unexpired, public fields only; pictures are Drive file ids)
//   POST {action:"queue"} -> GameRecord[] and GmRecord[]  (admins only; everything, including emails and notes)
// scripts/build-data.mjs turns RawPublicData into SiteData (pictures downloaded, resized and referenced by path).

export type Lang = "en" | "id";
export const LANGS: readonly Lang[] = ["en", "id"];
export const DEFAULT_LANG: Lang = "en";
export const isLang = (v: unknown): v is Lang => v === "en" || v === "id";

/** Indonesia's three time zones; none has daylight saving, so each is a fixed offset from UTC. */
export type Zone = "WIB" | "WITA" | "WIT";
export const ZONES: readonly Zone[] = ["WIB", "WITA", "WIT"];
export const ZONE_TZ: Record<Zone, string> = { WIB: "Asia/Jakarta", WITA: "Asia/Makassar", WIT: "Asia/Jayapura" };

export type GameFormat = "one_shot" | "campaign";
export type LocationType = "online" | "in_person";
export type GameLanguage = "id" | "en" | "both";
export type Level = "beginner" | "any" | "experienced";

/** What a GM writes about their game. */
export type GameFields = {
  title: string;
  system: string;
  summary: string;
  description: string;
  format: GameFormat;
  locationType: LocationType;
  platform: string;
  city: string;
  venueName: string;
  venueMapsUrl: string;
  /** The first session, ISO 8601 UTC. */
  startsAt: string;
  zone: Zone;
  scheduleNote: string;
  /** The listing disappears from the site after this instant. */
  expiresAt: string;
  /** Whole Rupiah per seat; 0 is free. Information only: Quest Board takes no payment. */
  priceIdr: number;
  seats: number;
  language: GameLanguage;
  level: Level;
  minAge: number;
  contentWarnings: string;
  safetyTools: string;
  genres: string[];
  styles: string[];
};

/** What a GM writes about themself. */
export type GmFields = {
  name: string;
  bio: string;
  city: string;
  systems: string[];
  /** Digits with the country code, no plus sign: "6281234567890". */
  whatsapp: string;
  /** A lower-case username, or an https invite link; empty when not given. */
  discord: string;
};

export type RawGm = GmFields & { id: string; slug: string; photoId: string };
export type RawGame = GameFields & { id: string; slug: string; gmId: string; coverId: string; featured: boolean; listedAt: string };
export type RawPublicData = { generatedAt: string; gms: RawGm[]; games: RawGame[]; goneGames: string[]; goneGms: string[] };

export type SiteGm = GmFields & { id: string; slug: string; photo: string | null };
export type SiteGame = GameFields & { id: string; slug: string; gmId: string; cover: string | null; featured: boolean; listedAt: string };
/** `goneGames` / `goneGms`: addresses of listings that were live and are not now; each gets a "no longer listed" page. */
export type SiteData = { generatedAt: string; gms: SiteGm[]; games: SiteGame[]; goneGames: string[]; goneGms: string[] };

// ── The admin side ─────────────────────────────────────────────────────────────────────────

export type Status = "pending" | "approved" | "rejected";
export const STATUSES: readonly Status[] = ["pending", "approved", "rejected"];

/** Columns the script adds to each response, plus who sent it. */
export type AdminFields = {
  id: string;
  slug: string;
  status: Status;
  featured: boolean;
  adminNote: string;
  reviewedBy: string;
  reviewedAt: string;
  rejectReason: string;
  superseded: boolean;
  submittedAt: string;
  /** The Google account that submitted the form. Admin-only. */
  email: string;
  /** The row in the sheet. */
  row: number;
};

export type GameRecord = AdminFields & GameFields & { kind: "game"; coverId: string; venueMapsRaw: string; consent: boolean };
export type GmRecord = AdminFields & GmFields & { kind: "gm"; photoId: string; consent: boolean };
export type AdminRecord = GameRecord | GmRecord;

export type AdminEntry = { email: string; addedBy: string; addedAt: string };
export type DeployInfo = { lastAt: number | null; pending: boolean; configured: boolean };
export type QueueResponse = { ok: true; now: string; games: GameRecord[]; gms: GmRecord[]; admins: AdminEntry[]; owner: string; deploy: DeployInfo };
