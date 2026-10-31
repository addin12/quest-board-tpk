import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { BrowseSection } from "@/components/browse";
import { EmptyState, GameCard, GameRow } from "@/components/ui";
import { GENRES, MECHANICS, STYLES, genreCover, genreLabelKey, mechanicLabelKey, styleLabelKey, type GenreKey, type MechanicKey, type StyleKey } from "@/lib/categories";
import { gameViews, loadSiteData } from "@/lib/data";
import { genreTiles, mechanicTiles, sortGames, styleTiles, systemTiles } from "@/lib/games";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { languageAlternates, websiteJsonLd } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { alternates: languageAlternates(lang, "/") } : {};
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const games = gameViews(loadSiteData());
  const soon = sortGames(games, "soonest").slice(0, 6);
  const beginner = sortGames(games.filter((g) => g.level === "beginner" && !soon.slice(0, 3).includes(g)), "soonest").slice(0, 3);
  const systems = systemTiles(games).slice(0, 10);
  const genres = genreTiles(games, GENRES.map((g) => g.key)).slice(0, 10);
  const styles = styleTiles(games, STYLES.map((s) => s.key)).slice(0, 10);
  const mechanics = mechanicTiles(games, MECHANICS.map((m) => m.key)).slice(0, 10);
  const filterHref = (key: string) => (name: string) => paths.games(lang, `?${key}=${encodeURIComponent(name)}`);

  return (
    <>
      <JsonLd data={websiteJsonLd(lang, t("meta.description"))} />

      {/* The hero is a left-set head and the search, which is the action. Nothing is drawn: the listings below are the imagery. */}
      <section>
        <div className="wrap grid gap-[var(--space-xl)] pb-[var(--space-2xl)] pt-[var(--space-3xl)] lg:grid-cols-12">
          <div className="lg:col-span-12">
            <h1 className="max-w-none text-[length:var(--text-display)]"><span className="block">{t("home.title1")}</span><span className="block">{t("home.title2")}</span></h1>
            <p className="lead mt-[var(--space-lg)] text-ink-2">{t("home.lead")}</p>
            <form action={paths.games(lang)} method="get" role="search" className="mt-[var(--space-xl)] flex w-full max-w-2xl flex-col gap-[var(--space-sm)] sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="home-q" className="label">{t("home.searchLabel")}</label>
                <input id="home-q" name="q" type="search" className="input" placeholder={t("home.searchPlaceholder")} maxLength={80} />
              </div>
              <button type="submit" className="btn btn-primary">{t("games.search")}</button>
            </form>
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="soon-h">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-[var(--space-md)]">
            <h2 id="soon-h">{t("home.soon")}</h2>
            <Link href={paths.games(lang)} className="btn btn-soft">{t("home.browseAll")}</Link>
          </div>
          {soon.length === 0 ? (
            <div className="mt-[var(--space-xl)]"><EmptyState title={t("home.empty")}><Link href={paths.list(lang)} className="btn btn-primary">{t("nav.list")}</Link></EmptyState></div>
          ) : (
            <ul className="mt-[var(--space-xl)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] sm:grid-cols-2 lg:grid-cols-3">
              {soon.map((g) => <li key={g.id}><GameCard game={g} t={t} lang={lang} priority /></li>)}
            </ul>
          )}
        </div>
      </section>

      <BrowseSection id="systems-h" title={t("home.systemsTitle")} tiles={systems} href={filterHref("system")} allHref={paths.systems(lang)} allLabel={t("home.allSystems")} t={t} />
      <BrowseSection id="genres-h" title={t("home.genresTitle")} tiles={genres} href={filterHref("genre")} label={(k) => t(genreLabelKey(k as GenreKey))} cover={(k) => genreCover(k as GenreKey)} allHref={paths.genres(lang)} allLabel={t("home.allGenres")} t={t} />
      <BrowseSection id="styles-h" title={t("home.stylesTitle")} tiles={styles} href={filterHref("style")} label={(k) => t(styleLabelKey(k as StyleKey))} variant="card" allHref={paths.styles(lang)} allLabel={t("home.allStyles")} t={t} />
      <BrowseSection id="mechanics-h" title={t("home.mechanicsTitle")} tiles={mechanics} href={filterHref("mechanic")} label={(k) => t(mechanicLabelKey(k as MechanicKey))} variant="card" allHref={paths.mechanics(lang)} allLabel={t("home.allMechanics")} t={t} />

      {beginner.length > 0 && (
        <section className="section pt-0" aria-labelledby="new-h">
          <div className="wrap grid gap-[var(--space-2xl)] lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h2 id="new-h">{t("home.newTitle")}</h2>
              <p className="lead mt-[var(--space-md)]">{t("home.newBody")}</p>
              <p className="mt-[var(--space-xl)]"><Link href={paths.games(lang, "?level=beginner")} className="btn btn-primary">{t("home.moreBeginner")}</Link></p>
            </div>
            <ul className="ruled lg:col-span-6 lg:col-start-7">
              {beginner.map((g) => <li key={g.id}><GameRow game={g} t={t} lang={lang} /></li>)}
            </ul>
          </div>
        </section>
      )}

      <section className="section border-t-4 border-double border-ink" aria-labelledby="gm-h">
        <div className="wrap">
          <h2 id="gm-h">{t("home.gmCtaTitle")}</h2>
          <p className="lead mt-[var(--space-md)]">{t("home.gmCtaBody")}</p>
          <p className="mt-[var(--space-xl)]"><Link href={paths.list(lang)} className="btn btn-primary">{t("nav.list")}</Link></p>
        </div>
      </section>
    </>
  );
}
