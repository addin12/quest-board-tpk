// What a signed-in GM can do: keep one profile, list games, mark one full, remove one, erase everything.
// Every write is tied to the session's account, never to an id the client sends alone.
import { exec, many, one, type Stmt } from "./db.ts";
import type { Ctx, Session } from "./auth.ts";
import type { GameInput, ProfileInput } from "./rules.ts";
import type { GameRecord, GmRecord } from "../../src/lib/types.ts";
import { isGoogleMapsUrl } from "../../src/lib/public-data.ts";
import { scamSignals } from "../../src/lib/scam-signals.ts";
import { EXTEND_DAYS } from "../../src/lib/on-demand.ts";
import { DAY_MS, eventStmt, iso, logEvent, metaGet, metaSet, parseList, randomId, slugify } from "./util.ts";

export type ProfileRow = {
  id: string; account_id: string; slug: string; name: string; bio: string; city: string; systems: string; whatsapp: string; discord: string; instagram: string; photo_key: string; consent: number;
  status: "pending" | "approved" | "rejected"; admin_note: string; reviewed_by: string; reviewed_at: string; reject_reason: string; was_live: number; gone_at: string; created_at: string; updated_at: string; rowid?: number;
};
export type GameRow = {
  id: string; profile_id: string; slug: string; title: string; system: string; summary: string; description: string; format: GameRecord["format"]; location_type: GameRecord["locationType"];
  platform: string; city: string; venue_name: string; venue_maps_raw: string; starts_at: string; zone: GameRecord["zone"]; schedule_note: string; expires_at: string; price_idr: number; seats: number;
  language: GameRecord["language"]; level: GameRecord["level"]; min_age: number; content_warnings: string; safety_tools: string; genres: string; styles: string; mechanics: string; cover_key: string; consent: number;
  session_hours: number; characters: GameRecord["characters"]; needs: string; safety_keys: string; no_warnings: number; repeat_days: number; nudged_at: string; cities: string; on_demand: number;
  status: "pending" | "approved" | "rejected"; full: number; admin_note: string; reviewed_by: string; reviewed_at: string; reject_reason: string; was_live: number; gone_at: string;
  removed: number; created_at: string; updated_at: string; rowid?: number;
};

/**
 * Marks that the site is behind. The mark is always later than the previous mark and than the last build sent, even for two changes in one
 * millisecond, so the build sent for one change is never taken for the one after it (worker/src/deploy.ts compares the two).
 */
export async function markDirty(ctx: Ctx, urgent = false): Promise<void> {
  const dirty = await metaGet(ctx.db, "dirty");
  const last = await metaGet(ctx.db, "lastDeploy");
  const after = Math.max(dirty ? Date.parse(dirty) : 0, last ? Date.parse(last) : 0) + 1;
  const at = iso(Math.max(ctx.now(), after));
  await metaSet(ctx.db, "dirty", at);
  // A listing that has just gone live has no page until the next build: ask for a quick one (worker/src/deploy.ts decides how quick).
  if (urgent) await metaSet(ctx.db, "dirty_urgent", at);
}

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
    sessionHours: g.session_hours, characters: g.characters, needs: parseList(g.needs), safetyKeys: parseList(g.safety_keys), noWarnings: g.no_warnings === 1,
    cities: parseList(g.cities).length ? parseList(g.cities) : g.city ? [g.city] : [], onDemand: g.on_demand === 1,
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
 * Publish first (ADR-48): what a Game Master saves is live at once. Only wording that often means a scam (src/lib/scam-signals.ts) holds a
 * listing back for an admin's look; nothing else is checked before it shows. A record an admin hid stays hidden until an admin looks again:
 * the Game Master's edit puts it in the held list, it does not bring it back by itself.
 */
export type SaveStatus = GameRow["status"];

/** True when this text needs a person's look before it shows. */
const needsLook = (...texts: string[]): boolean => scamSignals(texts.join("\n")).length > 0;

/** The status a saved record gets. `current` is null for a new record; `touchedByAdmin` is whether an admin ever decided on it. */
function statusAfterSave(current: SaveStatus | null, held: boolean, touchedByAdmin: boolean): SaveStatus {
  if (current === "rejected") return "pending"; // hidden by an admin: only an admin brings it back
  if (held) return "pending";
  if (current === "pending" && touchedByAdmin) return "pending"; // an admin put it back to waiting on purpose
  return "approved";
}

