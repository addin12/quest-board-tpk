"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { translator, type Lang, type Messages, type T } from "@/lib/i18n/core";

// Client components get their language's strings as a prop from the server layout (no dynamic import: an
// iPhone loses taps while a lazy chunk loads, a lesson from v1).
const Ctx = createContext<{ lang: Lang; t: T } | null>(null);

export function I18nProvider({ lang, messages, children }: { lang: Lang; messages: Partial<Messages>; children: ReactNode }) {
  const value = useMemo(() => ({ lang, t: translator(messages) }), [lang, messages]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): { lang: Lang; t: T } {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n needs an I18nProvider above it");
  return v;
}
