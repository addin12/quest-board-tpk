// Makes the small copy of each system and genre picture that the tiles load: 360 x 450 (the tiles are about 200 px wide, so this is still sharp on a
// 1.8x screen) instead of the 480 x 600 file, which is kept for the larger views. Run after adding or changing a picture: `npm run tiles`.
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(import.meta.dirname, "..", "public", "images");
let before = 0;
let after = 0;
let made = 0;
for (const dir of ["systems", "genres"]) {
  const folder = path.join(ROOT, dir);
  for (const file of readdirSync(folder)) {
    if (!file.endsWith(".webp") || file.endsWith("-sm.webp")) continue;
    const source = path.join(folder, file);
    const target = path.join(folder, file.replace(/\.webp$/, "-sm.webp"));
    await sharp(source).resize(360, 450, { fit: "cover", kernel: "lanczos3" }).webp({ quality: 80 }).toFile(target);
    before += statSync(source).size;
    after += statSync(target).size;
    made++;
  }
}
console.log(`[tiles] ${made} small pictures: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB (${Math.round((1 - after / before) * 100)}% less)`);
