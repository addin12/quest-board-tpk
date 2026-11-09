// The admin side: the review queue, decisions, featuring, admins and merging duplicate accounts.
// Speaks the same action names and answers as the old Apps Script API, so the admin page keeps its logic.
import { exec, many, one, type Stmt } from "./db.ts";
import { isAdmin, listAdmins, type Ctx, type Session } from "./auth.ts";
import { decisionMail, mergeRequestMail, normalizeEmail } from "./email.ts";
import { MERGE_REQUEST_DAYS, gameRecord, gmRecord, markDirty, type GameRow, type ProfileRow } from "./store.ts";
import { reportCounts } from "./reports.ts";
import { DAY_MS, allow, clip, eventStmt, iso, logEvent, metaGet, randomId } from "./util.ts";
import { REVIEW_MAX_IDS, type AdminEntry, type DeployInfo } from "../../src/lib/types.ts";

export type AdminFail = { ok: false; error: string; message?: string };
const fail = (error: string, message?: string): AdminFail => ({ ok: false, error, ...(message ? { message } : {}) });

/**
 * What the admin page shows of the publishing. `pending` means a change has not been SENT to a build yet (the mark is newer than the last send);
 * once it is sent the page shows "updating" until the site has it, and the page compares the site's own build with `lastAt`. A build that never
 * lands is the backend's business (worker/src/deploy.ts sends it again and the owner is told), not the page's.
 */
export async function deployInfo(ctx: Ctx, configured: boolean): Promise<DeployInfo> {
  const last = await metaGet(ctx.db, "lastDeploy");
  const dirty = await metaGet(ctx.db, "dirty");
  return { lastAt: last ? Date.parse(last) : null, pending: Boolean(dirty) && (!last || Date.parse(dirty as string) > Date.parse(last)), configured };
}

export async function queue(ctx: Ctx, deployConfigured: boolean) {
  const cutoff = iso(ctx.now() - 30 * DAY_MS);
  const gms = await many<ProfileRow & { email: string }>(ctx.db, "SELECT p.rowid, p.*, a.email FROM profiles p JOIN accounts a ON a.id = p.account_id ORDER BY p.created_at");
  const games = await many<GameRow & { email: string }>(
    ctx.db,
    "SELECT g.rowid, g.*, a.email FROM games g JOIN profiles p ON p.id = g.profile_id JOIN accounts a ON a.id = p.account_id WHERE g.removed = 0 AND g.expires_at > ? ORDER BY g.created_at",
    cutoff,
  );
  const reports = await reportCounts(ctx);
  const byPhone = new Map<string, ProfileRow[]>();
  for (const p of gms) byPhone.set(p.whatsapp, [...(byPhone.get(p.whatsapp) ?? []), p]);
  const admins: AdminEntry[] = (await listAdmins(ctx)).map((a) => ({ email: a.email, addedBy: a.added_by, addedAt: a.added_at }));
  return {
    ok: true as const,
    now: iso(ctx.now()),
    games: games.map((g) => ({ ...gameRecord(g, g.email), reports: reports.get(g.id) ?? 0 })),
    gms: gms.map((p) => ({ ...gmRecord(p, p.email, (byPhone.get(p.whatsapp) ?? []).filter((o) => o.id !== p.id).slice(0, MAX_SHARES).map((o) => ({ id: o.id, name: o.name }))), reports: reports.get(p.id) ?? 0 })),
    admins,
    owner: ctx.owner,
    deploy: await deployInfo(ctx, deployConfigured),
  };
}

/** Other profiles listed beside one that shares its WhatsApp number; more than a few is already a clear sign. */
const MAX_SHARES = 5;

type Kind = "game" | "gm";
const kindOf = (v: unknown): Kind | "" => (v === "game" || v === "gm" ? v : "");

