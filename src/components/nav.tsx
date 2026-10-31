"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { paths, switchLang } from "@/lib/hrefs";
import { LANGS, type Lang } from "@/lib/types";
import { useI18n } from "./i18n-provider";

type Item = { href: (l: Lang) => string; prefix: string; label: "nav.games" | "nav.gms" | "nav.how" | "nav.list" };
const ITEMS: Item[] = [
  { href: (l) => paths.games(l), prefix: "games", label: "nav.games" },
  { href: (l) => paths.gms(l), prefix: "gm", label: "nav.gms" },
  { href: (l) => paths.how(l), prefix: "how-it-works", label: "nav.how" },
  { href: (l) => paths.list(l), prefix: "list-your-game", label: "nav.list" },
];

const isCurrent = (pathname: string, lang: Lang, prefix: string) => {
  const rest = pathname.replace(new RegExp(`^/${lang}/?`), "");
  return rest === prefix || rest.startsWith(`${prefix}/`) || (prefix === "gm" && rest.startsWith("gms"));
};

/** The page links with their full names, the current page marked: a ruled row under the masthead from 1024px, text tabs below. */
export function NavLinks({ variant }: { variant: "header" | "tabs" }) {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  if (variant === "tabs") {
    return (
      <ul className="flex">
        {ITEMS.map((i) => {
          const current = isCurrent(pathname, lang, i.prefix);
          return (
            <li key={i.prefix} className="min-w-0 flex-1">
              {/* Labels may wrap to two lines: a row that scrolls sideways hid the last tab ("List your game") on a 390px phone. */}
              <Link href={i.href(lang)} aria-current={current ? "page" : undefined} className={`flex min-h-14 items-center justify-center px-1.5 text-center text-sm leading-tight ${current ? "font-bold text-ink underline decoration-accent decoration-[3px] underline-offset-[0.4em]" : "text-muted"}`}>
                {t(i.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div className="flex items-center gap-[var(--space-md)] xl:gap-[var(--space-xl)]">
      {ITEMS.map((i, n) => {
        const current = isCurrent(pathname, lang, i.prefix);
        const action = n === ITEMS.length - 1;
        return (
          <Link key={i.prefix} href={i.href(lang)} aria-current={current ? "page" : undefined} className={`inline-flex min-h-12 items-center rounded-[var(--radius-input)] border-b-2 border-transparent bg-clip-padding px-3 ${action ? "-mr-3 ml-auto font-bold" : "-mx-3"} ${current || action ? "bg-accent-soft hover:bg-[color-mix(in_oklab,var(--color-accent)_24%,var(--color-paper))]" : "hover:bg-paper-3"}`}>
            {t(i.label)}
          </Link>
        );
      })}
    </div>
  );
}

/** en / id toggle. It keeps the page and its filters: the query string is added when the link is followed. */
export function LanguageSwitcher() {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  return (
    <nav aria-label={t("lang.switch")} className="flex items-center gap-[var(--space-xs)] text-sm font-bold">
      {LANGS.map((l) => (
        <a
          key={l}
          href={switchLang(pathname, l)}
          hrefLang={l}
          lang={l}
          aria-current={lang === l ? "true" : undefined}
          title={t(l === "en" ? "lang.name.en" : "lang.name.id")}
          onClick={(e) => { e.currentTarget.href = switchLang(pathname, l) + window.location.search + window.location.hash; }}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-input)] px-2 uppercase ${lang === l ? "bg-ink text-paper" : "border border-ink text-ink hover:bg-paper-3"}`}
        >
          {l}
        </a>
      ))}
    </nav>
  );
}
