// The guides stay true to the code: the forms guide lists every question the script reads, every link in the docs
// leads somewhere, and the export fix copies prefetch files to the names the browser asks for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixExport } from "../../scripts/fix-export.mjs";
import { ADMIN_COLS, GAME_COLS, GM_COLS } from "../support/fake-sheet.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("docs/forms.md names every question the script reads, and the columns the script adds", () => {
  const guide = read("docs/forms.md");
  const missing = [...Object.values(GAME_COLS), ...Object.values(GM_COLS)].filter((title) => !guide.includes(`\`${title}\``));
  assert.deepEqual(missing, [], "add these questions to docs/forms.md (or the script reads a column the guide doesn't ask for)");
  for (const col of ADMIN_COLS) assert.ok(guide.includes(`\`${col}\``), `docs/forms.md should list the Sheet column ${col}`);
});

test("every relative link in the README and the guides points at a file that exists", () => {
  const files = ["README.md", "CLAUDE.md", "DECISIONS.md", ...readdirSync(path.join(root, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)];
  const broken: string[] = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g)) {
      const target = path.join(root, path.dirname(f), m[1].split("#")[0]);
      if (!existsSync(target)) broken.push(`${f} → ${m[1]}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("the public pages' environment settings are all in .env.example and the README", () => {
  const used = new Set([...read("src/lib/site.ts").matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]).concat("TPK_API_URL"));
  const example = read(".env.example");
  const readme = read("README.md");
  for (const name of used) {
    assert.ok(example.includes(`${name}=`), `${name} is missing from .env.example`);
    assert.ok(readme.includes(name), `${name} is missing from the README's configuration table`);
  }
});

test("fixExport copies each nested prefetch file to its dotted name, and does nothing twice", () => {
  const out = mkdtempSync(path.join(tmpdir(), "tpk-export-"));
  const nested = path.join(out, "en", "games", "x-1", "__next.$d$lang", "games", "$d$slug");
  mkdirSync(nested, { recursive: true });
  writeFileSync(path.join(nested, "__PAGE__.txt"), "segment");
  mkdirSync(path.join(out, "en", "__next.$d$lang"), { recursive: true });
  writeFileSync(path.join(out, "en", "__next.$d$lang", "__PAGE__.txt"), "home");
  writeFileSync(path.join(out, "en", "index.html"), "<html>");

  assert.equal(fixExport(out), 2);
  assert.equal(readFileSync(path.join(out, "en", "games", "x-1", "__next.$d$lang.games.$d$slug.__PAGE__.txt"), "utf8"), "segment");
  assert.equal(readFileSync(path.join(out, "en", "__next.$d$lang.__PAGE__.txt"), "utf8"), "home");
  assert.equal(fixExport(out), 0);
  assert.ok(statSync(path.join(out, "en", "index.html")).isFile());
});