async function load(ctx: Ctx, kind: Kind, id: string): Promise<{ row: (GameRow | ProfileRow) & { email: string }; title: string; slug: string } | null> {
  const row = kind === "game"
    ? await one<GameRow & { email: string }>(ctx.db, "SELECT g.*, a.email FROM games g JOIN profiles p ON p.id = g.profile_id JOIN accounts a ON a.id = p.account_id WHERE g.id = ? AND g.removed = 0", id)
    : await one<ProfileRow & { email: string }>(ctx.db, "SELECT p.*, a.email FROM profiles p JOIN accounts a ON a.id = p.account_id WHERE p.id = ?", id);
  return row ? { row, title: kind === "game" ? (row as GameRow).title : (row as ProfileRow).name, slug: row.slug } : null;
}

/** The records of one kind with these ids, and the address of whoever owns them: one query for all of them. */
async function loadMany(ctx: Ctx, kind: Kind, ids: string[]): Promise<Map<string, { row: (GameRow | ProfileRow) & { email: string }; title: string; slug: string }>> {
  const marks = ids.map(() => "?").join(", ");
  const rows = kind === "game"
    ? await many<GameRow & { email: string; gm_status: string }>(ctx.db, `SELECT g.*, a.email, p.status AS gm_status FROM games g JOIN profiles p ON p.id = g.profile_id JOIN accounts a ON a.id = p.account_id WHERE g.id IN (${marks}) AND g.removed = 0`, ...ids)
    : await many<ProfileRow & { email: string }>(ctx.db, `SELECT p.*, a.email FROM profiles p JOIN accounts a ON a.id = p.account_id WHERE p.id IN (${marks})`, ...ids);
  return new Map(rows.map((row) => [row.id, { row, title: kind === "game" ? (row as GameRow).title : (row as ProfileRow).name, slug: row.slug }]));
}

/**
 * Decides on up to REVIEW_MAX_IDS records. One read for all of them, one batch for every change and its log row (all or none), then the
 * emails: this stays far under the 50 database queries a request may make, however the admin page chunks a long selection.
 * `mailFailed` lists the records whose decision email could not be sent, so the admin is told instead of assuming.
 */
