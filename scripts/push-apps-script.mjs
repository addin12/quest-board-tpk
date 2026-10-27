// Pushes apps-script/Code.gs and appsscript.json to the live Apps Script project and moves the web app's deployment to a
// new version (its address stays the same), with Google's clasp. CreateForms.gs is never pushed: it is not the backend.
//
//   npm run script:deploy            push and deploy
//   npm run script:deploy -- --dry   only stage the files and say what would happen
//
// Once: `npx @google/clasp@3.4.1 login` (a Google consent page), switch on the Apps Script API at
// https://script.google.com/home/usersettings, and write the two ids to .apps-script.local.json (not committed):
//   { "scriptId": "<Project Settings > Script ID>", "deploymentId": "<clasp list-deployments: the one that is not @HEAD>" }
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const CLASP = "npx --yes @google/clasp@3.4.1";
const ID = /^[A-Za-z0-9_-]{20,}$/;

/** The two ids, checked: a typo here would otherwise push to the wrong place or fail halfway. */
export function parseConfig(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  if (typeof c.scriptId !== "string" || !ID.test(c.scriptId)) throw new Error('.apps-script.local.json needs "scriptId" (Project Settings > Script ID).');
  if (typeof c.deploymentId !== "string" || !ID.test(c.deploymentId)) throw new Error('.apps-script.local.json needs "deploymentId" (`clasp list-deployments`: the one that is not @HEAD).');
  return { scriptId: c.scriptId, deploymentId: c.deploymentId };
}

function run(command, cwd) {
  return execSync(command, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).split("\n").filter((l) => !l.includes("npm warn")).join("\n").trim();
}

function main() {
  const dry = process.argv.includes("--dry");
  const configPath = path.join(ROOT, ".apps-script.local.json");
  if (!existsSync(configPath)) throw new Error("Missing .apps-script.local.json: see the top of scripts/push-apps-script.mjs.");
  const { scriptId, deploymentId } = parseConfig(JSON.parse(readFileSync(configPath, "utf8")));

  // Inside the repo (git-ignored), not the OS temp folder: clasp refuses a folder that reaches it through a link, as Windows temp folders can.
  const stage = path.join(ROOT, ".apps-script-stage");
  rmSync(stage, { recursive: true, force: true });
  try {
    mkdirSync(stage, { recursive: true });
    for (const f of ["Code.gs", "appsscript.json"]) copyFileSync(path.join(ROOT, "apps-script", f), path.join(stage, f));
    writeFileSync(path.join(stage, ".clasp.json"), JSON.stringify({ scriptId, rootDir: "." }));
    console.log(`Staged Code.gs and appsscript.json for the script ending …${scriptId.slice(-6)}.`);
    if (dry) return console.log("Dry run: nothing was pushed.");

    console.log(run(`${CLASP} push --force`, stage));
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    console.log(run(`${CLASP} deploy -i ${deploymentId} -d "npm run script:deploy, ${stamp} UTC"`, stage));
    console.log("Done. The web address is unchanged; the timers already use the new code.");
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith("push-apps-script.mjs")) {
  try { main(); } catch (err) { console.error(`[script:deploy] FAILED: ${err.message}`); process.exit(1); }
}
