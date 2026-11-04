import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GamesBrowser } from "@/components/games-browser";
import { JsonLd } from "@/components/json-ld";
import { gameViews, loadSiteData } from "@/lib/data";
import { filterOptions } from "@/lib/games";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";
import { breadcrumbJsonLd, collectionJsonLd, languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

/** Runs before the list is drawn: a shared address with a query (?page=2, ?system=…) hides the unfiltered list until GamesBrowser has read it. The timer is a way out if the page never loads. */
const HIDE_UNTIL_READ = 'if(location.search.length>1){var d=document.documentElement;d.dataset.q="1";setTimeout(function(){delete d.dataset.q},3000)}';

/** A tap on Filters before the page's scripts have run is remembered (the list opens Filters when it is ready) instead of being lost on a slow phone. */
const REMEMBER_FILTERS_TAP = 'document.addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest("[data-filters-btn]")&&!document.querySelector("[data-ready]"))document.documentElement.dataset.ft="1"})';

export async function generateMetadata({ params }: PageProps<"/[lang]/games">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("games.title"), alternates: languageAlternates(lang, "/games/") };
}

export default async function GamesPage({ params }: PageProps<"/[lang]/games">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const games = gameViews(loadSiteData());
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
      <JsonLd data={[
        collectionJsonLd(t("games.title"), lang, games),
        breadcrumbJsonLd([{ name: "Quest Board", url: `${SITE_URL}${paths.home(lang)}` }, { name: t("games.title"), url: `${SITE_URL}${paths.games(lang)}` }]),
      ]} />
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{t("games.title")}</h1>
      <p className="lead mb-[var(--space-xl)] mt-[var(--space-sm)] text-ink-2">{t("games.count", { n: games.length })}</p>
      <script dangerouslySetInnerHTML={{ __html: HIDE_UNTIL_READ + ";" + REMEMBER_FILTERS_TAP }} />
      <GamesBrowser games={games} options={filterOptions(games)} />
    </div>
  );
}