export async function review(ctx: Ctx, admin: string, req: Record<string, unknown>) {
  const kind = kindOf(req.kind);
  const status = req.status;
  const ids = Array.isArray(req.ids) ? [...new Set(req.ids.filter((x): x is string => typeof x === "string"))] : [];
  if (!kind || (status !== "pending" && status !== "approved" && status !== "rejected") || ids.length === 0 || ids.length > REVIEW_MAX_IDS) return fail("bad_request");
  const table = kind === "game" ? "games" : "profiles";
  const reason = status === "rejected" ? clip(req.reason, 500) : "";
  // The page sends the `updatedAt` of each record it showed; a decision on a record the GM changed since is refused, not applied blind.
  const seen = req.seen && typeof req.seen === "object" && !Array.isArray(req.seen) ? (req.seen as Record<string, unknown>) : null;
  const records = await loadMany(ctx, kind, ids);
  const writes: Stmt[] = [];
  const mails: { id: string; to: string; title: string; slug: string; waitingForGm: boolean }[] = [];
  const done: string[] = [];
  const stale: string[] = [];
  const hidden: string[] = []; // approved games whose Game Master profile is not approved: the site shows none of them yet
  let dirty = false;
  let urgent = false;
  const at = iso(ctx.now());
  for (const id of ids) {
    const rec = records.get(id);
    if (!rec) continue;
    if (seen && seen[id] !== (rec.row as { updated_at: string }).updated_at) { stale.push(id); continue; }
    const before = rec.row.status;
    const wasApproved = before === "approved";
    // Leaving the approved state starts the "no longer listed" clock; a decision always stamps who and when.
    writes.push(ctx.db.prepare(`UPDATE ${table} SET status = ?, reviewed_by = ?, reviewed_at = ?, reject_reason = ?, was_live = CASE WHEN ? = 'approved' THEN 1 ELSE was_live END, gone_at = CASE WHEN ? = 'approved' THEN '' WHEN ? = 1 THEN ? ELSE gone_at END WHERE id = ?`)
      .bind(status, admin, at, reason, status, status, wasApproved ? 1 : 0, at, id));
    writes.push(ctx.db.prepare("DELETE FROM reports WHERE subject_kind = ? AND subject_id = ?").bind(kind, id)); // the decision answers them
    writes.push(eventStmt(ctx.db, ctx.now(), "decision", kind, id, rec.title, `${before} → ${status}${reason ? `: ${reason}` : ""}`, admin));
    // The site lists a game only while its Game Master's profile is approved too, so approving a game of a pending profile changes nothing public yet.
    const waitingForGm = kind === "game" && status === "approved" && (rec.row as { gm_status?: string }).gm_status !== "approved";
    if (waitingForGm) hidden.push(id);
    if (before !== status && (wasApproved || (status === "approved" && !waitingForGm))) dirty = true;
    if (before !== "approved" && status === "approved" && !waitingForGm) urgent = true; // a listing going live has no page yet: ask for a quick build
    if (req.notify === true && before !== status && (status === "approved" || status === "rejected")) mails.push({ id, to: rec.row.email, title: rec.title, slug: rec.slug, waitingForGm });
    done.push(id);
  }
  if (writes.length) await ctx.db.batch(writes);
  const mailFailed: string[] = [];
  for (const m of mails) {
    try {
      await ctx.mailer.send(decisionMail(m.to, status as "approved" | "rejected", kind, m.title, m.slug, reason, ctx.siteUrl, m.waitingForGm));
    } catch {
      mailFailed.push(m.id);
      await logEvent(ctx.db, ctx.now(), "mail failed", kind, m.id, m.title, "the decision email could not be sent", admin).catch(() => undefined);
    }
  }
  if (dirty) await markDirty(ctx, urgent);
  return { ok: true as const, updated: done, stale, publishing: dirty, mailFailed, hidden };
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

/**
 * An admin confirms that a Game Master's WhatsApp number is theirs (the Game Master sent the profile's code from that number, and WhatsApp showed the admin
 * the sender), or takes the confirmation back. `number` is the number the admin looked at: if the Game Master changed it meanwhile, nothing is confirmed.
 */
export async function setVerified(ctx: Ctx, admin: string, req: Record<string, unknown>) {
  if (typeof req.id !== "string" || typeof req.verified !== "boolean") return fail("bad_request");
  const p = await one<ProfileRow>(ctx.db, "SELECT * FROM profiles WHERE id = ?", req.id);
  if (!p) return fail("not_found");
  if (req.verified && (!p.whatsapp || req.number !== p.whatsapp)) return fail("stale");
  const value = req.verified ? p.whatsapp : "";
  const changed = p.verified_whatsapp !== value;
  if (changed) {
    await exec(ctx.db, "UPDATE profiles SET verified_whatsapp = ? WHERE id = ?", value, p.id);
    await logEvent(ctx.db, ctx.now(), "changed", "gm", p.id, p.name, req.verified ? "WhatsApp number verified" : "WhatsApp number verification removed", admin);
  }
  const publishing = changed && p.status === "approved";
  if (publishing) await markDirty(ctx); // the badge is on the public pages
  return { ok: true as const, publishing, verified: req.verified };
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
  const email = normalizeEmail(rawEmail);
  if (!email) return fail("bad_request");
  if (email === ctx.owner) return fail("forbidden", "owner");
  if (email === by) return fail("forbidden", "self");
  if (by !== ctx.owner) return fail("forbidden", "owner_only");
  await exec(ctx.db, "DELETE FROM admins WHERE email = ?", email);
  await exec(ctx.db, "DELETE FROM merge_requests WHERE requested_by = ?", email); // what an admin asked for goes with their authority
  await logEvent(ctx.db, ctx.now(), "admin removed", "", "", "", email, by);
  return { ok: true as const, admins: (await listAdmins(ctx)).map((a) => ({ email: a.email, addedBy: a.added_by, addedAt: a.added_at })) };
}

type Sides = { from: ProfileRow; into: ProfileRow; fromEmail: string; intoEmail: string };

/** Both profiles of a merge and their addresses, or why it cannot happen. */
async function mergeSides(ctx: Ctx, fromProfileId: unknown, intoProfileId: unknown): Promise<Sides | AdminFail> {
  if (typeof fromProfileId !== "string" || typeof intoProfileId !== "string" || fromProfileId === intoProfileId) return fail("bad_request");
  const from = await one<ProfileRow>(ctx.db, "SELECT * FROM profiles WHERE id = ?", fromProfileId);
  const into = await one<ProfileRow>(ctx.db, "SELECT * FROM profiles WHERE id = ?", intoProfileId);
  if (!from || !into) return fail("not_found");
  const fromAccount = await one<{ email: string }>(ctx.db, "SELECT email FROM accounts WHERE id = ?", from.account_id);
  const intoAccount = await one<{ email: string }>(ctx.db, "SELECT email FROM accounts WHERE id = ?", into.account_id);
  if (!fromAccount || !intoAccount) return fail("not_found");
  // A merge hands the duplicate's address the other account's identity, so it must never touch an owner or admin account.
  if ((await isAdmin(ctx, fromAccount.email)) || (await isAdmin(ctx, intoAccount.email))) return fail("forbidden", "admin_account");
  return { from, into, fromEmail: fromAccount.email, intoEmail: intoAccount.email };
}

/**
 * An admin asks for two profiles to be merged. Nothing moves: the person whose account would absorb the other address is mailed, and
 * the merge happens when they accept it while signed in (`respondMerge`). A mail failure leaves the request open, and the person sees
 * it on their account page. `fromProfileId` is the duplicate (the one the admin page flags), `intoProfileId` the account that stays.
 */
export async function requestMerge(ctx: Ctx, admin: string, fromProfileId: unknown, intoProfileId: unknown) {
  const sides = await mergeSides(ctx, fromProfileId, intoProfileId);
  if ("ok" in sides) return sides;
  const { from, into, fromEmail, intoEmail } = sides;
  if (!(await allow(ctx.db, `mergeask:${into.id}`, 2, DAY_MS, ctx.now()))) return fail("rate_limited"); // clicking again must not mail the same person over and over
  await exec(ctx.db, "DELETE FROM merge_requests WHERE created_at < ? OR (from_profile_id = ? AND into_profile_id = ?)", iso(ctx.now() - MERGE_REQUEST_DAYS * DAY_MS), from.id, into.id);
  await exec(ctx.db, "INSERT INTO merge_requests (id, from_profile_id, into_profile_id, requested_by, created_at) VALUES (?, ?, ?, ?, ?)", randomId(12), from.id, into.id, admin, iso(ctx.now()));
  await logEvent(ctx.db, ctx.now(), "merge asked", "gm", into.id, into.name, `profile ${from.name} (${from.id}) asked to merge into this one`, admin);
  await ctx.mailer.send(mergeRequestMail(intoEmail, fromEmail, ctx.siteUrl)).catch(() => logEvent(ctx.db, ctx.now(), "mail failed", "gm", into.id, into.name, "the merge request email could not be sent", admin));
  return { ok: true as const, requested: true as const };
}

/**
 * The person whose account was asked to absorb another address answers. Only the signed-in owner of the target account can: the request
 * says whose account it is for, and any other session gets "not_found" so nothing is learned about other people's requests.
 */
export async function respondMerge(ctx: Ctx, s: Session, requestId: unknown, accept: unknown) {
  if (typeof requestId !== "string" || typeof accept !== "boolean") return fail("bad_request");
  const req = await one<{ id: string; from_profile_id: string; into_profile_id: string; requested_by: string }>(ctx.db, "SELECT id, from_profile_id, into_profile_id, requested_by FROM merge_requests WHERE id = ? AND created_at >= ?", requestId, iso(ctx.now() - MERGE_REQUEST_DAYS * DAY_MS));
  const into = req ? await one<ProfileRow>(ctx.db, "SELECT * FROM profiles WHERE id = ?", req.into_profile_id) : null;
  if (!req || !into || into.account_id !== s.accountId) return fail("not_found");
  // The request carries its asker's authority: once that person is no longer an admin, nobody can accept it for them.
  if (accept && !(await isAdmin(ctx, req.requested_by))) {
    await exec(ctx.db, "DELETE FROM merge_requests WHERE id = ?", req.id);
    return fail("not_found");
  }
  if (!accept) {
    await exec(ctx.db, "DELETE FROM merge_requests WHERE id = ?", req.id);
    await logEvent(ctx.db, ctx.now(), "merge declined", "gm", into.id, into.name, `a request to merge ${req.from_profile_id} into this profile was declined`, s.email);
    return { ok: true as const, merged: false as const };
  }
  const sides = await mergeSides(ctx, req.from_profile_id, req.into_profile_id);
  if ("ok" in sides) {
    if (sides.error === "not_found") await exec(ctx.db, "DELETE FROM merge_requests WHERE id = ?", req.id); // the duplicate is gone already
    return sides;
  }
  const { from } = sides;
  // One batch, all or none: a failure half-way must not leave a duplicate account with no profile and nothing to retry.
  await ctx.db.batch([
    // A game of a profile that was not live must not go live by being moved under one that is: it waits for an admin's look.
    ctx.db.prepare("UPDATE games SET profile_id = ?, status = CASE WHEN status = 'approved' AND ? != 'approved' THEN 'pending' ELSE status END, updated_at = ? WHERE profile_id = ?").bind(into.id, from.status, iso(ctx.now()), from.id),
    ctx.db.prepare("DELETE FROM profiles WHERE id = ?").bind(from.id),
    ctx.db.prepare("UPDATE accounts SET merged_into = ? WHERE merged_into = ?").bind(into.account_id, from.account_id), // accounts merged into the duplicate earlier follow it
    ctx.db.prepare("UPDATE accounts SET merged_into = ? WHERE id = ?").bind(into.account_id, from.account_id),
    ctx.db.prepare("UPDATE sessions SET account_id = ? WHERE account_id = ?").bind(into.account_id, from.account_id),
    ctx.db.prepare("DELETE FROM merge_requests WHERE from_profile_id = ? OR into_profile_id = ?").bind(from.id, from.id),
    eventStmt(ctx.db, ctx.now(), "merged", "gm", into.id, into.name, `profile ${from.name} (${from.id}) merged into this one, accepted by its owner`, s.email),
  ]);
  await markDirty(ctx);
  return { ok: true as const, merged: true as const };
}

/** One admin API call, after the caller has been signed in. */
export async function handleAdmin(ctx: Ctx, email: string, req: Record<string, unknown>, deployConfigured: boolean, deployNow: () => Promise<boolean>) {
  if (!(await isAdmin(ctx, email))) return fail("forbidden", email);
  switch (req.action) {
    case "whoami": return { ok: true as const, email, owner: email === ctx.owner };
    case "queue": return queue(ctx, deployConfigured);
    case "review": return review(ctx, email, req);
    case "patch": return patch(ctx, email, req);
    case "verify": return setVerified(ctx, email, req);
    case "admin.add": return addAdmin(ctx, email, req.email);
    case "admin.remove": return removeAdmin(ctx, email, req.email);
    case "merge": return requestMerge(ctx, email, req.fromId, req.intoId);
    case "deploy": return (await deployNow()) ? { ok: true as const } : fail("deploy_failed");
    default: return fail("bad_request");
  }
}
