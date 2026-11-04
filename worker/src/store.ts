// What a signed-in GM can do: keep one profile, list games, mark one full, remove one, erase everything.
// Every write is tied to the session's account, never to an id the client sends alone.
import { exec, many, one } from "./db.ts";
import type { Ctx, Session } from "./auth.ts";
import type { GameInput, ProfileInput } from "./rules.ts";
import type { GameRecord, GmRecord } from "../../src/lib/types.ts";
import { isGoogleMapsUrl } from "../../src/lib/public-data.ts";
import { DAY_MS, iso, logEvent, metaSet, parseList, randomId, slugify } from "./util.ts";

export type ProfileRow = {
  id: string; account_id: string; slug: string; name: string; bio: string; city: string; systems: string; whatsapp: string; discord: string; instagram: string; photo_key: string; consent: number;
  status: "pending" | "approved" | "rejected"; admin_note: string; reviewed_by: string; reviewed_at: string; reject_reason: string; was_live: number; gone_at: string; created_at: string; updated_at: string; rowid?: number;
};
export type GameRow = {
  id: string; profile_id: string; slug: string; title: string; system: string; summary: string; description: string; format: GameRecord["format"]; location_type: GameRecord["locationType"];
  platform: string; city: string; venue_name: string; venue_maps_raw: string; starts_at: string; zone: GameRecord["zone"]; schedule_note: string; expires_at: string; price_idr: number; seats: number;
  language: GameRecord["language"]; level: GameRecord["level"]; min_age: number; content_warnings: string; safety_tools: string; genres: string; styles: string; mechanics: string; cover_key: string; consent: number;
  status: "pending" | "approved" | "rejected"; full: number; admin_note: string; reviewed_by: string; reviewed_at: string; reject_reason: string; was_live: number; gone_at: string;
  removed: number; created_at: string; updated_at: string; rowid?: number;
};

export const markDirty = (ctx: Ctx): Promise<number> => metaSet(ctx.db, "dirty", iso(ctx.now()));

export const profileOf = (ctx: Ctx, accountId: string) => one<ProfileRow>(ctx.db, "SELECT rowid, * FROM profiles WHERE account_id = ?", accountId);

// ── Rows to the shapes the site and the admin page already use ────────────────────────────────────────────────────────

export function gmRecord(p: ProfileRow, email: string, shares: { id: string; name: string }[] = []): GmRecord {
  return {
    kind: "gm", id: p.id, slug: p.slug, status: p.status, full: false, adminNote: p.admin_note, reviewedBy: p.reviewed_by, reviewedAt: p.reviewed_at,
    rejectReason: p.reject_reason, superseded: false, submittedAt: p.created_at, updatedAt: p.updated_at, email, row: p.rowid ?? 0,
    name: p.name, bio: p.bio, city: p.city, systems: parseList(p.systems), whatsapp: p.whatsapp, discord: p.discord, instagram: p.instagram, photoId: p.photo_key, consent: p.consent === 1, sharesPhoneWith: shares.map((s) => s.name), sharesPhoneIds: shares.map((s) => s.id),
  };
}

export function gameRecord(g: GameRow, email: string): GameRecord {
  return {
    kind: "game", id: g.id, slug: g.slug, status: g.status, full: g.full === 1, adminNote: g.admin_note, reviewedBy: g.reviewed_by, reviewedAt: g.reviewed_at,
    rejectReason: g.reject_reason, superseded: false, submittedAt: g.created_at, updatedAt: g.updated_at, email, row: g.rowid ?? 0,
    title: g.title, system: g.system, summary: g.summary, description: g.description, format: g.format, locationType: g.location_type, platform: g.platform, city: g.city,
    venueName: g.venue_name, venueMapsUrl: isGoogleMapsUrl(g.venue_maps_raw) ? g.venue_maps_raw : "", venueMapsRaw: g.venue_maps_raw, startsAt: g.starts_at, zone: g.zone,
    scheduleNote: g.schedule_note, expiresAt: g.expires_at, priceIdr: g.price_idr, seats: g.seats, language: g.language, level: g.level, minAge: g.min_age,
    contentWarnings: g.content_warnings, safetyTools: g.safety_tools, genres: parseList(g.genres), styles: parseList(g.styles), mechanics: parseList(g.mechanics), coverId: g.cover_key, consent: g.consent === 1,
  };
}

