// What a visitor can ask of a live listing: its Game Master's phone number (only on a tap, one Game Master at a time, rate-limited, so a scraper
// cannot collect them from the public data) and a report. Several different people reporting one listing hold it back for an admin's look.
import { exec, many, one } from "./db.ts";
import type { Ctx } from "./auth.ts";
import { DAY_MS, allow, clip, iso, logEvent, randomId, sha256Hex } from "./util.ts";
import { markDirty } from "./store.ts";

/** Phone numbers handed out per visitor address an hour, and in all an hour: a person comparing games taps a few; a collector taps hundreds. */
export const REVEALS_PER_IP_HOUR = 30;
export const REVEALS_ALL_HOUR = 600;

/** The number of a live, consenting Game Master, or null. The caller has checked the rate limits (`allowReveal`). */
export async function contactOf(ctx: Ctx, gmId: unknown): Promise<string | null> {
  if (typeof gmId !== "string" || !/^[a-z0-9-]{4,40}$/.test(gmId)) return null;
  const p = await one<{ whatsapp: string }>(ctx.db, "SELECT whatsapp FROM profiles WHERE id = ? AND status = 'approved' AND consent = 1 AND whatsapp != ''", gmId);
  return p?.whatsapp ?? null;
}

export async function allowReveal(ctx: Ctx, ip: string): Promise<boolean> {
  return (await allow(ctx.db, `reveal:${ip}`, REVEALS_PER_IP_HOUR, 3_600_000, ctx.now())) && (await allow(ctx.db, "reveal:all", REVEALS_ALL_HOUR, 3_600_000, ctx.now()));
}

/** Different people who must report a listing before it is held back for a look. */
export const REPORTS_TO_HOLD = 3;
/** Reports older than this no longer count. */
export const REPORT_WINDOW_DAYS = 14;
/** Reports a visitor address may send an hour. */
export const REPORTS_PER_IP_HOUR = 6;

export type ReportResult = { ok: true; held: boolean } | { ok: false; error: "bad_request" | "not_found" | "rate_limited" };

/** Records a report of a live listing; the third distinct reporter in two weeks holds it (status "pending") until an admin decides. */
export async function report(ctx: Ctx, ip: string, input: { kind: unknown; id: unknown; reason: unknown }): Promise<ReportResult> {
  const kind = input.kind === "game" || input.kind === "gm" ? input.kind : null;
  if (!kind || typeof input.id !== "string" || !/^[a-z0-9-]{4,40}$/.test(input.id)) return { ok: false, error: "bad_request" };
  if (!(await allow(ctx.db, `report:${ip}`, REPORTS_PER_IP_HOUR, 3_600_000, ctx.now()))) return { ok: false, error: "rate_limited" };
  const table = kind === "game" ? "games" : "profiles";
  const row = await one<{ id: string; status: string; title: string }>(ctx.db, `SELECT id, status, ${kind === "game" ? "title" : "name AS title"} FROM ${table} WHERE id = ?${kind === "game" ? " AND removed = 0" : ""}`, input.id);
  if (!row || row.status !== "approved") return { ok: false, error: "not_found" };
  const reporter = (await sha256Hex(`reporter:${ip}`)).slice(0, 32);
  await exec(ctx.db, "INSERT OR IGNORE INTO reports (id, subject_kind, subject_id, reporter, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)", randomId(9), kind, row.id, reporter, clip(input.reason, 300), iso(ctx.now()));
  const since = iso(ctx.now() - REPORT_WINDOW_DAYS * DAY_MS);
  const n = (await one<{ n: number }>(ctx.db, "SELECT COUNT(DISTINCT reporter) AS n FROM reports WHERE subject_kind = ? AND subject_id = ? AND created_at > ?", kind, row.id, since))?.n ?? 0;
  if (n < REPORTS_TO_HOLD) return { ok: true, held: false };
  // Held, not hidden for good: it leaves the site until an admin looks, and the admin's decision clears the reports.
  const at = iso(ctx.now());
  await exec(ctx.db, `UPDATE ${table} SET status = 'pending', reject_reason = '', gone_at = ?, updated_at = ? WHERE id = ? AND status = 'approved'`, at, at, row.id);
  await logEvent(ctx.db, ctx.now(), "held", kind, row.id, row.title, `held for a look after ${n} reports`, "visitors");
  await markDirty(ctx);
  return { ok: true, held: true };
}

/** How many different people reported each listing that has reports (the admin page shows it). One query: the table only holds what has been reported. */
export async function reportCounts(ctx: Ctx): Promise<Map<string, number>> {
  const since = iso(ctx.now() - REPORT_WINDOW_DAYS * DAY_MS);
  const rows = await many<{ subject_id: string; n: number }>(ctx.db, "SELECT subject_id, COUNT(DISTINCT reporter) AS n FROM reports WHERE created_at > ? GROUP BY subject_id", since);
  return new Map(rows.map((r) => [r.subject_id, r.n]));
}
