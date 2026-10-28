// Pictures: a GM's photo and a game's cover. The browser shrinks them first; the backend still checks what it is sent.
import type { Bucket } from "./db.ts";
import { randomId } from "./util.ts";

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
