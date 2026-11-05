// Turns a nightly backup (backups/<day>.json, downloaded from the bucket) into SQL that loads it into an empty database with the migrations
// applied. The steps around it are in docs/runbook.md, "The database was damaged or deleted". Nothing here touches Cloudflare.
//
//   node scripts/restore-backup.mjs <path to backups/<day>.json>   (or: npm run restore:sql -- <path>)
//
// writes <day>.restore.sql next to the backup and says how many rows of each table it holds.
import { readFileSync, writeFileSync } from "node:fs";
import { TABLES, restoreSql } from "../worker/src/backup.ts";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/restore-backup.mjs <backups/<day>.json>");
  process.exit(1);
}
let backup;
try {
  backup = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`Could not read ${file} as JSON: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
if (!backup || typeof backup !== "object" || typeof backup.tables !== "object" || backup.tables === null) {
  console.error(`${file} is not a Quest Board backup (it has no "tables").`);
  process.exit(1);
}
const out = `${file.replace(/\.json$/i, "")}.restore.sql`;
writeFileSync(out, restoreSql(backup));
console.log(`Backup taken ${backup.at ?? "(no date)"}.`);
console.log(TABLES.map((t) => `  ${t}: ${(backup.tables[t] ?? []).length} rows`).join("\n"));
console.log(`Wrote ${out}. It holds personal data: delete it once the restore is done.`);
