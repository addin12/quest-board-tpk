import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { BrowseTile, EmptyState, GameCard, GameRow } from "@/components/ui";
import { GENRES, genreCover, genreLabelKey, type GenreKey } from "@/lib/categories";
import { gameViews, loadSiteData } from "@/lib/data";
import { genreTiles, sortGames, systemTiles } from "@/lib/games";
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
            <ul className="rail mt-[var(--space-xl)]" tabIndex={0} aria-label={t("home.soon")}>
              {soon.map((g) => <li key={g.id}><GameCard game={g} t={t} lang={lang} priority /></li>)}
            </ul>
          )}
        </div>
      </section>

      {systems.length > 0 && (
        <section className="section pt-0" aria-labelledby="systems-h">
          <div className="wrap">
            <h2 id="systems-h">{t("home.systemsTitle")}</h2>
            <ul className="mt-[var(--space-xl)] grid grid-cols-2 gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {systems.map((s) => <li key={s.name}><BrowseTile name={s.name} count={s.count} cover={s.cover} href={paths.games(lang, `?system=${encodeURIComponent(s.name)}`)} t={t} /></li>)}
            </ul>
            <p className="mt-[var(--space-xl)]"><Link href={paths.systems(lang)} className="btn btn-soft">{t("home.allSystems")}</Link></p>
          </div>
        </section>
      )}

      {genres.length > 0 && (
        <section className="section pt-0" aria-labelledby="genres-h">
          <div className="wrap">
            <h2 id="genres-h">{t("home.genresTitle")}</h2>
            <ul className="mt-[var(--space-xl)] grid grid-cols-2 gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {genres.map((g) => <li key={g.name}><BrowseTile name={t(genreLabelKey(g.name as GenreKey))} count={g.count} cover={genreCover(g.name as GenreKey)} href={paths.games(lang, `?genre=${g.name}`)} t={t} /></li>)}
            </ul>
            <p className="mt-[var(--space-xl)]"><Link href={paths.genres(lang)} className="btn btn-soft">{t("home.allGenres")}</Link></p>
          </div>
        </section>
      )}

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