/** The SQL that moves a row to `status`: becoming live starts its public life, leaving it starts the "no longer listed" clock. */
const MOVE = "status = ?, was_live = CASE WHEN ? = 'approved' THEN 1 ELSE was_live END, gone_at = CASE WHEN ? = 'approved' THEN '' WHEN was_live = 1 AND status = 'approved' THEN ? ELSE gone_at END";

/** Creates the profile or changes it; sending the same content again changes nothing. The profile is live as soon as it is saved. */
export async function saveProfile(ctx: Ctx, s: Session, input: ProfileInput): Promise<{ id: string; status: ProfileRow["status"]; changed: boolean; dropped: string[] }> {
  const now = iso(ctx.now());
  const p = await profileOf(ctx, s.accountId);
  const held = needsLook(input.name, input.bio);
  if (!p) {
    const id = randomId(9);
    const slug = `${slugify(input.name)}-${randomId(4)}`;
    const status = statusAfterSave(null, held, false);
    await exec(ctx.db, "INSERT INTO profiles (id, account_id, slug, name, bio, city, systems, whatsapp, discord, instagram, photo_key, consent, status, was_live, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
      id, s.accountId, slug, input.name, input.bio, input.city, JSON.stringify(input.systems), input.whatsapp, input.discord, input.instagram, input.photoKey, status, status === "approved" ? 1 : 0, now, now);
    await logEvent(ctx.db, ctx.now(), "submitted", "gm", id, input.name, status === "approved" ? "new profile, live" : "new profile, held for a look", s.email);
    if (status === "approved") await markDirty(ctx, true);
    return { id, status, changed: true, dropped: [] };
  }
  const unchanged = p.name === input.name && p.bio === input.bio && p.city === input.city && same(parseList(p.systems), input.systems) && p.whatsapp === input.whatsapp && p.discord === input.discord && p.instagram === input.instagram && p.photo_key === input.photoKey;
  if (unchanged) return { id: p.id, status: p.status, changed: false, dropped: [] };
  const status = statusAfterSave(p.status, held, p.reviewed_by !== "");
  await exec(ctx.db, `UPDATE profiles SET name = ?, bio = ?, city = ?, systems = ?, whatsapp = ?, discord = ?, instagram = ?, photo_key = ?, consent = 1, ${MOVE}, reject_reason = '', updated_at = ? WHERE id = ?`,
    input.name, input.bio, input.city, JSON.stringify(input.systems), input.whatsapp, input.discord, input.instagram, input.photoKey, status, status, status, now, now, p.id);
  await logEvent(ctx.db, ctx.now(), "edited", "gm", p.id, input.name, `${p.status} → ${status}: the GM changed it`, s.email);
  if (p.status === "approved" || status === "approved") await markDirty(ctx, p.status !== "approved");
  return { id: p.id, status, changed: true, dropped: p.photo_key && p.photo_key !== input.photoKey ? [p.photo_key] : [] };
}

/** Games a profile may have at once (removed ones do not count). A real GM runs a handful; the cap keeps the site's tables small. */
export const MAX_GAMES_PER_PROFILE = 30;
/** New games one profile may add in a day: with no review in front, this is what keeps one account from filling the board. */
export const MAX_NEW_GAMES_PER_DAY = 10;

export type SaveGameResult = { ok: true; id: string; status: GameRow["status"]; changed: boolean; dropped: string[] } | { ok: false; error: "no_profile" | "not_found" | "too_many" };

