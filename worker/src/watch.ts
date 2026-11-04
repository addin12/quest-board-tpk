// Tells the owner when the system has gone quiet. Nothing here can fix anything; it only makes a failure visible by email and in
// /api/health. If the mail relay itself is the thing that broke, the email cannot be sent: the failure is still in /api/health.
import { listAdmins, type Ctx } from "./auth.ts";
import { reviewNoticeMail } from "./email.ts";
import { DAY_MS, allow, iso, metaGet, metaSet } from "./util.ts";

/** Review notices a day across everyone. They share the relay's 90 mails a day with sign-ins (60 at most) and decisions, so this stays small. */
export const NOTICES_PER_DAY = 20;

/** The daily job should leave a backup every 24 hours; this much silence means the timer or the backup is broken. */
export const BACKUP_STALE_MS = 36 * 3_600_000;

/** Emails the owner, best effort: a failed alert must never break the job that raised it. */
export async function tellOwner(ctx: Ctx, subject: string, body: string): Promise<void> {
  try {
    await ctx.mailer.send({ to: ctx.owner, subject, body });
  } catch {
    // already recorded by the recording mailer
  }
}

/**
 * Emails the owner and the admins that a submission is waiting, so a Game Master is not left waiting for someone to open the admin page.
 * At most one notice an hour per account (a GM saving many times is one notice) and NOTICES_PER_DAY in all. Best effort: a failure here never
 * touches the save that raised it.
 */
export async function notifyReviewers(ctx: Ctx, accountId: string, kind: "game" | "gm", title: string): Promise<void> {
  try {
    if (!(await allow(ctx.db, `notice:acct:${accountId}`, 1, 3_600_000, ctx.now())) || !(await allow(ctx.db, "notice:all", NOTICES_PER_DAY, DAY_MS, ctx.now()))) return;
    const to = [...new Set([ctx.owner, ...(await listAdmins(ctx)).map((a) => a.email)])];
    for (const address of to) await ctx.mailer.send(reviewNoticeMail(address, kind, title, ctx.siteUrl)).catch(() => undefined);
  } catch {
    // never break a save
  }
}

/** Called by the 10-minute tick: one email a day at most while the last good backup is too old. */
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
