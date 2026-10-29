// The site's connection to its own backend (/api/*, same address, so the sign-in cookie goes along). Client-side only.
import type { GameRecord, GmRecord } from "./types.ts";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; fields?: Record<string, string>; message?: string };

/** One call. Never throws: a lost connection is `{ ok: false, error: "network" }`. */
export async function call<T = Record<string, unknown>>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
  let json: ({ ok?: boolean; error?: string; fields?: Record<string, string>; message?: string } & Record<string, unknown>) | null = null;
  try {
    json = await res.json();
  } catch {
    // an error page or an empty answer
  }
  if (res.ok && json?.ok !== false) return { ok: true, data: (json ?? {}) as T };
  return { ok: false, status: res.status, error: json?.error ?? (res.status >= 500 ? "server" : "invalid"), fields: json?.fields, message: json?.message };
}

export type Me = { ok: true; email: string; profile: GmRecord | null; games: GameRecord[]; admin: boolean };

/** The picture sizes: a cover is 4:5 (as on the cards), a photo is a square. */
const SIZES = { cover: { w: 1080, h: 1350, type: "image/webp", q: 0.82 }, photo: { w: 400, h: 400, type: "image/webp", q: 0.85 } } as const;

/**
 * Shrinks a picked picture in the browser (cropped to the shape it is shown in, so the upload stays small): WebP where the browser
 * can write it, JPEG otherwise. Throws if the file cannot be read as a picture.
 */
export async function shrinkImage(file: File, kind: "cover" | "photo"): Promise<Blob> {
  const { w, h, type, q } = SIZES[kind];
  const bitmap = await createImageBitmap(file);
  const ratio = w / h;
  let cropW = bitmap.width;
  let cropH = cropW / ratio;
  if (cropH > bitmap.height) { cropH = bitmap.height; cropW = cropH * ratio; }
  const outW = Math.min(w, Math.round(cropW));
  const outH = Math.round(outW / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - cropW) / 2, (bitmap.height - cropH) / 2, cropW, cropH, 0, 0, outW, outH);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  if (blob && blob.type === type) return blob;
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!jpeg) throw new Error("no_blob");
  return jpeg;
}

export async function uploadImage(blob: Blob, kind: "cover" | "photo"): Promise<ApiResult<{ key: string }>> {
  let res: Response;
  try {
    res = await fetch(`/api/images?kind=${kind}`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
  const json = (await res.json().catch(() => null)) as { ok?: boolean; key?: string; error?: string } | null;
  return res.ok && json?.key ? { ok: true, data: { key: json.key } } : { ok: false, status: res.status, error: json?.error ?? "server" };
}

/** "2026-11-08T12:00:00.000Z" in WIB as { date: "2026-11-08", time: "19:00" }: what the form's date and time fields hold. */
export function zonedParts(isoUtc: string, zone: "WIB" | "WITA" | "WIT"): { date: string; time: string } {
  const offset = { WIB: 7, WITA: 8, WIT: 9 }[zone];
  const local = new Date(Date.parse(isoUtc) + offset * 3_600_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}
