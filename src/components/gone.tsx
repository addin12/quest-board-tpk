import { makeT } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/types";
import { GoneNotice } from "./gone-notice";

/** The page at the address of a listing that was live and is not now: a notice only, no details and no way to contact. */
export function Gone({ kind, lang }: { kind: "game" | "gm"; lang: Lang }) {
  return <GoneNotice kind={kind} lang={lang} t={makeT(lang)} />;
}

/** Metadata of that page: it says nothing about the listing and stays out of search results. */
export function goneMetadata(kind: "game" | "gm", lang: Lang) {
  return { title: makeT(lang)(kind === "game" ? "gone.gameTitle" : "gone.gmTitle"), robots: { index: false, follow: false } };
}
