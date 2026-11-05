// Telling Cloudflare Pages to rebuild the site after a change, without building for every click: at most one build per
// `MIN_GAP_MS`, however many changes arrive. A change only sets a "dirty" mark; this runs on each change and on a timer.
//
// The mark is not cleared when the hook is accepted but when the site shows it has caught up: every build writes /build.json (scripts/build-data.mjs)
// with the time its data was read, and the timer compares it with the mark. A build that failed, was refused (the monthly build limit, too many
// files) or never started is sent again with growing gaps, and after STUCK_AFTER sends the owner is told (watch.ts) and /api/health says so.
import type { Ctx } from "./auth.ts";
import { exec } from "./db.ts";
import { iso, metaGet, metaSet } from "./util.ts";

export const MIN_GAP_MS = 30_000;
/** A build that has not landed this long after its hook was sent is sent again; the next wait is twice as long, up to RETRY_MAX_MS. */
export const RETRY_BASE_MS = 10 * 60_000;
export const RETRY_MAX_MS = 60 * 60_000;
/** When the site's /build.json cannot be read (a site older than that file, or an outage), a build is assumed to have landed this long after its hook. */
export const ASSUME_BUILT_MS = 15 * 60_000;
/** After this many sends for one change the publishing counts as stuck. */
export const STUCK_AFTER = 3;

export type DeployResult = "idle" | "wait" | "sent" | "failed";

/** When the data of the live site's build was read, from the site's own /build.json; null when the file cannot be read. */
async function siteBuiltAt(ctx: Ctx, fetcher: typeof fetch): Promise<number | null> {
  try {
    const res = await fetcher(`${ctx.siteUrl}/build.json?t=${ctx.now()}`, { headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) return null;
    const at = Date.parse(((await res.json()) as { generatedAt?: string }).generatedAt ?? "");
    return Number.isNaN(at) ? null : at;
  } catch {
    return null;
  }
}

/** The site has caught up with the change marked at `dirty`: the mark goes (unless a newer change replaced it meanwhile) and so does any "stuck" note. */
async function settle(ctx: Ctx, dirty: string): Promise<void> {
  await exec(ctx.db, "DELETE FROM meta WHERE key = 'dirty' AND value = ?", dirty);
  await exec(ctx.db, "DELETE FROM meta WHERE key IN ('deploy_attempts', 'deploy_failed_since')");
}

async function noteFailure(ctx: Ctx): Promise<"failed"> {
  if (!(await metaGet(ctx.db, "deploy_failed_since"))) await metaSet(ctx.db, "deploy_failed_since", iso(ctx.now()));
  return "failed";
}

/**
 * Builds if the site is behind and the last build was long enough ago; sends the build again if the last one never landed.
 * `force` skips the waits (the admin's "Publish now", and the daily build, which is marked like a change so it is checked like one).
 */
export async function deployIfDue(ctx: Ctx, hookUrl: string, fetcher: typeof fetch = fetch, force = false): Promise<DeployResult> {
  const now = ctx.now();
  let dirty = await metaGet(ctx.db, "dirty");
  if (!dirty && !force) return "idle";
  const last = await metaGet(ctx.db, "lastDeploy");
  if (!force && last && now - Date.parse(last) < MIN_GAP_MS) return "wait";

  let attempts = 1;
  if (!force && dirty && last && Date.parse(last) >= Date.parse(dirty)) {
    // A build was sent after the last change. Is it on the site yet?
    const builtAt = await siteBuiltAt(ctx, fetcher);
    const landed = builtAt !== null ? builtAt >= Date.parse(dirty) : now - Date.parse(last) > ASSUME_BUILT_MS;
    if (landed) {
      await settle(ctx, dirty);
      return "idle";
    }
    const sent = Number(await metaGet(ctx.db, "deploy_attempts")) || 1;
    if (now - Date.parse(last) < Math.min(RETRY_BASE_MS * 2 ** (sent - 1), RETRY_MAX_MS)) return "wait";
    attempts = sent + 1; // it has had its time: send it again
  }
  if (!dirty) {
    dirty = iso(now);
    await metaSet(ctx.db, "dirty", dirty);
  }
  if (!hookUrl) return noteFailure(ctx);
  // Claim the build before sending it, so two Workers firing together send one.
  const claimed = await exec(ctx.db, "UPDATE meta SET value = ? WHERE key = 'lastDeploy' AND value = ?", iso(now), last);
  if (!claimed) {
    if (last) return "wait";
    await metaSet(ctx.db, "lastDeploy", iso(now));
  }
  try {
    const res = await fetcher(hookUrl, { method: "POST" });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    // Nothing was sent, so the claim is given back: the next tick sees the change as still waiting for a build, not as one in progress.
    if (last) await exec(ctx.db, "UPDATE meta SET value = ? WHERE key = 'lastDeploy'", last);
    else await exec(ctx.db, "DELETE FROM meta WHERE key = 'lastDeploy'");
    return noteFailure(ctx);
  }
  await metaSet(ctx.db, "deploy_attempts", String(attempts));
  if (attempts >= STUCK_AFTER) await noteFailure(ctx);
  return "sent";
}

/** What /api/health shows of the publishing: a change waiting, the last send, how many sends it took, and since when it has been failing. */
export async function deployState(ctx: Ctx) {
  return {
    pending: Boolean(await metaGet(ctx.db, "dirty")),
    lastSentAt: (await metaGet(ctx.db, "lastDeploy")) || null,
    attempts: Number(await metaGet(ctx.db, "deploy_attempts")) || 0,
    failingSince: (await metaGet(ctx.db, "deploy_failed_since")) || null,
  };
}