/** The parts of a record only admins see: the private note and who reviewed it. The GM keeps the reject reason, which is written for them. */
const forGm = <R extends { adminNote: string; reviewedBy: string }>(r: R): R => ({ ...r, adminNote: "", reviewedBy: "" });

/** How long an admin's request to merge another profile into yours waits for an answer. */
export const MERGE_REQUEST_DAYS = 7;

/** What a GM sees of their own account: the profile, their games (removed ones left out) and the merge requests waiting for their answer. */
export async function mine(ctx: Ctx, s: Session) {
  const p = await profileOf(ctx, s.accountId);
  const games = p ? await many<GameRow>(ctx.db, "SELECT rowid, * FROM games WHERE profile_id = ? AND removed = 0 ORDER BY created_at DESC", p.id) : [];
  const offers = p
    ? await many<{ id: string; name: string; email: string; created_at: string }>(
        ctx.db,
        "SELECT r.id, p.name, a.email, r.created_at FROM merge_requests r JOIN profiles p ON p.id = r.from_profile_id JOIN accounts a ON a.id = p.account_id WHERE r.into_profile_id = ? AND r.created_at >= ? ORDER BY r.created_at",
        p.id, iso(ctx.now() - MERGE_REQUEST_DAYS * DAY_MS),
      )
    : [];
  return {
    email: s.email,
    profile: p ? forGm(gmRecord(p, s.email)) : null,
    games: games.map((g) => forGm(gameRecord(g, s.email))),
    mergeOffers: offers.map((o) => ({ id: o.id, name: o.name, email: o.email, askedAt: o.created_at })),
  };
}

// ── Writes ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Creates the profile or changes it. A change to a profile that was decided puts it back to "pending" (it leaves the site until
 * an admin approves again); sending the same content again changes nothing.
 */
export async function saveProfile(ctx: Ctx, s: Session, input: ProfileInput): Promise<{ id: string; status: ProfileRow["status"]; changed: boolean; dropped: string[] }> {
  const now = iso(ctx.now());
  const p = await profileOf(ctx, s.accountId);
  if (!p) {
    const id = randomId(9);
    const slug = `${slugify(input.name)}-${randomId(4)}`;
    await exec(ctx.db, "INSERT INTO profiles (id, account_id, slug, name, bio, city, systems, whatsapp, discord, instagram, photo_key, consent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
      id, s.accountId, slug, input.name, input.bio, input.city, JSON.stringify(input.systems), input.whatsapp, input.discord, input.instagram, input.photoKey, now, now);
    await logEvent(ctx.db, ctx.now(), "submitted", "gm", id, input.name, "new profile", s.email);
    return { id, status: "pending", changed: true, dropped: [] };
  }
  const unchanged = p.name === input.name && p.bio === input.bio && p.city === input.city && same(parseList(p.systems), input.systems) && p.whatsapp === input.whatsapp && p.discord === input.discord && p.instagram === input.instagram && p.photo_key === input.photoKey;
  if (unchanged) return { id: p.id, status: p.status, changed: false, dropped: [] };
  await exec(ctx.db, "UPDATE profiles SET name = ?, bio = ?, city = ?, systems = ?, whatsapp = ?, discord = ?, instagram = ?, photo_key = ?, consent = 1, status = 'pending', reject_reason = '', updated_at = ? WHERE id = ?",
    input.name, input.bio, input.city, JSON.stringify(input.systems), input.whatsapp, input.discord, input.instagram, input.photoKey, now, p.id);
  await logEvent(ctx.db, ctx.now(), "edited", "gm", p.id, input.name, `${p.status} → pending: the GM changed it`, s.email);
  if (p.status === "approved") await markDirty(ctx);
  return { id: p.id, status: "pending", changed: true, dropped: p.photo_key && p.photo_key !== input.photoKey ? [p.photo_key] : [] };
}

/** Games a profile may have at once (removed ones do not count). A real GM runs a handful; the cap keeps the site's tables small. */
export const MAX_GAMES_PER_PROFILE = 30;

