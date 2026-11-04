"use client";

import { usePathname } from "next/navigation";
import { paths } from "@/lib/hrefs";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

// The first part of the address of a page with no search of its own: a Game Master's page and the genres, play styles and mechanics lists. (The home page, the games list, and the lists of Game Masters and of game systems have one in the page.)
const BROWSING = ["gm", "genres", "styles", "mechanics"];

/**
 * On a phone the browse pages keep a search field under the masthead: type, and the games list opens with the words filled in
 * (the same address the home page's search uses). From 1024 px up the header has the room for links instead, so it is not drawn.
 */
export function HeaderSearch() {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  if (!BROWSING.includes(pathname.split("/")[2] ?? "")) return null; // /en/styles/ -> "styles"
  return (
    <div className="wrap pb-3 lg:hidden">
      <form action={paths.games(lang)} method="get" role="search" className="relative">
        <label htmlFor="header-q" className="sr-only">{t("games.search")}</label>
        <input id="header-q" name="q" type="search" className="input pl-11" placeholder={t("games.searchPlaceholder")} maxLength={80} />
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[1.25rem] text-muted" />
      </form>
    </div>
  );
}