/** Creates a game for the signed-in GM (`gameId` null) or changes one of theirs. It is live as soon as it is saved (see the note above saveProfile). */
export async function saveGame(ctx: Ctx, s: Session, gameId: string | null, input: GameInput): Promise<SaveGameResult> {
  const p = await profileOf(ctx, s.accountId);
  if (!p) return { ok: false, error: "no_profile" };
  const now = iso(ctx.now());
  // the columns in the order of `cols`
  const valuesOf = (i: GameInput) => [i.title, i.system, i.summary, i.description, i.format, i.locationType, i.platform, i.city, i.venueName, i.venueMapsRaw, i.startsAt, i.zone,
    i.scheduleNote, i.expiresAt, i.priceIdr, i.seats, i.language, i.level, i.minAge, i.contentWarnings, i.safetyTools, JSON.stringify(i.genres), JSON.stringify(i.styles), JSON.stringify(i.mechanics), i.coverKey,
    i.sessionHours, i.characters, JSON.stringify(i.needs), JSON.stringify(i.safetyKeys), i.noWarnings ? 1 : 0, JSON.stringify(i.cities), i.onDemand ? 1 : 0];
  const cols = "title, system, summary, description, format, location_type, platform, city, venue_name, venue_maps_raw, starts_at, zone, schedule_note, expires_at, price_idr, seats, language, level, min_age, content_warnings, safety_tools, genres, styles, mechanics, cover_key, session_hours, characters, needs, safety_keys, no_warnings, cities, on_demand";
  const held = needsLook(input.title, input.summary, input.description, input.venueName, input.scheduleNote, input.platform);
  if (gameId === null) {
    const open = await one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM games WHERE profile_id = ? AND removed = 0", p.id);
    if ((open?.n ?? 0) >= MAX_GAMES_PER_PROFILE) return { ok: false, error: "too_many" };
    const today = await one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM games WHERE profile_id = ? AND created_at > ?", p.id, iso(ctx.now() - DAY_MS));
    if ((today?.n ?? 0) >= MAX_NEW_GAMES_PER_DAY) return { ok: false, error: "too_many" };
    const id = randomId(9);
    const slug = `${slugify(input.title)}-${randomId(4)}`;
    const status = statusAfterSave(null, held, false);
    await exec(ctx.db, `INSERT INTO games (id, profile_id, slug, ${cols}, consent, status, was_live, created_at, updated_at) VALUES (?, ?, ?, ${valuesOf(input).map(() => "?").join(", ")}, 1, ?, ?, ?, ?)`, id, p.id, slug, ...valuesOf(input), status, status === "approved" ? 1 : 0, now, now);
    await logEvent(ctx.db, ctx.now(), "submitted", "game", id, input.title, status === "approved" ? "new game, live" : "new game, held for a look", s.email);
    if (status === "approved") await markDirty(ctx, true);
    return { ok: true, id, status, changed: true, dropped: [] };
  }
  const g = await one<GameRow>(ctx.db, "SELECT rowid, * FROM games WHERE id = ? AND profile_id = ? AND removed = 0", gameId, p.id);
  if (!g) return { ok: false, error: "not_found" };
  // An on-request game keeps the dates it was listed with: saving it again must not move them (Extend does that, on purpose).
  if (input.onDemand && g.on_demand === 1) input = { ...input, startsAt: g.starts_at, expiresAt: g.expires_at };
  const before = gameRecord(g, s.email);
  const unchanged = before.title === input.title && before.system === input.system && before.summary === input.summary && before.description === input.description && before.format === input.format &&
    before.locationType === input.locationType && before.platform === input.platform && before.city === input.city && before.venueName === input.venueName && before.venueMapsRaw === input.venueMapsRaw &&
    before.startsAt === input.startsAt && before.zone === input.zone && before.scheduleNote === input.scheduleNote && before.expiresAt === input.expiresAt && before.priceIdr === input.priceIdr &&
    before.seats === input.seats && before.language === input.language && before.level === input.level && before.minAge === input.minAge && before.contentWarnings === input.contentWarnings &&
    before.safetyTools === input.safetyTools && same(before.genres, input.genres) && same(before.styles, input.styles) && same(before.mechanics, input.mechanics) && before.coverId === input.coverKey &&
    before.sessionHours === input.sessionHours && before.characters === input.characters && same(before.needs, input.needs) && same(before.safetyKeys, input.safetyKeys) && before.noWarnings === input.noWarnings && same(before.cities, input.cities) && before.onDemand === input.onDemand;
  if (unchanged) return { ok: true, id: g.id, status: g.status, changed: false, dropped: [] };
  const status = statusAfterSave(g.status, held, g.reviewed_by !== "");
  await exec(ctx.db, `UPDATE games SET ${cols.split(", ").map((c) => `${c} = ?`).join(", ")}, consent = 1, ${MOVE}, reject_reason = '', updated_at = ? WHERE id = ?`, ...valuesOf(input), status, status, status, now, now, g.id);
  await logEvent(ctx.db, ctx.now(), "edited", "game", g.id, input.title, `${g.status} → ${status}: the GM changed it`, s.email);
  if (g.status === "approved" || status === "approved") await markDirty(ctx, g.status !== "approved");
  return { ok: true, id: g.id, status, changed: true, dropped: g.cover_key && g.cover_key !== input.coverKey ? [g.cover_key] : [] };
}

