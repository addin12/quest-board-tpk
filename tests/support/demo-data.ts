/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

/**
 * The demo data (data/sample.json) as live rows of the world's database, with the ids, slugs and dates the static pages were built from
 * (src/generated/data.json, dates already moved to the present) and the phone numbers from the sample (they are not in the built data), so a page that
 * asks /api/live and /api/contact gets the same Game Masters and games it was built with. Shared by the browser tests' server and the sandbox.
 */
export function loadDemo(w: { clock: { ms: number }; db: { raw: DatabaseSync } }) {
  const built = JSON.parse(readFileSync(path.join(process.cwd(), "src", "generated", "data.json"), "utf8"));
  const sample = JSON.parse(readFileSync(path.join(process.cwd(), "data", "sample.json"), "utf8"));
  const phones = new Map<string, string>(sample.gms.map((g: any) => [g.id, g.whatsapp]));
  const at = new Date(w.clock.ms).toISOString();
  const db = w.db.raw;
  for (const gm of built.gms) {
    db.prepare("INSERT INTO accounts (id, email, created_at) VALUES (?, ?, ?)").run(`acc-${gm.id}`, `${gm.id}@demo.example`, at);
    db.prepare("INSERT INTO profiles (id, account_id, slug, name, bio, city, systems, whatsapp, discord, instagram, photo_key, consent, status, was_live, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'approved', 1, ?, ?)")
      .run(gm.id, `acc-${gm.id}`, gm.slug, gm.name, gm.bio, gm.city, JSON.stringify(gm.systems), phones.get(gm.id) ?? "", gm.discord, gm.instagram, gm.photoKey ?? "", gm.joinedAt || at, at);
  }
  for (const g of built.games) {
    db.prepare("INSERT INTO games (id, profile_id, slug, title, system, summary, description, format, location_type, platform, city, venue_name, venue_maps_raw, starts_at, zone, schedule_note, expires_at, price_idr, seats, language, level, min_age, content_warnings, safety_tools, genres, styles, mechanics, cover_key, session_hours, characters, needs, safety_keys, no_warnings, consent, status, full, was_live, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'approved', ?, 1, ?, ?)")
      .run(g.id, g.gmId, g.slug, g.title, g.system, g.summary, g.description, g.format, g.locationType, g.platform, g.city, g.venueName, g.venueMapsUrl, g.startsAt, g.zone, g.scheduleNote, g.expiresAt, g.priceIdr, g.seats, g.language, g.level, g.minAge, g.contentWarnings, g.safetyTools, JSON.stringify(g.genres), JSON.stringify(g.styles), JSON.stringify(g.mechanics), g.coverKey ?? "", g.sessionHours, g.characters, JSON.stringify(g.needs), JSON.stringify(g.safetyKeys), g.noWarnings ? 1 : 0, g.full ? 1 : 0, at, at);
    db.prepare("UPDATE games SET cities = ?, on_demand = ? WHERE id = ?").run(JSON.stringify(g.cities ?? []), g.onDemand ? 1 : 0, g.id);
  }
}
