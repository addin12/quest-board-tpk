// Telling Cloudflare Pages to rebuild the site after a change, without building for every click: at most one build per
// `MIN_GAP_MS`, however many changes arrive. A change only sets a "dirty" mark; this runs on each change and on a timer.
import type { Ctx } from "./auth.ts";
import { exec } from "./db.ts";
import { iso, metaGet, metaSet } from "./util.ts";

export const MIN_GAP_MS = 120_000;

export type DeployResult = "idle" | "wait" | "sent" | "failed";

/** Builds if the site is behind and the last build was long enough ago. `force` skips the wait (the admin's "Publish now"). */
export async function deployIfDue(ctx: Ctx, hookUrl: string, fetcher: typeof fetch = fetch, force = false): Promise<DeployResult> {
  const dirty = await metaGet(ctx.db, "dirty");
  if (!dirty && !force) return "idle";
  const last = await metaGet(ctx.db, "lastDeploy");
  if (!force && last && ctx.now() - Date.parse(last) < MIN_GAP_MS) return "wait";
  if (!hookUrl) return "failed";
  // Claim the build before sending it, so two Workers firing together send one.
  const claimed = await exec(ctx.db, "UPDATE meta SET value = ? WHERE key = 'lastDeploy' AND value = ?", iso(ctx.now()), last);
  if (!claimed) {
    if (last) return "wait";
    await metaSet(ctx.db, "lastDeploy", iso(ctx.now()));
  }
  try {
    const res = await fetcher(hookUrl, { method: "POST" });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    return "failed";
  }
  await exec(ctx.db, "DELETE FROM meta WHERE key = 'dirty'");
  return "sent";
}