/**
 * Keeps an on-request game listed 30 days longer (from today if its listing has already run out, which brings it back). A game with a date is done after it, so
 * there is nothing to extend. The note that its Game Master was warned is cleared, so the next run-out is warned about too.
 */
export async function extendGame(ctx: Ctx, s: Session, gameId: string): Promise<{ ok: true; expiresAt: string } | { ok: false }> {
  const p = await profileOf(ctx, s.accountId);
  if (!p) return { ok: false };
  const g = await one<GameRow>(ctx.db, "SELECT * FROM games WHERE id = ? AND profile_id = ? AND removed = 0 AND on_demand = 1", gameId, p.id);
  if (!g) return { ok: false };
  const was = Date.parse(g.expires_at);
  const expiresAt = iso(Math.max(was, ctx.now()) + EXTEND_DAYS * DAY_MS);
  await exec(ctx.db, "UPDATE games SET expires_at = ?, nudged_at = '', updated_at = ? WHERE id = ?", expiresAt, iso(ctx.now()), g.id);
  await logEvent(ctx.db, ctx.now(), "changed", "game", g.id, g.title, `listed until ${expiresAt.slice(0, 10)} (the GM extended it)`, s.email);
  if (g.status === "approved") await markDirty(ctx, was <= ctx.now()); // back on the site after running out: its page may not exist, so ask for the quick build
  return { ok: true, expiresAt };
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
  const subjects = [s.accountId, p?.id, ...games.map((g) => g.id), ...merged.map((m) => m.id)].filter((id): id is string => Boolean(id));
  const marks = (n: number) => Array.from({ length: n }, () => "?").join(", ");
  // Everything goes in one batch (all or none, and a handful of queries however many games the person had; Cloudflare's free plan allows 50
  // a request): a failure half-way must not leave a half-erased account, or personal data in the log with no way to retry.
  const writes: Stmt[] = [];
  const add = (sql: string, ...values: unknown[]) => writes.push(ctx.db.prepare(sql).bind(...values));
  if (p) {
    add("DELETE FROM merge_requests WHERE from_profile_id = ? OR into_profile_id = ?", p.id, p.id);
    add("DELETE FROM games WHERE profile_id = ?", p.id);
    add("DELETE FROM profiles WHERE id = ?", p.id);
  }
  // The merged-in accounts point at this one, so they go first (a foreign key would stop the delete otherwise).
  if (merged.length) {
    add(`DELETE FROM sessions WHERE account_id IN (${marks(merged.length)})`, ...merged.map((m) => m.id));
    add(`DELETE FROM accounts WHERE id IN (${marks(merged.length)})`, ...merged.map((m) => m.id));
  }
  add("DELETE FROM sessions WHERE account_id = ?", s.accountId);
  add(`DELETE FROM login_tokens WHERE email IN (${marks(emails.length)})`, ...emails);
  add("DELETE FROM accounts WHERE id = ?", s.accountId);
  for (let i = 0; i < subjects.length; i += 80) { // D1 allows 100 values in a statement
    const part = subjects.slice(i, i + 80);
    add(`DELETE FROM reports WHERE subject_id IN (${marks(part.length)})`, ...part);
    add(`UPDATE activity SET title = '', detail = '' WHERE subject_id IN (${marks(part.length)})`, ...part);
  }
  add(`UPDATE activity SET title = '', detail = '', actor = 'erased' WHERE actor IN (${marks(emails.length)})`, ...emails); // what the person did themselves
  add(`UPDATE activity SET detail = '' WHERE detail IN (${marks(emails.length)})`, ...emails);
  writes.push(eventStmt(ctx.db, ctx.now(), "erased", "account", s.accountId, "", "account and data erased at the person's request", "the account holder"));
  await ctx.db.batch(writes);
  if (wasPublic) await markDirty(ctx);
  return keys;
}
