// Accounts nobody signs in to are erased: about two years after the last sign-in the person is emailed, and a month later, if they
// have still not signed in, the account, profile, games and pictures go (ADR-27). The owner and the admins never expire. Signing in
// at any time restarts the clock (auth.ts), so an active Game Master never sees any of this.
import { isAdmin, type Ctx } from "./auth.ts";
import { many, exec } from "./db.ts";
import { expiryMail } from "./email.ts";
import { eraseAccount } from "./store.ts";
import { DAY_MS, iso, logEvent } from "./util.ts";

export const INACTIVE_DAYS = 730;
export const GRACE_DAYS = 30;
/**
 * Per run, so a first run over many old accounts cannot use up the mail relay's daily limit, and so one run stays inside the 50 database queries a request may
 * make. Counted per statement (a unit test does it, with a game on every account): the rest of the daily job is about 27, an erase about 19 and a warning about 6,
 * so a run either erases one account (about 46) or warns up to three (about 45), never both. That drains a backlog slowly (accounts that came in together
 * expire together); the proper cure is expiry in a timer request of its own, which needs the timers Worker deployed again (docs/handoff.md).
 */
export const ERASE_PER_RUN = 1;
export const WARN_PER_RUN = 3;

type Row = { id: string; email: string };

export async function expireInactive(ctx: Ctx, deleteFiles: (keys: string[]) => Promise<void>): Promise<{ warned: number; erased: number }> {
  const now = ctx.now();
  let erased = 0;
  let warned = 0;

  // Erase first: warned long enough ago and not back since. (A sign-in clears the warning, so "still warned" means "still away".)
  const overdue = await many<Row>(ctx.db, "SELECT id, email FROM accounts WHERE merged_into IS NULL AND expiry_warned_at IS NOT NULL AND expiry_warned_at < ? ORDER BY expiry_warned_at LIMIT ?", iso(now - GRACE_DAYS * DAY_MS), ERASE_PER_RUN * 3);
  for (const a of overdue) {
    if (erased >= ERASE_PER_RUN) break;
    if (await isAdmin(ctx, a.email)) continue;
    try {
      await deleteFiles(await eraseAccount(ctx, { accountId: a.id, email: a.email }));
      await logEvent(ctx.db, now, "expired", "account", a.id, "", "account and data erased after two years without a sign-in", "the daily job");
      erased++;
    } catch (e) {
      await logEvent(ctx.db, now, "expire_failed", "account", a.id, "", String(e instanceof Error ? e.message : e).slice(0, 120), "the daily job");
    }
  }

  if (erased > 0) return { warned, erased }; // an erase takes most of the request's queries: the warnings wait for the next run

  const idle = await many<Row>(ctx.db, "SELECT id, email FROM accounts WHERE merged_into IS NULL AND expiry_warned_at IS NULL AND COALESCE(last_seen_at, created_at) < ? ORDER BY COALESCE(last_seen_at, created_at) LIMIT ?", iso(now - INACTIVE_DAYS * DAY_MS), WARN_PER_RUN * 3);
  for (const a of idle) {
    if (warned >= WARN_PER_RUN) break;
    if (await isAdmin(ctx, a.email)) continue;
    // Marked first, then mailed: if the mark cannot be written (the request is out of queries) nothing is sent, so nobody is warned twice; if the mail fails the
    // mark is taken off again, and the next daily run tries again (the failure is already recorded by the mailer).
    if ((await exec(ctx.db, "UPDATE accounts SET expiry_warned_at = ? WHERE id = ? AND expiry_warned_at IS NULL", iso(now), a.id)) !== 1) continue;
    try {
      await ctx.mailer.send(expiryMail(a.email, GRACE_DAYS, ctx.siteUrl));
    } catch {
      await exec(ctx.db, "UPDATE accounts SET expiry_warned_at = NULL WHERE id = ?", a.id);
      continue;
    }
    await logEvent(ctx.db, now, "expiry_warned", "account", a.id, "", `warned: erased in ${GRACE_DAYS} days unless they sign in`, "the daily job");
    warned++;
  }
  return { warned, erased };
}
