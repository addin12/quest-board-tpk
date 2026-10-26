"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { paths, switchLang } from "@/lib/hrefs";
import { LANGS, type Lang } from "@/lib/types";
import type { RegularIcon } from "@/lib/icons";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

type Item = { href: (l: Lang) => string; prefix: string; icon: RegularIcon; label: "nav.games" | "nav.gms" | "nav.how" | "nav.list" };
const ITEMS: Item[] = [
  { href: (l) => paths.games(l), prefix: "games", icon: "search", label: "nav.games" },
  { href: (l) => paths.gms(l), prefix: "gm", icon: "hat-wizard", label: "nav.gms" },
  { href: (l) => paths.how(l), prefix: "how-it-works", icon: "book-open-cover", label: "nav.how" },
  { href: (l) => paths.list(l), prefix: "list-your-game", icon: "megaphone", label: "nav.list" },
];

const isCurrent = (pathname: string, lang: Lang, prefix: string) => {
  const rest = pathname.replace(new RegExp(`^/${lang}/?`), "");
  return rest === prefix || rest.startsWith(`${prefix}/`) || (prefix === "gm" && rest.startsWith("gms"));
};

/** The page links with their full names, the current page marked: in the header from 1024px, as a tab bar below. */
export function NavLinks({ variant }: { variant: "header" | "tabs" }) {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  if (variant === "tabs") {
    return (
      <ul className="flex">
        {ITEMS.map((i) => {
          const current = isCurrent(pathname, lang, i.prefix);
          return (
            <li key={i.prefix} className="flex-1">
              <Link href={i.href(lang)} aria-current={current ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold ${current ? "text-accent" : "text-muted"}`}>
                <Icon name={i.icon} className="text-lg" />
                {t(i.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div className="hidden items-center gap-0.5 lg:flex">
      {ITEMS.map((i) => {
        const current = isCurrent(pathname, lang, i.prefix);
        return (
          <Link key={i.prefix} href={i.href(lang)} aria-current={current ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${current ? "text-accent underline decoration-2 underline-offset-8" : "text-muted hover:text-text"}`}>
            <Icon name={i.icon} /> {t(i.label)}
          </Link>
        );
      })}
    </div>
  );
}

/** EN / ID toggle. It keeps the page and its filters: the query string is added when the link is followed. */
export function LanguageSwitcher() {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  return (
    <nav aria-label={t("lang.switch")} className="flex items-center rounded-lg border border-border bg-black/20 p-0.5 text-sm font-bold">
      <Icon name="globe" className="hidden px-1.5 text-muted sm:inline-flex" />
      {LANGS.map((l) => (
        <a
          key={l}
          href={switchLang(pathname, l)}
          hrefLang={l}
          lang={l}
          aria-current={lang === l ? "true" : undefined}
          title={t(l === "en" ? "lang.name.en" : "lang.name.id")}
          onClick={(e) => { e.currentTarget.href = switchLang(pathname, l) + window.location.search + window.location.hash; }}
          className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-md px-2 uppercase ${lang === l ? "bg-accent text-accent-ink" : "text-muted hover:text-text"}`}
        >
          {l}
        </a>
      ))}
    </nav>
  );
}
