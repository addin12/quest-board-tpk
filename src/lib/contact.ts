// How a player reaches a GM. WhatsApp is required for every GM, Discord is optional. The phone number is in neither the page nor the public data (ADR-48):
// a tap asks the server for the number of that one Game Master (POST /api/contact, rate-limited per visitor), and the chat opens with it. A scraper
// therefore cannot read numbers off the site; it would have to tap, a few at a time. Discord and Instagram names are public by design.
import { formatWhen } from "./format.ts";
import type { Lang, SiteGame, SiteGm } from "./types.ts";

export type ContactAnswer = { ok: true; whatsapp: string } | { ok: false; reason: "busy" | "failed" };

/** Asks the server for a live Game Master's number. "busy" means this connection has asked for too many; "failed" is anything else. */
export async function askContact(gmId: string, fetcher: typeof fetch = fetch): Promise<ContactAnswer> {
  try {
    const res = await fetcher("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gm: gmId }) });
    if (res.status === 429) return { ok: false, reason: "busy" };
    const answer = (await res.json().catch(() => ({}))) as { whatsapp?: unknown };
    return res.ok && typeof answer.whatsapp === "string" && /^[1-9]\d{7,14}$/.test(answer.whatsapp) ? { ok: true, whatsapp: answer.whatsapp } : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/**
 * Opens the chat. Browser only, called from a tap: the tab is opened first, inside the tap (a phone's pop-up blocker only allows that), and pointed at the
 * chat when the number arrives; if the number cannot be had the tab is closed again.
 */
export async function openWhatsApp(gmId: string, message: string): Promise<ContactAnswer> {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null; // the chat is another site: it gets no handle on this one
  const answer = await askContact(gmId);
  if (!answer.ok) { tab?.close(); return answer; }
  const link = waLink(answer.whatsapp, message);
  if (tab) tab.location.href = link;
  else window.location.assign(link); // pop-ups are blocked: leave in this tab instead
  return answer;
}

/** The wa.me link that opens a chat with the message ready to send. `number` is digits with the country code. */
export function waLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** The language of the first message: the game's own language, or the page's when the game uses both. */
export function messageLang(game: Pick<SiteGame, "language"> | null, pageLang: Lang): Lang {
  if (!game) return pageLang;
  return game.language === "both" ? pageLang : game.language;
}

const MESSAGES = {
  en: { game: "Hi {gm}, I found “{title}” on Quest Board ({when}). Is there still a seat?", gm: "Hi {gm}, I found your profile on Quest Board." },
  id: { game: "Halo {gm}, aku menemukan “{title}” di Quest Board ({when}). Apakah masih ada kursi?", gm: "Halo {gm}, aku menemukan profilmu di Quest Board." },
} as const;
const fill = (template: string, vars: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");

/** "Hi Raka, I found “Mercusuar” on Quest Board (Sun 12 Oct, 19.00 WIB). Is there still a seat?" */
export function contactMessage(gm: Pick<SiteGm, "name">, game: SiteGame | null, pageLang: Lang): string {
  const lang = messageLang(game, pageLang);
  if (!game) return fill(MESSAGES[lang].gm, { gm: gm.name });
  return fill(MESSAGES[lang].game, { gm: gm.name, title: game.title, when: formatWhen(game.startsAt, lang, game.zone) });
}
