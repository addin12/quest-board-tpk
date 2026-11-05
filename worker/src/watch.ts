// Tells the owner when the system has gone quiet. Nothing here can fix anything; it only makes a failure visible by email and in
// /api/health. If the mail relay itself is the thing that broke, the email cannot be sent: the failure is still in /api/health.
import { listAdmins, type Ctx } from "./auth.ts";
import { exec, many, one } from "./db.ts";
import { expiringMail, reviewDigestMail } from "./email.ts";
import { NUDGE_BEFORE_DAYS } from "../../src/lib/on-demand.ts";
import { DAY_MS, iso, metaGet, metaSet } from "./util.ts";

/** The daily job should leave a backup every 24 hours; this much silence means the timer or the backup is broken. */
export const BACKUP_STALE_MS = 36 * 3_600_000;

/** Emails the owner, best effort: a failed alert must never break the job that raised it. */
export async function tellOwner(ctx: Ctx, subject: string, body: string): Promise<void> {
  try {
    await ctx.mailer.send({ to: ctx.owner, subject, body, kind: "system" });
  } catch {
    // already recorded by the recording mailer
  }
}

/**
 * One email to the Game Master of an on-request game that stops being listed within NUDGE_BEFORE_DAYS, so a game they still run does not vanish by surprise. The note
 * that it was sent is made first (a dead relay is not tried every minute); Extend clears it. A few at a time; best effort, nothing here can fail the tick.
 */
export async function nudgeExpiring(ctx: Ctx): Promise<void> {
  try {
    const now = ctx.now();
    const due = await many<{ id: string; title: string; expires_at: string; email: string }>(
      ctx.db,
      "SELECT g.id, g.title, g.expires_at, a.email FROM games g JOIN profiles p ON p.id = g.profile_id JOIN accounts a ON a.id = p.account_id WHERE g.removed = 0 AND g.status = 'approved' AND g.on_demand = 1 AND g.nudged_at = '' AND g.expires_at > ? AND g.expires_at < ? LIMIT 5",
      iso(now), iso(now + NUDGE_BEFORE_DAYS * DAY_MS),
    );
    for (const g of due) {
      await exec(ctx.db, "UPDATE games SET nudged_at = ? WHERE id = ?", iso(now), g.id);
      try {
        await ctx.mailer.send(expiringMail(g.email, g.title, g.expires_at, ctx.siteUrl));
      } catch {
        // recorded by the recording mailer
      }
    }
  } catch {
    // the tick goes on
  }
}

/** At most one review digest in this long: a stream of submissions is a few mails a day, never one each. */
export const DIGEST_GAP_MS = 3 * 3_600_000;
/** A digest waits until the newest submission is this old, so a Game Master saving a profile and four games is one message. */
export const DIGEST_SETTLE_MS = 10 * 60_000;
/** Something that has waited this long is mentioned again (at most once a day) even when nothing new has arrived. */
export const NAG_AFTER_MS = 3 * DAY_MS;

/**
 * Emails the owner and the admins that submissions are waiting, as one digest: how many, the titles of the new ones, and a reminder when something
 * has waited three days. Called by the one-minute tick; a cheap check unless a digest is due. The note that it was sent is made first, so a relay
 * that is down is not tried every minute (and does not use up the share of notice mails); the reminder after three days covers a lost digest.
 * Best effort: nothing here can fail the tick.
 */
