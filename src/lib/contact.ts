// How a player reaches a GM. WhatsApp is required for every GM, Discord is optional. The number is not written
// plainly into the page: it travels reversed and base64-encoded in a data attribute and is put together when
// the player taps the button. That only stops simple scrapers; anyone who taps the button can see the number.
// Pure module (btoa and atob exist in browsers and Node).
import { makeT } from "./i18n/dict.ts";
import { formatWhen } from "./format.ts";
import type { Lang, SiteGame, SiteGm } from "./types.ts";

/** @example decodeContact(encodeContact("6281234567890")) // "6281234567890" */
export const encodeContact = (value: string): string => btoa([...value].reverse().join(""));
export const decodeContact = (encoded: string): string => [...atob(encoded)].reverse().join("");

/** The wa.me link that opens a chat with the message ready to send. `number` is digits with the country code. */
export function waLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** The language of the first message: the game's own language, or the page's when the game uses both. */
export function messageLang(game: Pick<SiteGame, "language"> | null, pageLang: Lang): Lang {
  if (!game) return pageLang;
  return game.language === "both" ? pageLang : game.language;
}

/** "Hi Raka, I found “Mercusuar” on Quest Board TPK (Sun 12 Oct, 19.00 WIB). Is there still a seat?" */
export function contactMessage(gm: Pick<SiteGm, "name">, game: SiteGame | null, pageLang: Lang): string {
  const lang = messageLang(game, pageLang);
  const t = makeT(lang);
  if (!game) return t(lang === "id" ? "contact.msgGmId" : "contact.msgGmEn", { gm: gm.name });
  return t(lang === "id" ? "contact.msgId" : "contact.msgEn", { gm: gm.name, title: game.title, when: formatWhen(game.startsAt, lang, game.zone) });
}
