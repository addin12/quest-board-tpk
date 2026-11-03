// The backend's timers, as a tiny Cloudflare Worker with cron triggers (cron/wrangler.toml). A Pages Function has no schedule of its
// own. It replaced a GitHub Actions timer (ADR-26 amendment): GitHub switches scheduled workflows off after 60 days without repo activity.
//   every minute      POST /api/cron?job=tick     sends a waiting build (changes within 30 seconds of the last one are held back)
//   once a day         POST /api/cron?job=daily    backs up the database to the bucket, tidies old sign-ins, rebuilds so ended listings leave
type Env = { SITE_URL: string; BUILD_KEY: string };

const DAILY = "30 18 * * *"; // 01:30 in Jakarta; must match the crons in wrangler.toml

const timers = {
  async scheduled(event: { cron: string }, env: Env): Promise<void> {
    const job = event.cron === DAILY ? "daily" : "tick";
    // The key goes in a header: an address would be logged.
    const res = await fetch(`${env.SITE_URL}/api/cron?job=${job}`, {
      method: "POST",
      headers: { Origin: env.SITE_URL, Authorization: `Bearer ${env.BUILD_KEY}` },
      signal: AbortSignal.timeout(120_000),
    });
    // A failed run shows in the Worker's logs and its error count; the key is never logged.
    if (!res.ok) throw new Error(`The backend answered ${res.status} for the ${job} job`);
  },
};
export default timers;
