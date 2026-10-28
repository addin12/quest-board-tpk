// The public data: what the site build reads. Same shape the Apps Script produced (RawPublicData), so scripts/build-data.mjs and
// the site's parser stay as they are; `photoId` and `coverId` now hold R2 keys. Public fields only: no emails, notes or statuses.
import { many } from "./db.ts";
import type { Ctx } from "./auth.ts";
import type { GameRow, ProfileRow } from "./store.ts";
import { DAY_MS, iso, parseList } from "./util.ts";
import { isGoogleMapsUrl } from "../../src/lib/public-data.ts";
import type { RawPublicData } from "../../src/lib/types.ts";

/** How long the address of a listing that is no longer live keeps its "no longer listed" page. */
export const TOMBSTONE_DAYS = 180;

export async function buildPublic(ctx: Ctx): Promise<RawPublicData> {
  const now = ctx.now();
  const profiles = await many<ProfileRow>(ctx.db, "SELECT * FROM profiles");
  const games = await many<GameRow>(ctx.db, "SELECT * FROM games WHERE removed = 0 OR was_live = 1");

  const current = profiles.filter((p) => p.status === "approved" && p.name && p.whatsapp && p.consent === 1);
  const currentIds = new Set(current.map((p) => p.id));
  const live = games.filter((g) => g.removed === 0 && g.status === "approved" && g.consent === 1 && g.title && g.starts_at && Date.parse(g.expires_at) > now && currentIds.has(g.profile_id));
  const liveIds = new Set(live.map((g) => g.id));
  const cutoff = now - TOMBSTONE_DAYS * DAY_MS;
  const gone = <T extends { id: string; slug: string; was_live: number; gone_at: string }>(rows: T[], liveSet: Set<string>, anchor: (r: T) => string) =>
    rows.filter((r) => r.was_live === 1 && !liveSet.has(r.id) && Date.parse(r.gone_at || anchor(r)) > cutoff).map((r) => r.slug).sort();

  return {
    generatedAt: iso(now),
    gms: current.map((p) => ({ id: p.id, slug: p.slug, name: p.name, bio: p.bio, city: p.city, systems: parseList(p.systems), photoId: p.photo_key, whatsapp: p.whatsapp, discord: p.discord })),
    games: live.map((g) => ({
      id: g.id, slug: g.slug, gmId: g.profile_id, title: g.title, system: g.system, summary: g.summary, description: g.description, format: g.format, locationType: g.location_type,
      platform: g.platform, city: g.city, venueName: g.venue_name, venueMapsUrl: isGoogleMapsUrl(g.venue_maps_raw) ? g.venue_maps_raw : "", startsAt: g.starts_at, zone: g.zone,
      scheduleNote: g.schedule_note, expiresAt: g.expires_at, priceIdr: g.price_idr, seats: g.seats, language: g.language, level: g.level, minAge: g.min_age,
      contentWarnings: g.content_warnings, safetyTools: g.safety_tools, genres: parseList(g.genres), styles: parseList(g.styles), coverId: g.cover_key, featured: g.featured === 1, full: g.full === 1,
      listedAt: g.reviewed_at || g.created_at,
    })),
    goneGames: gone(games, liveIds, (g) => g.expires_at),
    goneGms: gone(profiles, currentIds, (p) => p.updated_at),
  };
}

/** True if `key` is the picture of an approved profile or game: only those are served to the public. */
export async function isPublicImage(ctx: Ctx, key: string): Promise<boolean> {
  const rows = await many<{ n: number }>(
    ctx.db,
    "SELECT (SELECT COUNT(*) FROM profiles WHERE photo_key = ?1 AND status = 'approved') + (SELECT COUNT(*) FROM games WHERE cover_key = ?1 AND status = 'approved' AND removed = 0) AS n",
    key,
  );
  return (rows[0]?.n ?? 0) > 0;
}
