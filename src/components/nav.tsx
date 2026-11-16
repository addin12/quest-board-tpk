"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { paths, switchLang } from "@/lib/hrefs";
import { useSignedIn } from "@/lib/signed-in";
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
  const who = useSignedIn();
  // The note holds the Game Master's display name, or their address before they have a profile (an address is too long and too private for a button).
  const label = who && !who.includes("@") ? who : t("acct.title");
  if (variant === "tabs") {
    return (
      <ul className="flex">
        {ITEMS.map((i, n) => {
          const current = isCurrent(pathname, lang, i.prefix);
          const action = n === ITEMS.length - 1; // List your game: the one action of the bar, on the accent colour like its button in the header
          const toAccount = action && who !== null; // signed in: the same place leads to the account, under the Game Master's name
          return (
            <li key={i.prefix} className="flex min-w-0 flex-1">
              {/* Labels may wrap to two lines: a row that scrolls sideways hid the last tab ("List your game") on a 390px phone. */}
              <Link href={toAccount ? paths.account(lang) : i.href(lang)} aria-current={current || (toAccount && isCurrent(pathname, lang, "account")) ? "page" : undefined} className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center text-sm leading-tight ${action ? "m-1.5 rounded-[var(--radius-input)] bg-accent font-medium text-accent-ink" : `min-h-[calc(var(--tabbar-h)-3px)] ${current ? "font-medium text-ink" : "text-muted"}`}`}>
                <Icon name={toAccount ? "account" : i.icon} className="text-[1.375rem]" />
                <span className={`min-w-0 max-w-full break-words ${toAccount ? "line-clamp-2" : ""} ${current && !action ? "underline decoration-accent decoration-[3px] underline-offset-[0.3em]" : ""}`}>{toAccount ? label : t(i.label)}</span>
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
        // Someone signed in does not need to be invited to list a game: their one button leads to their account, where the games are.
        const toAccount = action && who !== null;
        return (
          <Link key={i.prefix} data-testid={toAccount ? "nav-account" : undefined} href={toAccount ? paths.account(lang) : i.href(lang)} aria-current={current ? "page" : undefined} className={`inline-flex items-center rounded-[var(--radius-input)] ${action ? "ml-auto min-h-11 bg-accent px-4 font-medium text-accent-ink hover:bg-accent-deep" : `-mx-3 min-h-12 border-b-2 border-transparent bg-clip-padding px-3 ${current ? "bg-accent-soft hover:bg-[color-mix(in_oklab,var(--color-accent)_24%,var(--color-paper))]" : "hover:bg-paper-3"}`}`}>
            {toAccount ? (
              <>
                <Icon name="account" className="mr-2 shrink-0 text-[1.375rem]" />
                <span className="max-w-[12rem] truncate">{label}</span>
              </>
            ) : t(i.label)}
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
