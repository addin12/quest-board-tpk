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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <JsonLd data={[
        collectionJsonLd(t("games.title"), lang, games),
        breadcrumbJsonLd([{ name: "Quest Board TPK", url: `${SITE_URL}${paths.home(lang)}` }, { name: t("games.title"), url: `${SITE_URL}${paths.games(lang)}` }]),
      ]} />
      <h1 className="text-3xl font-bold">{t("games.title")}</h1>
      <p className="mt-1 mb-6 text-muted">{t("games.count", { n: games.length })}</p>
      <GamesBrowser games={games} options={filterOptions(games)} />
    </div>
  );
}
