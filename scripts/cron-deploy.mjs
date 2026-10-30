// Deploys the timers Worker (cron/) and stores its secret, after `npx wrangler login` and `npm run cloudflare:setup`
// (which makes the buildKey in .cloudflare.local.json). Safe to run again.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const LOCAL = path.join(ROOT, ".cloudflare.local.json");
const WRANGLER = "npx --yes wrangler@4";
const CONFIG = path.join("cron", "wrangler.toml");

const buildKey = existsSync(LOCAL) ? JSON.parse(readFileSync(LOCAL, "utf8")).buildKey : "";
if (!buildKey) throw new Error("No buildKey in .cloudflare.local.json: run `npm run cloudflare:setup` first.");

const run = (command, input) => {
  console.log(`$ ${command}`);
  return execSync(command, { cwd: ROOT, encoding: "utf8", input, stdio: ["pipe", "inherit", "inherit"] });
};
run(`${WRANGLER} deploy --config ${CONFIG}`);
run(`${WRANGLER} secret put BUILD_KEY --config ${CONFIG}`, `${buildKey}\n`);
console.log("\nDone: the Worker calls /api/cron every 10 minutes (and a daily job at 01:30 Jakarta time).");
