// The admin side: the review queue, decisions, featuring, admins and merging duplicate accounts.
// Speaks the same action names and answers as the old Apps Script API, so the admin page keeps its logic.
import { exec, many, one } from "./db.ts";
import { isAdmin, listAdmins, type Ctx } from "./auth.ts";
import { decisionMail, normalizeEmail } from "./email.ts";
import { gameRecord, gmRecord, markDirty, type GameRow, type ProfileRow } from "./store.ts";
import { DAY_MS, clip, iso, logEvent, metaGet } from "./util.ts";
import type { AdminEntry, DeployInfo } from "../../src/lib/types.ts";

export type AdminFail = { ok: false; error: string; message?: string };
const fail = (error: string, message?: string): AdminFail => ({ ok: false, error, ...(message ? { message } : {}) });

export async function deployInfo(ctx: Ctx, configured: boolean): Promise<DeployInfo> {
  const last = await metaGet(ctx.db, "lastDeploy");
  return { lastAt: last ? Date.parse(last) : null, pending: Boolean(await metaGet(ctx.db, "dirty")), configured };
}

export async function queue(ctx: Ctx, deployConfigured: boolean) {
  const cutoff = iso(ctx.now() - 30 * DAY_MS);
  const gms = await many<ProfileRow & { email: string }>(ctx.db, "SELECT p.rowid, p.*, a.email FROM profiles p JOIN accounts a ON a.id = p.account_id ORDER BY p.created_at");
  const games = await many<GameRow & { email: string }>(
    ctx.db,
    "SELECT g.rowid, g.*, a.email FROM games g JOIN profiles p ON p.id = g.profile_id JOIN accounts a ON a.id = p.account_id WHERE g.removed = 0 AND g.expires_at > ? ORDER BY g.created_at",
    cutoff,
  );
  const byPhone = new Map<string, ProfileRow[]>();
  for (const p of gms) byPhone.set(p.whatsapp, [...(byPhone.get(p.whatsapp) ?? []), p]);
  const admins: AdminEntry[] = (await listAdmins(ctx)).map((a) => ({ email: a.email, addedBy: a.added_by, addedAt: a.added_at }));
  return {
    ok: true as const,
    now: iso(ctx.now()),
    games: games.map((g) => gameRecord(g, g.email)),
    gms: gms.map((p) => gmRecord(p, p.email, (byPhone.get(p.whatsapp) ?? []).filter((o) => o.id !== p.id).map((o) => ({ id: o.id, name: o.name })))),
    admins,
    owner: ctx.owner,
    deploy: await deployInfo(ctx, deployConfigured),
  };
}

type Kind = "game" | "gm";
const kindOf = (v: unknown): Kind | "" => (v === "game" || v === "gm" ? v : "");

async function load(ctx: Ctx, kind: Kind, id: string): Promise<{ row: (GameRow | ProfileRow) & { email: string }; title: string; slug: string } | null> {
  const row = kind === "game"
    ? await one<GameRow & { email: string }>(ctx.db, "SELECT g.*, a.email FROM games g JOIN profiles p ON p.id = g.profile_id JOIN accounts a ON a.id = p.account_id WHERE g.id = ? AND g.removed = 0", id)
    : await one<ProfileRow & { email: string }>(ctx.db, "SELECT p.*, a.email FROM profiles p JOIN accounts a ON a.id = p.account_id WHERE p.id = ?", id);
  return row ? { row, title: kind === "game" ? (row as GameRow).title : (row as ProfileRow).name, slug: row.slug } : null;
}

export async function review(ctx: Ctx, admin: string, req: Record<string, unknown>) {
  const kind = kindOf(req.kind);
  const status = req.status;
  const ids = Array.isArray(req.ids) ? req.ids.filter((x): x is string => typeof x === "string") : [];
  if (!kind || (status !== "pending" && status !== "approved" && status !== "rejected") || ids.length === 0 || ids.length > 50) return fail("bad_request");
  const table = kind === "game" ? "games" : "profiles";
  const reason = status === "rejected" ? clip(req.reason, 500) : "";
  const done: string[] = [];
  let dirty = false;
  for (const id of ids) {
    const rec = await load(ctx, kind, id);
    if (!rec) continue;
    const before = rec.row.status;
    const wasApproved = before === "approved";
    // Leaving the approved state starts the "no longer listed" clock; a decision always stamps who and when.
    await exec(ctx.db, `UPDATE ${table} SET status = ?, reviewed_by = ?, reviewed_at = ?, reject_reason = ?, was_live = CASE WHEN ? = 'approved' THEN 1 ELSE was_live END, gone_at = CASE WHEN ? = 'approved' THEN '' WHEN ? = 1 THEN ? ELSE gone_at END WHERE id = ?`,
      status, admin, iso(ctx.now()), reason, status, status, wasApproved ? 1 : 0, iso(ctx.now()), id);
    await logEvent(ctx.db, ctx.now(), "decision", kind, id, rec.title, `${before} → ${status}${reason ? `: ${reason}` : ""}`, admin);
    if (before !== status && (wasApproved || status === "approved")) dirty = true;
    if (req.notify === true && before !== status && (status === "approved" || status === "rejected")) {
      try {
        await ctx.mailer.send(decisionMail(rec.row.email, status, kind, rec.title, rec.slug, reason, ctx.siteUrl));
      } catch {
        await logEvent(ctx.db, ctx.now(), "mail failed", kind, id, rec.title, "the decision email could not be sent", admin);
      }
    }
    done.push(id);
  }
  if (dirty) await markDirty(ctx);
  return { ok: true as const, updated: done, publishing: dirty };
}

