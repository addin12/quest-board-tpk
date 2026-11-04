"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { paths, switchLang } from "@/lib/hrefs";
import { LANGS, type Lang } from "@/lib/types";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";
import type { IconName } from "@/lib/icons";

type Item = { href: (l: Lang) => string; prefix: string; label: "nav.games" | "nav.gms" | "nav.how" | "nav.list"; icon: IconName };
const ITEMS: Item[] = [
  { href: (l) => paths.games(l), prefix: "games", label: "nav.games", icon: "games" },
  { href: (l) => paths.gms(l), prefix: "gm", label: "nav.gms", icon: "game-masters" },
  { href: (l) => paths.how(l), prefix: "how-it-works", label: "nav.how", icon: "info" },
  { href: (l) => paths.list(l), prefix: "list-your-game", label: "nav.list", icon: "list-game" },
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
        {ITEMS.map((i, n) => {
          const current = isCurrent(pathname, lang, i.prefix);
          const action = n === ITEMS.length - 1; // List your game: the one action of the bar, on the accent colour like its button in the header
          return (
            <li key={i.prefix} className="flex min-w-0 flex-1">
              {/* Labels may wrap to two lines: a row that scrolls sideways hid the last tab ("List your game") on a 390px phone. */}
              <Link href={i.href(lang)} aria-current={current ? "page" : undefined} className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center text-sm leading-tight ${action ? "m-1.5 rounded-[var(--radius-input)] bg-accent font-medium text-accent-ink" : `min-h-[calc(var(--tabbar-h)-3px)] ${current ? "font-medium text-ink" : "text-muted"}`}`}>
                <Icon name={i.icon} className="text-[1.375rem]" />
                <span className={current && !action ? "underline decoration-accent decoration-[3px] underline-offset-[0.3em]" : undefined}>{t(i.label)}</span>
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
          <Link key={i.prefix} href={i.href(lang)} aria-current={current ? "page" : undefined} className={`inline-flex items-center rounded-[var(--radius-input)] ${action ? "ml-auto min-h-11 bg-accent px-4 font-medium text-accent-ink hover:bg-accent-deep" : `-mx-3 min-h-12 border-b-2 border-transparent bg-clip-padding px-3 ${current ? "bg-accent-soft hover:bg-[color-mix(in_oklab,var(--color-accent)_24%,var(--color-paper))]" : "hover:bg-paper-3"}`}`}>
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
    <nav aria-label={t("lang.switch")} className="flex items-center gap-[var(--space-xs)] text-sm font-medium">
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