export type SaveGameResult = { ok: true; id: string; status: GameRow["status"]; changed: boolean; dropped: string[] } | { ok: false; error: "no_profile" | "not_found" | "too_many" };

/** Creates a game for the signed-in GM (`gameId` null) or changes one of theirs. Same "back to pending" rule as the profile. */
export async function saveGame(ctx: Ctx, s: Session, gameId: string | null, input: GameInput): Promise<SaveGameResult> {
  const p = await profileOf(ctx, s.accountId);
  if (!p) return { ok: false, error: "no_profile" };
  const now = iso(ctx.now());
  const values = [input.title, input.system, input.summary, input.description, input.format, input.locationType, input.platform, input.city, input.venueName, input.venueMapsRaw, input.startsAt, input.zone,
    input.scheduleNote, input.expiresAt, input.priceIdr, input.seats, input.language, input.level, input.minAge, input.contentWarnings, input.safetyTools, JSON.stringify(input.genres), JSON.stringify(input.styles), JSON.stringify(input.mechanics), input.coverKey];
  const cols = "title, system, summary, description, format, location_type, platform, city, venue_name, venue_maps_raw, starts_at, zone, schedule_note, expires_at, price_idr, seats, language, level, min_age, content_warnings, safety_tools, genres, styles, mechanics, cover_key";
  if (gameId === null) {
    const open = await one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM games WHERE profile_id = ? AND removed = 0", p.id);
    if ((open?.n ?? 0) >= MAX_GAMES_PER_PROFILE) return { ok: false, error: "too_many" };
    const id = randomId(9);
    const slug = `${slugify(input.title)}-${randomId(4)}`;
    await exec(ctx.db, `INSERT INTO games (id, profile_id, slug, ${cols}, consent, created_at, updated_at) VALUES (?, ?, ?, ${values.map(() => "?").join(", ")}, 1, ?, ?)`, id, p.id, slug, ...values, now, now);
    await logEvent(ctx.db, ctx.now(), "submitted", "game", id, input.title, "new game", s.email);
    return { ok: true, id, status: "pending", changed: true, dropped: [] };
  }
  const g = await one<GameRow>(ctx.db, "SELECT rowid, * FROM games WHERE id = ? AND profile_id = ? AND removed = 0", gameId, p.id);
  if (!g) return { ok: false, error: "not_found" };
  const before = gameRecord(g, s.email);
  const unchanged = before.title === input.title && before.system === input.system && before.summary === input.summary && before.description === input.description && before.format === input.format &&
    before.locationType === input.locationType && before.platform === input.platform && before.city === input.city && before.venueName === input.venueName && before.venueMapsRaw === input.venueMapsRaw &&
    before.startsAt === input.startsAt && before.zone === input.zone && before.scheduleNote === input.scheduleNote && before.expiresAt === input.expiresAt && before.priceIdr === input.priceIdr &&
    before.seats === input.seats && before.language === input.language && before.level === input.level && before.minAge === input.minAge && before.contentWarnings === input.contentWarnings &&
    before.safetyTools === input.safetyTools && same(before.genres, input.genres) && same(before.styles, input.styles) && same(before.mechanics, input.mechanics) && before.coverId === input.coverKey;
  if (unchanged) return { ok: true, id: g.id, status: g.status, changed: false, dropped: [] };
  await exec(ctx.db, `UPDATE games SET ${cols.split(", ").map((c) => `${c} = ?`).join(", ")}, consent = 1, status = 'pending', reject_reason = '', updated_at = ? WHERE id = ?`, ...values, now, g.id);
  await logEvent(ctx.db, ctx.now(), "edited", "game", g.id, input.title, `${g.status} → pending: the GM changed it`, s.email);
  if (g.status === "approved") await markDirty(ctx);
  return { ok: true, id: g.id, status: "pending", changed: true, dropped: g.cover_key && g.cover_key !== input.coverKey ? [g.cover_key] : [] };
}

