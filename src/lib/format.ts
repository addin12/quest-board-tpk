// Small pure formatters shared by pages, the admin page and tests.
import { ZONE_TZ, type Lang, type Zone } from "./types.ts";

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

/**
 * "Rp 75.000". Rupiah has no minor unit, so amounts are whole integers.
 * @example formatIdr(75000) // "Rp 75.000"
 */
export function formatIdr(amount: number): string {
  return idr.format(amount).replace(/ /g, " ");
}

/** Up to two initials for an avatar. @example initialsOf("Raka Pratama") // "RP" */
export function initialsOf(name: string): string {
  return name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}

const locale = (lang: Lang) => (lang === "id" ? "id-ID" : "en-GB");

/**
 * A session time in the zone its GM named: "Sat 12 Oct, 19.00 WIB".
 * @example formatWhen("2026-10-12T12:00:00.000Z", "id", "WIB") // "Min, 12 Okt, 19.00 WIB"
 */
export function formatWhen(iso: string, lang: Lang, zone: Zone): string {
  const s = new Intl.DateTimeFormat(locale(lang), {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONE_TZ[zone],
  }).format(new Date(iso));
  return `${s.replace(/(\d{2}):(\d{2})/, "$1.$2")} ${zone}`;
}

/** "12 October 2026", in the zone given. */
export function formatDay(iso: string, lang: Lang, zone: Zone): string {
  return new Date(iso).toLocaleDateString(locale(lang), { day: "numeric", month: "long", year: "numeric", timeZone: ZONE_TZ[zone] });
}

/** "12 Oct", for compact lists. */
export function formatShortDay(iso: string, lang: Lang, zone: Zone): string {
  return new Date(iso).toLocaleDateString(locale(lang), { day: "numeric", month: "short", timeZone: ZONE_TZ[zone] });
}
