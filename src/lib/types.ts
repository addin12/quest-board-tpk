// The shapes of the data. Pure module (no imports), shared by the site, the build script, the admin page and tests.
//
// Where the data comes from: the Cloudflare backend (worker/) answers
//   GET  /api/public (build key) and GET /api/live (anyone, cached) -> RawPublicData   (live, unexpired, public fields only: no phone numbers; pictures are bucket keys)
//   POST /api/admin {action:"queue"} -> GameRecord[] and GmRecord[]  (admins only; everything, including emails and notes)
// scripts/build-data.mjs turns RawPublicData into SiteData (pictures downloaded, resized and referenced by path).

export type Lang = "en" | "id";
/**
 * Records one review call may decide. Cloudflare's free plan allows 50 database queries per request (and the mail relay answers one at a time),
 * so a call reads once, writes once in a batch and sends at most this many emails; the admin page sends longer selections in turns.
 */
export const REVIEW_MAX_IDS = 5;

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
  mechanics: string[];
  /** Typical length of one session in hours; 0 when the Game Master did not say. */
  sessionHours: number;
  /** Where the characters come from: ready-made ("pregen"), the players' own ("own") or made together at the table ("table"); "" when not said. */
  characters: "" | "pregen" | "own" | "table";
  /** What players bring or need: keys of NEEDS (categories.ts). */
  needs: string[];
  /** The safety tools the game uses: keys of SAFETY_TOOLS (categories.ts). */
  safetyKeys: string[];
  /** The Game Master says the game has nothing to warn about (the content warnings are then empty on purpose). */
  noWarnings: boolean;
  /** Every place an in-person game can be played (one or more of AREAS, src/lib/areas.ts); empty online. `city` is the first of them. */
  cities: string[];
  /** No fixed date: the Game Master runs it when a group asks (ADR-52). `startsAt` is then only when it was listed and is never shown as a session. */
  onDemand: boolean;
};

/** What a GM writes about themself and the public may read. The phone number is NOT here: it never travels with the public data (ADR-48). */
export type GmPublicFields = {
  name: string;
  bio: string;
  city: string;
  systems: string[];
  /** A lower-case username, or an https invite link; empty when not given. */
  discord: string;
  /** A plain lower-case Instagram username (no @, no link); empty when not given. */
  instagram: string;
};

/** Everything a GM writes about themself; the admin sees all of it, a visitor gets the phone number only by asking for it (POST /api/contact). */
export type GmFields = GmPublicFields & {
  /** Digits with the country code, no plus sign: "6281234567890". */
  whatsapp: string;
};

/** `joinedAt`: when the profile was made (shown as "member since"); `updatedAt`: when the Game Master last changed the game. */
export type RawGm = GmPublicFields & { id: string; slug: string; photoId: string; joinedAt: string };
export type RawGame = GameFields & { id: string; slug: string; gmId: string; coverId: string; full: boolean; listedAt: string; updatedAt: string };
export type RawPublicData = { generatedAt: string; gms: RawGm[]; games: RawGame[]; goneGames: string[]; goneGms: string[] };

/** `photoKey` / `coverKey` are the picture's key in the bucket, kept so live data can tell whether the picture the build cropped is still the current one. */
export type SiteGm = GmPublicFields & { id: string; slug: string; photo: string | null; photoKey?: string; joinedAt: string };
export type SiteGame = GameFields & { id: string; slug: string; gmId: string; cover: string | null; coverKey?: string; full: boolean; listedAt: string; updatedAt: string };
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
  full: boolean;
  adminNote: string;
  reviewedBy: string;
  reviewedAt: string;
  rejectReason: string;
  superseded: boolean;
  submittedAt: string;
  /** When the submitter last changed it; the admin page sends it back with a decision so an approval applies only to the version that was seen. */
  updatedAt?: string;
  /** How many different visitors reported it in the last two weeks (the third holds it back for a look). Admin-only. */
  reports?: number;
  /** The Google account that submitted the form. Admin-only. */
  email: string;
  /** The row in the sheet. */
  row: number;
};

export type GameRecord = AdminFields & GameFields & { kind: "game"; coverId: string; venueMapsRaw: string; consent: boolean };
/** `sharesPhoneWith`: names of other profiles with the same WhatsApp number (a likely second account of one person); filled by the Cloudflare backend. */
export type GmRecord = AdminFields & GmFields & { kind: "gm"; photoId: string; consent: boolean; sharesPhoneWith?: string[]; sharesPhoneIds?: string[] };

export type AdminEntry = { email: string; addedBy: string; addedAt: string };
export type DeployInfo = { lastAt: number | null; pending: boolean; configured: boolean };
export type QueueResponse = { ok: true; now: string; games: GameRecord[]; gms: GmRecord[]; admins: AdminEntry[]; owner: string; deploy: DeployInfo };
