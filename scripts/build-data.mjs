// Prepares what the site is built from: src/generated/data.json (+ pictures in public/media/).
//
//   TPK_API_URL=https://script.google.com/macros/s/…/exec  npm run data     the real data
//   npm run data                                                            the demo data (data/sample.json)
//   TPK_DATA_FILE=data/empty.json  npm run data                             data from a local file (CI builds the day-one empty site)
//
// The real data is the Google Sheet script's public JSON: only approved, unexpired games and their approved
// GMs. It is checked again here (src/lib/public-data.ts); bad records are dropped with a warning. If the script
// can't be reached or answers nonsense the build FAILS, so the site that is live stays as it is, instead of
// being replaced by an empty one. Pictures are downloaded from Drive, cropped (covers 4:5, photos square) and
// saved as WebP, so visitors never touch Drive.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parsePublicData } from "../src/lib/public-data.ts";
import { driveThumbUrl, localPicture } from "../src/lib/pictures.ts";

const ROOT = path.join(import.meta.dirname, "..");
const API = (process.env.TPK_API_URL ?? "").trim();
const MEDIA = path.join(ROOT, "public", "media");
const DAY = 86_400_000;

async function loadRaw() {
  if (process.env.TPK_DATA_FILE) return JSON.parse(readFileSync(path.join(ROOT, process.env.TPK_DATA_FILE), "utf8"));
  if (!API) {
    console.log("[data] TPK_API_URL is not set: using data/sample.json (demo data, dates moved to the present)");
    return rebase(JSON.parse(readFileSync(path.join(ROOT, "data", "sample.json"), "utf8")));
  }
  const url = `${API}${API.includes("?") ? "&" : "?"}action=public`;
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`The data script answered ${res.status} for ${API}`);
  const body = await res.text();
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`The data script did not answer with JSON (is the web app deployed for "Anyone"?): ${body.slice(0, 120)}`);
  }
}

/** Demo data: move every date so the earliest game starts in two days. */
function rebase(data) {
  const first = Math.min(...data.games.map((g) => Date.parse(g.startsAt)));
  const today = new Date();
  const shift = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 2) + (first % DAY) - first;
  const move = (iso) => new Date(Date.parse(iso) + shift).toISOString();
  return { ...data, generatedAt: new Date().toISOString(), games: data.games.map((g) => ({ ...g, startsAt: move(g.startsAt), expiresAt: move(g.expiresAt), listedAt: move(g.listedAt) })) };
}

async function download(fileId, width) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(driveThumbUrl(fileId, width), { redirect: "follow", signal: AbortSignal.timeout(30_000) });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length <= 15 * 1024 * 1024) return buf;
      }
    } catch {
      // try again
    }
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  return null;
}

const omit = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

/** Runs `fn` over `items` with at most `n` in flight. */
async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => { for (let x; (x = queue.shift()); ) await fn(x); }));
}

async function main() {
  const { data, warnings } = parsePublicData(await loadRaw());
  for (const w of warnings) console.warn(`[data] warning: ${w}`);

  rmSync(MEDIA, { recursive: true, force: true });
  mkdirSync(path.join(MEDIA, "covers"), { recursive: true });
  mkdirSync(path.join(MEDIA, "gm"), { recursive: true });

  const covers = new Map();
  const photos = new Map();
  await pool(data.games.filter((g) => g.coverId), 4, async (g) => {
    const local = localPicture(g.coverId);
    if (local) return void covers.set(g.id, local);
    const buf = await download(g.coverId, 1200);
    if (!buf) return console.warn(`[data] warning: could not download the cover of "${g.title}" (${g.coverId}): the card shows a colour instead`);
    try {
      const base = sharp(buf).rotate().resize(1080, 1350, { fit: "cover", position: "attention" });
      await base.clone().webp({ quality: 80 }).toFile(path.join(MEDIA, "covers", `${g.id}.webp`));
      await base.clone().resize(480, 600).webp({ quality: 78 }).toFile(path.join(MEDIA, "covers", `${g.id}-sm.webp`));
      covers.set(g.id, `/media/covers/${g.id}.webp`);
    } catch (err) {
      console.warn(`[data] warning: the cover of "${g.title}" is not a readable image: ${err.message}`);
    }
  });
  await pool(data.gms.filter((g) => g.photoId), 4, async (g) => {
    const local = localPicture(g.photoId);
    if (local) return void photos.set(g.id, local);
    const buf = await download(g.photoId, 600);
    if (!buf) return console.warn(`[data] warning: could not download the photo of ${g.name} (${g.photoId})`);
    try {
      await sharp(buf).rotate().resize(320, 320, { fit: "cover", position: "attention" }).webp({ quality: 80 }).toFile(path.join(MEDIA, "gm", `${g.id}.webp`));
      photos.set(g.id, `/media/gm/${g.id}.webp`);
    } catch (err) {
      console.warn(`[data] warning: the photo of ${g.name} is not a readable image: ${err.message}`);
    }
  });

  const site = {
    generatedAt: data.generatedAt,
    gms: data.gms.map((gm) => ({ ...omit(gm, "photoId"), photo: photos.get(gm.id) ?? null })),
    games: data.games.map((g) => ({ ...omit(g, "coverId"), cover: covers.get(g.id) ?? null })),
    goneGames: data.goneGames,
    goneGms: data.goneGms,
  };
  mkdirSync(path.join(ROOT, "src", "generated"), { recursive: true });
  writeFileSync(path.join(ROOT, "src", "generated", "data.json"), `${JSON.stringify(site, null, 2)}\n`);
  console.log(`[data] ${site.games.length} games, ${site.gms.length} Game Masters, ${covers.size} covers, ${photos.size} photos${API || process.env.TPK_DATA_FILE ? "" : " (demo data)"}`);
}

main().catch((err) => {
  console.error(`[data] FAILED: ${err.message}`);
  process.exit(1);
});
