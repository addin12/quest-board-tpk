// Copies the newest nightly backup out of Cloudflare onto this computer, so the data survives even if the Cloudflare account is lost
// (docs/runbook.md, "A copy outside Cloudflare"). Needs `wrangler` signed in to the account (the one `npm run cloudflare:setup` uses).
//
//   npm run backup:pull                  (copies to ../quest-board-backups, next to the project folder, never inside it)
//   npm run backup:pull -- "D:/Drive/qb" (or to a folder you choose, for example one a private cloud drive syncs)
//
// A backup holds names, email addresses and phone numbers: keep the folder private. Copies older than KEEP_DAYS are deleted here, as they are
// in the bucket, so a person who erased their account is not kept in a copy for longer than the site's own backups keep them.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "quest-board-images";
const KEEP_DAYS = 28;
const WRANGLER = "npx --yes wrangler@4.156.2";

const dir = path.resolve(process.argv[2] ?? path.join(ROOT, "..", "quest-board-backups"));
if (dir === ROOT || dir.startsWith(ROOT + path.sep)) {
  console.error(`Refusing to write into the project folder (${dir}): the repository is public and a backup holds personal data.`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const day = (ms) => new Date(ms).toISOString().slice(0, 10);
let saved = "";
// The nightly job writes backups/<UTC day>.json; if tonight's has not run yet, take the most recent of the last four days.
for (let back = 0; back < 4 && !saved; back++) {
  const name = `${day(Date.now() - back * 86_400_000)}.json`;
  const file = path.join(dir, name);
  try {
    execSync(`${WRANGLER} r2 object get ${BUCKET}/backups/${name} --remote --file "${file}"`, { cwd: ROOT, stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    continue;
  }
  let backup;
  try {
    backup = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    console.error(`${name} came down but is not JSON: left in place for a look.`);
    process.exit(1);
  }
  if (!backup || typeof backup.tables !== "object" || backup.tables === null) {
    console.error(`${name} is not a Quest Board backup (no "tables"): left in place for a look.`);
    process.exit(1);
  }
  saved = file;
  console.log(`Saved ${file}`);
  console.log(`  taken ${backup.at ?? "(no date)"}: ${Object.entries(backup.tables).map(([t, rows]) => `${t} ${rows.length}`).join(", ")}`);
}
if (!saved) {
  console.error("No backup from the last four days could be fetched. Is wrangler signed in (npx wrangler whoami), and did the daily job run (docs/runbook.md, \"The backups\")?");
  process.exit(1);
}

// Old copies go (by the day in the file name, not by when the file was copied).
const cutoff = day(Date.now() - KEEP_DAYS * 86_400_000);
let removed = 0;
for (const f of readdirSync(dir)) {
  const m = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f);
  if (m && m[1] < cutoff && statSync(path.join(dir, f)).isFile()) {
    unlinkSync(path.join(dir, f));
    removed++;
  }
}
if (removed) console.log(`Deleted ${removed} copy(ies) older than ${KEEP_DAYS} days.`);
console.log(existsSync(saved) ? "Done." : "Something went wrong: the file is gone.");
