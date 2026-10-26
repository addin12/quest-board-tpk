// The dictionary's types and the translator, without any strings, so client code can import them cheaply.
// Pure module: only `import type` plus the language constants.
import type { en } from "./en.ts";

export { DEFAULT_LANG, LANGS, isLang } from "../types.ts";
export type { Lang } from "../types.ts";

export type MsgKey = keyof typeof en;
export type Messages = Record<MsgKey, string>;
export type T = (key: MsgKey, vars?: Record<string, string | number>) => string;

/** A translator over one language's strings (and an optional fallback). "a|b" strings pick a (n === 1) or b. */
export function translator(dict: Partial<Messages>, fallback?: Partial<Messages>): T {
  return (key, vars) => {
    let s: string = dict[key] ?? fallback?.[key] ?? key;
    if (s.includes("|")) {
      const [one, other] = s.split("|");
      s = vars?.n === 1 ? one : other;
    }
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
  };
}
