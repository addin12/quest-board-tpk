import Link from "next/link";
import { EMPTY_FILTERS, filtersToQuery } from "@/lib/games";
import { paths } from "@/lib/hrefs";
import type { T } from "@/lib/i18n/core";
import type { LandingPage } from "@/lib/landing";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import type { Lang } from "@/lib/types";
import { JsonLd } from "./json-ld";
import { GameCard } from "./ui";

export type LandingKind = "system" | "area";

/** The address of a landing page's sibling of the same kind. */
export const landingPath = (kind: LandingKind, lang: Lang, slug: string): string => (kind === "system" ? paths.system(lang, slug) : paths.area(lang, slug));

/**
 * The page for one system or one area: what it is, the games listed for it, a way on to every game with the filters, and links to the other pages of
 * its kind (so a visitor, and a search engine, can walk from one to the next). A server component: written when the site is built.
 */
export function Landing({ kind, page, others, lang, t }: { kind: LandingKind; page: LandingPage; others: LandingPage[]; lang: Lang; t: T }) {
  const { name, games } = page;
  const heading = t(kind === "system" ? "land.system.title" : "land.area.title", { name });
  const back = kind === "system" ? { href: paths.systems(lang), label: t("systems.title") } : { href: paths.games(lang), label: t("games.title") };
  const more = kind === "system" ? paths.games(lang, filtersToQuery({ ...EMPTY_FILTERS, system: name })) : paths.games(lang);
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-lg)]">
      <JsonLd data={[
        collectionJsonLd(heading, lang, games),
        breadcrumbJsonLd([
          { name: "Quest Board", url: `${SITE_URL}${paths.home(lang)}` },
          { name: back.label, url: `${SITE_URL}${back.href}` },
          { name: heading, url: `${SITE_URL}${landingPath(kind, lang, page.slug)}` },
        ]),
      ]} />
      <Link href={back.href} className="link-spot inline-flex min-h-11 items-center font-medium">{back.label}</Link>
      <h1 className="mt-[var(--space-md)] max-w-none text-[length:var(--text-display-s)]">{heading}</h1>
      <p className="lead mt-[var(--space-sm)] max-w-[60ch] text-ink-2">{t(kind === "system" ? "land.system.lead" : "land.area.lead", { name })}</p>
      <p className="mt-[var(--space-xs)] text-sm text-muted" data-testid="landing-count">{t("games.count", { n: games.length })}</p>
      <ul className="mt-[var(--space-lg)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] max-sm:gap-y-[var(--space-sm)] sm:grid-cols-2 lg:grid-cols-3" data-testid="landing-games">
        {games.map((g, i) => <li key={g.id}><GameCard game={g} t={t} lang={lang} priority={i < 3} headingLevel={2} rowOnPhone /></li>)}
      </ul>
      <p className="mt-[var(--space-xl)]"><Link href={more} className="btn btn-soft">{t("land.allGames")}</Link></p>
      {others.length > 0 && (
        <section aria-labelledby="land-others-h" className="mt-[var(--space-2xl)] border-t border-rule pt-[var(--space-xl)]">
          <h2 id="land-others-h" className="max-w-none text-[length:var(--text-xl)]">{t(kind === "system" ? "land.otherSystems" : "land.otherAreas")}</h2>
          <ul className="mt-[var(--space-sm)] flex flex-wrap gap-x-[var(--space-lg)]" data-testid="landing-others">
            {others.map((o) => <li key={o.slug}><Link href={landingPath(kind, lang, o.slug)} className="inline-flex min-h-11 items-center font-medium underline decoration-accent decoration-2 underline-offset-4">{o.name}</Link></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
