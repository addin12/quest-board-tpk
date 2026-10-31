// One command that creates everything the backend needs in the owner's Cloudflare account, after one `wrangler login`:
//
//   npx wrangler login            (opens a Cloudflare consent page: the only step that needs a person)
//   npm run cloudflare:setup      (add -- --dry to only print what it would do)
//
// It makes the D1 database and the R2 bucket, applies the schema, makes a deploy hook for the backend, and then writes the Pages
// project's bindings and variables through the Pages API. Not through a wrangler.toml in the repo: a config file in the repo makes
// Cloudflare lock the dashboard's variables, and the repo is public. Safe to run again: what exists is reused, the schema is applied
// only to an empty database, and variables are set to the same values.
//
// Secrets go to .cloudflare.local.json (git-ignored) and to the project as encrypted variables, never into the repo or the log.
// Needs: R2 switched on once in the dashboard (Cloudflare cannot do that through the API), and for the mail relay
// `npm run script:deploy` first, which writes .apps-script.local.json's mailSecret.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DRY = process.argv.includes("--dry");
const PROJECT = process.env.CF_PAGES_PROJECT || "quest-board-tpk";
const DB_NAME = "quest-board";
const BUCKET = "quest-board-images";
const HOOK_NAME = "backend";
const WRANGLER = "npx --yes wrangler@4";
const LOCAL = path.join(ROOT, ".cloudflare.local.json");
const MIGRATIONS_DIR = path.join(ROOT, "worker", "migrations");
// Each migration with a query that finds a row once it is applied: the SQL is not written to be applied twice, so this is the record.
const MIGRATIONS = [
  { file: "0001_init.sql", applied: "SELECT 1 FROM sqlite_master WHERE name = 'accounts'" },
  { file: "0002_retention.sql", applied: "SELECT 1 FROM pragma_table_info('accounts') WHERE name = 'last_seen_at'" },
  { file: "0003_mechanics.sql", applied: "SELECT 1 FROM pragma_table_info('games') WHERE name = 'mechanics'" },
];

