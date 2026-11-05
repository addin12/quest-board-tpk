// Pictures: a GM's photo and a game's cover. The browser shrinks them first; the backend still checks what it is sent.
import type { Bucket } from "./db.ts";
import type { Ctx } from "./auth.ts";
import { many } from "./db.ts";
import { DAY_MS, logEvent, randomId } from "./util.ts";

export type ImageKind = "cover" | "photo";

/** Largest accepted file, in bytes, per kind (after the browser has shrunk it). */
export const MAX_BYTES: Record<ImageKind, number> = { cover: 1_500_000, photo: 600_000 };

/** The image type from the first bytes of the file, or "" if it is not a WebP, JPEG or PNG. The Content-Type header is not trusted. */
export function sniff(bytes: Uint8Array): "webp" | "jpg" | "png" | "" {
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  return "";
}

const TYPE = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" } as const;

export async function storeImage(bucket: Bucket, kind: ImageKind, data: ArrayBuffer): Promise<{ ok: true; key: string } | { ok: false; error: "too_large" | "not_an_image" }> {
  if (data.byteLength > MAX_BYTES[kind]) return { ok: false, error: "too_large" };
  const type = sniff(new Uint8Array(data));
  if (!type) return { ok: false, error: "not_an_image" };
  const key = `${kind === "cover" ? "covers" : "photos"}/${randomId(16)}.${type}`;
  await bucket.put(key, data, { httpMetadata: { contentType: TYPE[type] } });
  return { ok: true, key };
}

export const contentTypeOf = (key: string): string => TYPE[key.split(".").pop() as keyof typeof TYPE] ?? "application/octet-stream";

/** An upload waits this long for its row to be saved before the sweep may treat it as abandoned. */
const GRACE_MS = 2 * DAY_MS;
/** Files deleted per run, so one sweep stays short. */
const SWEEP_MAX = 200;

/**
 * Deletes pictures no profile or game refers to (replaced ones the immediate delete missed, uploads never attached to anything),
 * once they are older than the grace period. Called from the daily job. Lists the first page of the bucket only, which is enough for
 * a board of this size; the rest is picked up as earlier files go.
 */
export async function sweepOrphanImages(ctx: Ctx, bucket: Bucket): Promise<number> {
  // A picture is in use as the approved one or as the one of a waiting draft (the draft is JSON: its key is read out of it, not guessed with LIKE).
  const draftKeys = async (table: "profiles" | "games", col: "photo_key" | "cover_key") =>
    (await many<{ draft: string }>(ctx.db, `SELECT draft FROM ${table} WHERE draft != ''`)).map((r) => {
      try {
        const k = (JSON.parse(r.draft) as Record<string, unknown>)[col];
        return typeof k === "string" ? k : "";
      } catch {
        return "";
      }
    });
  const used = new Set([
    ...(await many<{ k: string }>(ctx.db, "SELECT photo_key AS k FROM profiles WHERE photo_key != ''")).map((r) => r.k),
    ...(await many<{ k: string }>(ctx.db, "SELECT cover_key AS k FROM games WHERE cover_key != ''")).map((r) => r.k),
    ...(await draftKeys("profiles", "photo_key")),
    ...(await draftKeys("games", "cover_key")),
  ]);
  let removed = 0;
  for (const prefix of ["covers/", "photos/"]) {
    for (const o of (await bucket.list({ prefix })).objects) {
      if (removed >= SWEEP_MAX) return removed;
      const age = o.uploaded ? ctx.now() - o.uploaded.getTime() : 0; // an unknown age counts as new: never delete what cannot be dated
      if (used.has(o.key) || age < GRACE_MS) continue;
      await bucket.delete(o.key);
      removed++;
    }
  }
  if (removed) await logEvent(ctx.db, ctx.now(), "swept", "job", "", "", `${removed} unused picture file(s) deleted`, "the daily job");
  return removed;
}