/** The GM marks one of their games full (or open again). No review: it changes only a badge and the list order. */
export async function setFull(ctx: Ctx, s: Session, gameId: string, full: boolean): Promise<boolean> {
  const p = await profileOf(ctx, s.accountId);
  if (!p) return false;
  const g = await one<GameRow>(ctx.db, "SELECT * FROM games WHERE id = ? AND profile_id = ? AND removed = 0", gameId, p.id);
  if (!g) return false;
  if ((g.full === 1) !== full) {
    await exec(ctx.db, "UPDATE games SET full = ?, updated_at = ? WHERE id = ?", full ? 1 : 0, iso(ctx.now()), g.id);
    await logEvent(ctx.db, ctx.now(), "changed", "game", g.id, g.title, `full → ${full ? "yes" : "no"}`, s.email);
    if (g.status === "approved") await markDirty(ctx);
  }
  return true;
}

/** The GM takes one of their games off. A game that was live keeps its address as a "no longer listed" page. */
export async function removeGame(ctx: Ctx, s: Session, gameId: string): Promise<boolean> {
  const p = await profileOf(ctx, s.accountId);
  if (!p) return false;
  const g = await one<GameRow>(ctx.db, "SELECT * FROM games WHERE id = ? AND profile_id = ? AND removed = 0", gameId, p.id);
  if (!g) return false;
  await exec(ctx.db, "UPDATE games SET removed = 1, gone_at = ?, updated_at = ? WHERE id = ?", iso(ctx.now()), iso(ctx.now()), g.id);
  await logEvent(ctx.db, ctx.now(), "removed", "game", g.id, g.title, "removed by the GM", s.email);
  if (g.status === "approved") await markDirty(ctx);
  return true;
}

/**
 * Erases the account: the profile, every game, the sessions and the email, and the other sign-in addresses an admin merged into it
 * (they are the same person). Returns the picture keys so the caller can delete the files. The Activity log keeps that something
 * happened, not who or what: names, titles, notes and addresses about the erased subjects are blanked.
 */
export async function eraseAccount(ctx: Ctx, s: Session): Promise<string[]> {
  const p = await profileOf(ctx, s.accountId);
  const games = p ? await many<{ id: string; cover_key: string; status: string }>(ctx.db, "SELECT id, cover_key, status FROM games WHERE profile_id = ?", p.id) : [];
  const keys = [p?.photo_key ?? "", ...games.map((g) => g.cover_key)].filter(Boolean);
  const wasPublic = p?.status === "approved";
  const merged = await many<{ id: string; email: string }>(ctx.db, "SELECT id, email FROM accounts WHERE merged_into = ?", s.accountId);
  const emails = [s.email, ...merged.map((m) => m.email)];
  if (p) {
    await exec(ctx.db, "DELETE FROM games WHERE profile_id = ?", p.id);
    await exec(ctx.db, "DELETE FROM merge_requests WHERE from_profile_id = ? OR into_profile_id = ?", p.id, p.id);
    await exec(ctx.db, "DELETE FROM profiles WHERE id = ?", p.id);
  }
  // The merged-in accounts point at this one, so they go first (a foreign key would stop the delete otherwise).
  for (const m of merged) {
    await exec(ctx.db, "DELETE FROM sessions WHERE account_id = ?", m.id);
    await exec(ctx.db, "DELETE FROM accounts WHERE id = ?", m.id);
  }
  await exec(ctx.db, "DELETE FROM sessions WHERE account_id = ?", s.accountId);
  for (const email of emails) await exec(ctx.db, "DELETE FROM login_tokens WHERE email = ?", email);
  await exec(ctx.db, "DELETE FROM accounts WHERE id = ?", s.accountId);
  for (const id of [s.accountId, p?.id, ...games.map((g) => g.id), ...merged.map((m) => m.id)]) {
    if (id) await exec(ctx.db, "UPDATE activity SET title = '', detail = '' WHERE subject_id = ?", id);
  }
  for (const email of emails) {
    await exec(ctx.db, "UPDATE activity SET title = '', detail = '', actor = 'erased' WHERE actor = ?", email); // what the person did themselves
    await exec(ctx.db, "UPDATE activity SET detail = '' WHERE detail = ?", email);
  }
  await logEvent(ctx.db, ctx.now(), "erased", "account", s.accountId, "", "account and data erased at the person's request", "the account holder");
  if (wasPublic) await markDirty(ctx);
  return keys;
}
