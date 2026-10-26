// Runs after `next build`: makes the exported files match what Next's browser code asks for.
//
// Next 16 writes a page's prefetch data as  <page>/__next.$d$lang/games/$d$slug/__PAGE__.txt  (nested folders) but the
// browser requests  <page>/__next.$d$lang.games.$d$slug.__PAGE__.txt  (dots). On a static host the second name is a
// 404, which also leaves the page title empty after a link is followed. Copying each nested file to its dotted name
// fixes both. If a later Next version writes the dotted names itself, there is nothing to copy and this does nothing.
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** "__next.$d$lang" + "games/$d$slug/__PAGE__.txt" -> "__next.$d$lang.games.$d$slug.__PAGE__.txt" */
export const flatName = (dirName, relativePath) => `${dirName}.${relativePath.split(/[\\/]/).join(".")}`;

function filesIn(dir, base = dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesIn(full, base) : [path.relative(base, full)];
  });
}

/** Copies every nested prefetch file under `outDir` to its dotted name; returns how many. */
export function fixExport(outDir) {
  let copied = 0;
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (!statSync(full).isDirectory()) continue;
      if (name.startsWith("__next.")) {
        for (const rel of filesIn(full)) {
          const target = path.join(dir, flatName(name, rel));
          if (!existsSync(target)) { copyFileSync(path.join(full, rel), target); copied++; }
        }
      } else visit(full);
    }
  };
  visit(outDir);
  return copied;
}

if (process.argv[1]?.endsWith("fix-export.mjs")) {
  const out = path.join(import.meta.dirname, "..", "out");
  console.log(`[export] ${fixExport(out)} prefetch files copied to the names the browser asks for`);
}
