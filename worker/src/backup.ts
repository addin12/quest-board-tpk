// A daily copy of everything to the bucket (a second place from the database, same account), kept for two weeks: one JSON file of
// every table (to restore from) and two CSV files (games, profiles) the owner can open in a spreadsheet. Restoring is loading the
// JSON back into the tables: `restoreSql` writes the SQL for that, `scripts/restore-backup.mjs` runs it on a downloaded file.
import { many, type Bucket } from "./db.ts";
import type { Ctx } from "./auth.ts";
import { DAY_MS, iso } from "./util.ts";

export const KEEP_DAYS = 14;
/** What a backup holds, in the order a restore loads it (a row's references come before it). */
export const TABLES = ["accounts", "profiles", "games", "admins", "activity", "merge_requests", "reports"] as const;
/** Tables a backup leaves out on purpose, and why: a restore loses nothing anyone needs (a unit test checks every table is in one list or the other). */
export const NOT_BACKED_UP: Record<string, string> = {
  login_tokens: "sign-in links live 15 minutes; people ask for a new one",
  sessions: "people sign in again",
  rate_events: "limits start afresh",
  meta: "the backend's own state (builds, backup and mail status), rebuilt as it runs",
};

/** A column name as SQL, refused unless it is a plain name (a backup file is data from outside the code). */
function column(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`not a column name: ${name}`);
  return name;
}

/** A value as an SQL literal: text quoted with its quotes doubled, numbers as they are, true and false as 1 and 0. */
function literal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * SQL that loads a backup (`backups/<day>.json`) into an empty database with the migrations applied: one INSERT per row, table by table in
 * `TABLES` order, naming the columns the backup has (a column added since then takes its default). Foreign keys are checked at the end, since D1 runs
 * a file as one transaction and an account can point at one stored after it (`merged_into`). Used by `scripts/restore-backup.mjs` (docs/runbook.md).
 */
export function restoreSql(backup: { tables?: Record<string, Record<string, unknown>[] | undefined> }): string {
  const lines = ["PRAGMA defer_foreign_keys = true;"];
  for (const table of TABLES) {
    for (const row of backup.tables?.[table] ?? []) {
      const names = Object.keys(row);
      lines.push(`INSERT INTO ${table} (${names.map(column).join(", ")}) VALUES (${names.map((n) => literal(row[n])).join(", ")});`);
    }
  }
  return `${lines.join("\n")}\n`;
}

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