export async function digestReviewers(ctx: Ctx): Promise<void> {
  try {
    const now = ctx.now();
    const last = await metaGet(ctx.db, "digest_at");
    if (last && now - Date.parse(last) < DIGEST_GAP_MS) return;
    const since = last ?? "";
    const fresh = await many<{ title: string; updated_at: string }>(
      ctx.db,
      "SELECT name AS title, updated_at FROM profiles WHERE status = 'pending' AND updated_at > ? UNION ALL SELECT title, updated_at FROM games WHERE status = 'pending' AND removed = 0 AND updated_at > ? ORDER BY updated_at",
      since, since,
    );
    const newest = fresh.length ? Date.parse(fresh[fresh.length - 1]!.updated_at) : 0;
    const settled = fresh.length > 0 && now - newest >= DIGEST_SETTLE_MS;
    const old = await one<{ games: number; gms: number; oldest: string | null }>(
      ctx.db,
      "SELECT (SELECT COUNT(*) FROM games WHERE status = 'pending' AND removed = 0) AS games, (SELECT COUNT(*) FROM profiles WHERE status = 'pending') AS gms, (SELECT MIN(m) FROM (SELECT MIN(updated_at) AS m FROM games WHERE status = 'pending' AND removed = 0 UNION ALL SELECT MIN(updated_at) FROM profiles WHERE status = 'pending')) AS oldest",
    );
    const oldestMs = old?.oldest ? Date.parse(old.oldest) : now;
    const nag = (old?.games ?? 0) + (old?.gms ?? 0) > 0 && now - oldestMs >= NAG_AFTER_MS && (!last || now - Date.parse(last) >= DAY_MS);
    if (!settled && !nag) return;
    await metaSet(ctx.db, "digest_at", iso(now));
    const to = [...new Set([ctx.owner, ...(await listAdmins(ctx)).map((a) => a.email)])];
    const mail = (address: string) => reviewDigestMail(address, { games: old?.games ?? 0, gms: old?.gms ?? 0, oldestDays: Math.floor((now - oldestMs) / DAY_MS) }, fresh.map((f) => f.title), ctx.siteUrl);
    for (const address of to) await ctx.mailer.send(mail(address)).catch(() => undefined); // the share of notice mails (email.ts) ends the loop's effect when used up
  } catch {
    // never break the tick
  }
}

/** Emails the owner, at most once a day, when changes have not reached the site for half an hour (a build failed, was refused or never started). */
export async function watchDeploy(ctx: Ctx): Promise<void> {
  const since = await metaGet(ctx.db, "deploy_failed_since");
  if (!since || ctx.now() - Date.parse(since) < 30 * 60_000) return;
  const told = await metaGet(ctx.db, "deploy_alert_at");
  if (told && ctx.now() - Date.parse(told) < DAY_MS) return;
  await metaSet(ctx.db, "deploy_alert_at", iso(ctx.now()));
  await tellOwner(ctx, "Quest Board: the site is not getting its changes", `A change has been waiting to reach the site since ${since}: the build was refused, failed, or never started.\n\nOpen Cloudflare, Workers & Pages, quest-board-tpk, Deployments and read the newest log. The usual causes: the monthly limit of 500 builds, more than 20,000 files, or a wrong BUILD_KEY (see docs/runbook.md). GET /api/health (build key in an Authorization header) shows "deploy".\n\nThe site that is live stays up as it was.`);
}

/** Called by the one-minute tick: one email a day at most while the last good backup is too old. */
export async function watchBackup(ctx: Ctx): Promise<void> {
  const now = ctx.now();
  let since = await metaGet(ctx.db, "monitor_since");
  if (!since) {
    since = iso(now);
    await metaSet(ctx.db, "monitor_since", since);
  }
  const last = (await metaGet(ctx.db, "backup_ok_at")) || since;
  const hours = Math.floor((now - Date.parse(last)) / 3_600_000);
  if (now - Date.parse(last) < BACKUP_STALE_MS) return;
  const told = await metaGet(ctx.db, "stale_alert_at");
  if (told && now - Date.parse(told) < DAY_MS) return;
  await metaSet(ctx.db, "stale_alert_at", iso(now));
  const why = (await metaGet(ctx.db, "backup_error")) || "no error was recorded, so the daily job probably did not run";
  await tellOwner(ctx, "Quest Board: no backup for " + hours + " hours", `The last good backup was ${hours} hours ago (${last}).\n\nWhat the system knows: ${why}.\n\nCheck the Worker "quest-board-cron" in the Cloudflare dashboard (Workers → quest-board-cron → Logs), and GET /api/health (build key in an Authorization header) for details.`);
}
