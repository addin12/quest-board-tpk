// Small helpers: random ids and tokens, hashing, text cleaning, rate limits. Web Crypto only (runs on Workers and Node).
import { exec, one, type Db } from "./db.ts";
import { text } from "../../src/lib/public-data.ts";

export const DAY_MS = 86_400_000;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A random lower-case id of `n` characters (no look-alike removal needed: ids are never typed). */
export function randomId(n = 9): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** A secret token for a link or a cookie: 32 random bytes, URL-safe. */
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison for secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const clip = (v: unknown, max: number, multiline = false): string => text(v, max, multiline);

/** "Mercusuar di Pulau Kabut" becomes "mercusuar-di-pulau-kabut", at most 50 characters. */
export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return s || "x";
}

export const iso = (ms: number): string => new Date(ms).toISOString();

export const parseList = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/**
 * A sliding-window limit: true if `key` has done fewer than `max` things in the last `windowMs`, and records this one.
 * Counted in D1, so it holds across Worker instances.
 */
export async function allow(db: Db, key: string, max: number, windowMs: number, nowMs: number): Promise<boolean> {
  await exec(db, "DELETE FROM rate_events WHERE key = ? AND at < ?", key, nowMs - windowMs);
  const row = await one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM rate_events WHERE key = ?", key);
  if ((row?.n ?? 0) >= max) return false;
  await exec(db, "INSERT INTO rate_events (key, at) VALUES (?, ?)", key, nowMs);
  return true;
}

/** Drops counters older than a day; called from the daily job. */
export const pruneRateEvents = (db: Db, nowMs: number): Promise<number> => exec(db, "DELETE FROM rate_events WHERE at < ?", nowMs - DAY_MS);

export async function logEvent(db: Db, nowMs: number, kind: string, subjectKind: string, subjectId: string, title: string, detail: string, actor: string): Promise<void> {
  await exec(db, "INSERT INTO activity (at, kind, subject_kind, subject_id, title, detail, actor) VALUES (?, ?, ?, ?, ?, ?, ?)", iso(nowMs), kind, subjectKind, subjectId, clip(title, 200), clip(detail, 500), clip(actor, 200));
}

export const metaGet = async (db: Db, key: string): Promise<string> => (await one<{ value: string }>(db, "SELECT value FROM meta WHERE key = ?", key))?.value ?? "";
export const metaSet = (db: Db, key: string, value: string): Promise<number> => exec(db, "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