export async function patch(ctx: Ctx, admin: string, req: Record<string, unknown>) {
  const kind = kindOf(req.kind);
  const rec = kind && typeof req.id === "string" ? await load(ctx, kind, req.id) : null;
  if (!kind || !rec) return fail("not_found");
  const sets: string[] = [];
  const values: unknown[] = [];
  const said: string[] = [];
  let dirty = false;
  if (kind === "game" && typeof req.full === "boolean") {
    sets.push("full = ?"); values.push(req.full ? 1 : 0); said.push(`full → ${req.full ? "yes" : "no"}`);
    dirty = dirty || (rec.row.status === "approved" && ((rec.row as GameRow).full === 1) !== req.full);
  }
  if (typeof req.adminNote === "string") { sets.push("admin_note = ?"); values.push(clip(req.adminNote, 1000, true)); said.push("note changed"); }
  if (!sets.length) return fail("bad_request");
  await exec(ctx.db, `UPDATE ${kind === "game" ? "games" : "profiles"} SET ${sets.join(", ")} WHERE id = ?`, ...values, req.id);
  await logEvent(ctx.db, ctx.now(), "changed", kind, req.id as string, rec.title, said.join(", "), admin);
  if (dirty) await markDirty(ctx);
  return { ok: true as const, publishing: dirty };
}

export async function addAdmin(ctx: Ctx, by: string, rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  if (!email) return fail("bad_request");
  if (email !== ctx.owner && !(await one(ctx.db, "SELECT 1 AS x FROM admins WHERE email = ?", email))) {
    await exec(ctx.db, "INSERT INTO admins (email, added_by, added_at) VALUES (?, ?, ?)", email, by, iso(ctx.now()));
    await logEvent(ctx.db, ctx.now(), "admin added", "", "", "", email, by);
  }
  return { ok: true as const, admins: (await listAdmins(ctx)).map((a) => ({ email: a.email, addedBy: a.added_by, addedAt: a.added_at })) };
}

export async function removeAdmin(ctx: Ctx, by: string, rawEmail: unknown) {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (email === ctx.owner) return fail("forbidden", "owner");
  if (email === by) return fail("forbidden", "self");
  await exec(ctx.db, "DELETE FROM admins WHERE email = ?", email);
  await logEvent(ctx.db, ctx.now(), "admin removed", "", "", "", email, by);
  return { ok: true as const, admins: (await listAdmins(ctx)).map((a) => ({ email: a.email, addedBy: a.added_by, addedAt: a.added_at })) };
}

/**
 * Moves everything of a duplicate account into the real one. `fromProfileId` is the duplicate's profile (the one the admin page flags);
 * its games go to the other account's profile and the duplicate account's sign-ins are redirected, so its email keeps working.
 */
export async function mergeProfiles(ctx: Ctx, admin: string, fromProfileId: unknown, intoProfileId: unknown) {
  if (typeof fromProfileId !== "string" || typeof intoProfileId !== "string" || fromProfileId === intoProfileId) return fail("bad_request");
  const from = await one<ProfileRow>(ctx.db, "SELECT * FROM profiles WHERE id = ?", fromProfileId);
  const into = await one<ProfileRow>(ctx.db, "SELECT * FROM profiles WHERE id = ?", intoProfileId);
  if (!from || !into) return fail("not_found");
  await exec(ctx.db, "UPDATE games SET profile_id = ?, updated_at = ? WHERE profile_id = ?", into.id, iso(ctx.now()), from.id);
  await exec(ctx.db, "DELETE FROM profiles WHERE id = ?", from.id);
  await exec(ctx.db, "UPDATE accounts SET merged_into = ? WHERE id = ?", into.account_id, from.account_id);
  await exec(ctx.db, "UPDATE sessions SET account_id = ? WHERE account_id = ?", into.account_id, from.account_id);
  await logEvent(ctx.db, ctx.now(), "merged", "gm", into.id, into.name, `profile ${from.name} (${from.id}) merged into this one`, admin);
  await markDirty(ctx);
  return { ok: true as const };
}

/** One admin API call, after the caller has been signed in. */
export async function handleAdmin(ctx: Ctx, email: string, req: Record<string, unknown>, deployConfigured: boolean, deployNow: () => Promise<boolean>) {
  if (!(await isAdmin(ctx, email))) return fail("forbidden", email);
  switch (req.action) {
    case "whoami": return { ok: true as const, email, owner: email === ctx.owner };
    case "queue": return queue(ctx, deployConfigured);
    case "review": return review(ctx, email, req);
    case "patch": return patch(ctx, email, req);
    case "admin.add": return addAdmin(ctx, email, req.email);
    case "admin.remove": return removeAdmin(ctx, email, req.email);
    case "merge": return mergeProfiles(ctx, email, req.fromId, req.intoId);
    case "deploy": return (await deployNow()) ? { ok: true as const } : fail("deploy_failed");
    default: return fail("bad_request");
  }
}