const sh = (command) => {
  console.log(`$ ${command}`);
  return DRY ? "" : execSync(command, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
};
const fail = (message) => {
  console.error(`\nStopped: ${message}`);
  process.exit(1);
};

const local = existsSync(LOCAL) ? JSON.parse(readFileSync(LOCAL, "utf8")) : {};
local.buildKey ||= randomBytes(32).toString("base64url");
const save = () => !DRY && writeFileSync(LOCAL, `${JSON.stringify(local, null, 2)}\n`);

// The Cloudflare API with the token `wrangler login` stored (or CLOUDFLARE_API_TOKEN). The token is never printed.
const token = process.env.CLOUDFLARE_API_TOKEN || (DRY ? "" : execSync(`${WRANGLER} auth token`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\s+/).pop());
async function api(method, endpoint, body) {
  if (DRY) {
    console.log(`${method} ${endpoint}`);
    return { success: true, result: method === "GET" ? [] : {} };
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}
const must = (r, what) => (r.success ? r.result : fail(`${what}: ${JSON.stringify(r.errors)}`));

const accounts = must(await api("GET", "/accounts"), "cannot list accounts (is wrangler logged in?)");
const account = process.env.CF_ACCOUNT_ID || accounts[0]?.id || (DRY ? "<account>" : fail("no Cloudflare account found"));
if (accounts.length > 1 && !process.env.CF_ACCOUNT_ID) fail(`several accounts (${accounts.map((a) => a.name).join(", ")}): set CF_ACCOUNT_ID`);
const pages = `/accounts/${account}/pages/projects/${PROJECT}`;

// 1. D1
const findDb = async () => (must(await api("GET", `/accounts/${account}/d1/database?name=${DB_NAME}`), "D1 list") || []).find((d) => d.name === DB_NAME);
let db = await findDb();
if (!db) {
  sh(`${WRANGLER} d1 create ${DB_NAME}`);
  db = await findDb();
}
if (!db && !DRY) fail(`could not find or create the D1 database "${DB_NAME}"`);
const databaseId = db?.uuid ?? "<new>";

// 2. R2. Switching R2 on is a one-time dashboard step (code 10042); everything else here waits for it.
const buckets = await api("GET", `/accounts/${account}/r2/buckets`);
if (!buckets.success) {
  const code = buckets.errors?.[0]?.code;
  fail(code === 10042 ? "R2 is not switched on. Cloudflare dashboard → Storage & databases → R2 → enable it (free plan; it may ask for a payment method), then run this again. The database is already made." : `R2: ${JSON.stringify(buckets.errors)}`);
}
if (!(buckets.result?.buckets ?? []).some((b) => b.name === BUCKET)) sh(`${WRANGLER} r2 bucket create ${BUCKET}`);

// 3. The schema: every migration not yet applied, in order
for (const m of MIGRATIONS) {
  if (DRY) {
    console.log(`$ ${WRANGLER} d1 execute ${DB_NAME} --remote --file worker/migrations/${m.file}   (only if not applied)`);
    continue;
  }
  const probe = JSON.parse(sh(`${WRANGLER} d1 execute ${DB_NAME} --remote --json --command "${m.applied}"`));
  if ((probe[0]?.results ?? []).length === 0) sh(`${WRANGLER} d1 execute ${DB_NAME} --remote --file "${path.join(MIGRATIONS_DIR, m.file)}"`);
  else console.log(`(${m.file} is already applied)`);
}

// 4. A deploy hook the backend uses to rebuild the site (the Apps Script has its own, left alone)
if (!local.deployHook) {
  const made = must(await api("POST", `${pages}/deploy_hooks`, { deploy_hook_name: HOOK_NAME, branch: "main" }), "deploy hook");
  local.deployHook = made.deploy_hook_url || made.webhook_url || (made.hook_id ? `https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/${made.hook_id}` : "");
  if (!local.deployHook && !DRY) fail(`the deploy hook was made but its address was not in the answer: ${JSON.stringify(Object.keys(made))}`);
}
save();

// 4b. Turnstile (the robot check on the sign-in form), only with --turnstile; free, and the keys stay in .cloudflare.local.json
if (process.argv.includes("--turnstile") && !local.turnstileSecret) {
  const widget = must(
    await api("POST", `/accounts/${account}/challenges/widgets`, { name: "Quest Board TPK sign-in", domains: [`${PROJECT}.pages.dev`], mode: "managed", region: "world" }),
    "Turnstile widget",
  );
  local.turnstileSiteKey = widget.sitekey ?? "";
  local.turnstileSecret = widget.secret ?? "";
  if ((!local.turnstileSiteKey || !local.turnstileSecret) && !DRY) fail(`the Turnstile widget was made but its keys were not in the answer: ${JSON.stringify(Object.keys(widget))}`);
  save();
}

// 5. The project: bindings and variables
const project = must(await api("GET", pages), "Pages project");
const current = project.deployment_configs?.production?.env_vars ?? {};
const appsScript = existsSync(path.join(ROOT, ".apps-script.local.json")) ? JSON.parse(readFileSync(path.join(ROOT, ".apps-script.local.json"), "utf8")) : {};
const ownerEmail = process.env.OWNER_EMAIL || local.ownerEmail || accounts[0]?.name?.replace(/'s Account$/, "").toLowerCase();
// The relay is the Apps Script web app; its address is kept in .cloudflare.local.json (a secret variable cannot be read back).
const relayUrl = local.mailRelayUrl || (appsScript.deploymentId ? `https://script.google.com/macros/s/${appsScript.deploymentId}/exec` : "");
if (relayUrl) local.mailRelayUrl = relayUrl;
if (!ownerEmail?.includes("@")) fail("set OWNER_EMAIL=you@example.com for this run (the first admin)");
local.ownerEmail = ownerEmail;
const siteUrl = `https://${PROJECT}.pages.dev`;
const plain = (value) => ({ type: "plain_text", value });
const secret = (value) => ({ type: "secret_text", value });
const vars = {
  SITE_URL: plain(siteUrl),
  OWNER_EMAIL: secret(ownerEmail),
  BUILD_KEY: secret(local.buildKey),
  DEPLOY_HOOK: secret(local.deployHook),
  TPK_API_BASE: plain(siteUrl),
  TPK_BUILD_KEY: secret(local.buildKey),
};
if (relayUrl) vars.MAIL_RELAY_URL = secret(relayUrl);
else console.log("(MAIL_RELAY_URL not set: no Apps Script web app address found)");
if (appsScript.mailSecret) vars.MAIL_SECRET = secret(appsScript.mailSecret);
else console.log("(MAIL_SECRET not set yet: run npm run script:deploy, then this again)");
// First deploy on a fresh project: the site's own /api does not exist until it is deployed, so a build that reads from it would fail.
// With --backend-only the build uses the empty day-one data instead; run again without the flag, then rebuild, to switch.
const backendOnly = process.argv.includes("--backend-only");
vars.TPK_DATA_FILE = backendOnly ? plain("data/empty.json") : null;
if (backendOnly) {
  vars.TPK_API_BASE = null;
  vars.TPK_BUILD_KEY = null;
}
// Settings of the retired Google Forms, Sheet and sign-in (ADR-27): removed when present, nothing reads them any more.
for (const name of ["TPK_API_URL", "NEXT_PUBLIC_ADMIN_API_URL", "NEXT_PUBLIC_GAME_FORM_URL", "NEXT_PUBLIC_GM_FORM_URL", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"]) {
  if (name in current) vars[name] = null;
}
if (local.turnstileSecret && local.turnstileSiteKey) {
  vars.TURNSTILE_SECRET = secret(local.turnstileSecret);
  vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY = plain(local.turnstileSiteKey);
}
console.log(`PATCH ${pages}: bindings DB -> ${DB_NAME}, IMAGES -> ${BUCKET}; variables ${Object.entries(vars).map(([k, v]) => (v ? k : `${k} (removed)`)).join(", ")}`);
must(
  await api("PATCH", pages, {
    deployment_configs: {
      production: {
        compatibility_flags: ["nodejs_compat"],
        d1_databases: { DB: { id: databaseId } },
        r2_buckets: { IMAGES: { name: BUCKET } },
        env_vars: vars,
      },
    },
  }),
  "setting the project's bindings and variables",
);
save();

console.log(`
Done${DRY ? " (dry run: nothing was changed)" : ""}. Left for you (values are in .cloudflare.local.json, never in the repo):
  - npm run cron:deploy   the timers Worker (rebuilds a waiting change, backs up daily).
  - Optional: a Turnstile widget (Cloudflare dashboard → Turnstile); put its keys in .cloudflare.local.json as turnstileSiteKey and
    turnstileSecret and run this again.
  - Then push: the next build has the bindings.`);
