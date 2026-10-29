// A daily copy of everything to the bucket (a second place from the database, same account), kept for two weeks: one JSON file of
// every table (to restore from) and two CSV files (games, profiles) the owner can open in a spreadsheet. Restoring is loading the
// JSON back into the tables.
import { many, type Bucket } from "./db.ts";
import type { Ctx } from "./auth.ts";
import { DAY_MS, iso } from "./util.ts";

export const KEEP_DAYS = 14;
const TABLES = ["accounts", "profiles", "games", "admins", "activity"] as const;

/**
 * One CSV: every field quoted, and a cell that starts with = + - or @ gets a leading apostrophe, so a spreadsheet never runs
 * something a GM typed as a formula.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]!);
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  return [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}

const bytes = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer;

export async function backup(ctx: Ctx, bucket: Bucket): Promise<string> {
  const day = iso(ctx.now()).slice(0, 10);
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) tables[t] = await many(ctx.db, `SELECT * FROM ${t}`);
  const key = `backups/${day}.json`;
  await bucket.put(key, bytes(JSON.stringify({ at: iso(ctx.now()), tables })), { httpMetadata: { contentType: "application/json" } });
  const people = await many<Record<string, unknown>>(ctx.db, "SELECT p.*, a.email FROM profiles p JOIN accounts a ON a.id = p.account_id");
  const games = await many<Record<string, unknown>>(ctx.db, "SELECT g.*, p.name AS gm_name, a.email FROM games g JOIN profiles p ON p.id = g.profile_id JOIN accounts a ON a.id = p.account_id");
  await bucket.put(`backups/${day}-profiles.csv`, bytes(toCsv(people)), { httpMetadata: { contentType: "text/csv" } });
  await bucket.put(`backups/${day}-games.csv`, bytes(toCsv(games)), { httpMetadata: { contentType: "text/csv" } });
  const cutoff = iso(ctx.now() - KEEP_DAYS * DAY_MS).slice(0, 10);
  for (const o of (await bucket.list({ prefix: "backups/" })).objects) {
    if (o.key.slice("backups/".length, "backups/".length + 10) < cutoff) await bucket.delete(o.key);
  }
  return key;
}
