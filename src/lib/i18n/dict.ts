// Both languages, for server components, the build and node --test. `id` must have exactly the keys of `en`
// (typecheck enforces it). User-written content (titles, descriptions) is never translated.
import { en } from "./en.ts";
import { id } from "./id.ts";
import { DEFAULT_LANG, translator, type Lang, type Messages, type T } from "./core.ts";

export { DEFAULT_LANG, LANGS, isLang, translator } from "./core.ts";
export type { Lang, Messages, MsgKey, T } from "./core.ts";

export const DICTIONARIES: Record<Lang, Messages> = { en, id };

/** A translator for a language (a missing string falls back to English). */
export function makeT(lang: Lang): T {
  return translator(DICTIONARIES[lang] ?? DICTIONARIES[DEFAULT_LANG], DICTIONARIES.en);
}

/** The strings a public page's client components need: everything except the admin page's. */
export function publicMessages(lang: Lang): Partial<Messages> {
  const dict = DICTIONARIES[lang] ?? DICTIONARIES[DEFAULT_LANG];
  return Object.fromEntries(Object.entries(dict).filter(([k]) => !k.startsWith("admin.") && !k.startsWith("check."))) as Partial<Messages>;
}

/** The admin page's strings (it also uses the public ones). */
export function adminMessages(lang: Lang): Partial<Messages> {
  return DICTIONARIES[lang] ?? DICTIONARIES[DEFAULT_LANG];
}
