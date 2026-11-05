// Small pure formatters shared by pages, the admin page and tests.
//
// Dates and money are written by hand, not with Intl: the same text must come out of the Node that builds the site and of every browser that hydrates the page
// (a page that was built with "Mon 12 Oct" and hydrated in a browser whose ICU says "Mon, 12 Oct" fails React's hydration check). Indonesia's three zones have
// no daylight saving, so a zone is a fixed offset, and the names of days and months are in these tables.
import type { Lang, Zone } from "./types.ts";

/**
 * "Rp 75.000". Rupiah has no minor unit, so amounts are whole integers.
 * @example formatIdr(75000) // "Rp 75.000"
 */
export function formatIdr(amount: number): string {
  const whole = Math.round(Math.abs(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${amount < 0 ? "-" : ""}Rp ${whole}`;
}

/**
 * A stored WhatsApp number (country code and digits, no plus) the way its owner writes it: an Indonesian one as "0813-5555-0009", any other with its plus.
 * @example formatPhone("6281355550009") // "0813-5555-0009"
 */
export function formatPhone(digits: string): string {
  if (!/^\d+$/.test(digits)) return digits;
  if (!digits.startsWith("62")) return `+${digits}`;
  const local = `0${digits.slice(2)}`;
  return [local.slice(0, 4), local.slice(4, 8), local.slice(8)].filter(Boolean).join("-");
}

/** Up to two initials for an avatar. @example initialsOf("Raka Pratama") // "RP" */
export function initialsOf(name: string): string {
  return name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}

const OFFSET_HOURS: Record<Zone, number> = { WIB: 7, WITA: 8, WIT: 9 };
const WEEKDAYS: Record<Lang, readonly string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  id: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
};
const MONTHS_SHORT: Record<Lang, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
};
const MONTHS_LONG: Record<Lang, readonly string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
};

/** The wall clock in `zone` at `iso`. Throws a RangeError for a date that is not one, as Intl did. */
function wall(iso: string, zone: Zone) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new RangeError("Invalid time value");
  const d = new Date(t + OFFSET_HOURS[zone] * 3_600_000); // read with getUTC*: it is the wall clock of the zone
  return { weekday: d.getUTCDay(), day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}
const two = (n: number) => String(n).padStart(2, "0");

/**
 * A session time in the zone its GM named: "Sat 12 Oct, 19.00 WIB".
 * @example formatWhen("2026-10-12T12:00:00.000Z", "id", "WIB") // "Min, 12 Okt, 19.00 WIB"
 */
export function formatWhen(iso: string, lang: Lang, zone: Zone): string {
  const w = wall(iso, zone);
  const day = `${WEEKDAYS[lang][w.weekday]}${lang === "id" ? "," : ""} ${w.day} ${MONTHS_SHORT[lang][w.month]}`;
  return `${day}, ${two(w.hour)}.${two(w.minute)} ${zone}`;
}

/** "12 October 2026", in the zone given. */
export function formatDay(iso: string, lang: Lang, zone: Zone): string {
  const w = wall(iso, zone);
  return `${w.day} ${MONTHS_LONG[lang][w.month]} ${w.year}`;
}

/** "12 Oct", for compact lists. */
export function formatShortDay(iso: string, lang: Lang, zone: Zone): string {
  const w = wall(iso, zone);
  return `${w.day} ${MONTHS_SHORT[lang][w.month]}`;
}
