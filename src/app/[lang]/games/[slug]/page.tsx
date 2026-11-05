import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gone, goneMetadata } from "@/components/gone";
import { JsonLd } from "@/components/json-ld";
import { GameDetail } from "@/components/game-detail";
import { gmById, loadSiteData } from "@/lib/data";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { OG_IMAGE, SITE_URL } from "@/lib/site";
import { slugParams } from "@/lib/static-params";
import { breadcrumbJsonLd, gameJsonLd, languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  const { games, goneGames } = loadSiteData();
  return slugParams([...games, ...goneGames.map((slug) => ({ slug }))]);
}

export async function generateMetadata({ params }: PageProps<"/[lang]/games/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const data = loadSiteData();
  if (isLang(lang) && data.goneGames.includes(slug)) return goneMetadata("game", lang);
  const game = isLang(lang) ? data.games.find((g) => g.slug === slug) : undefined;
  if (!game || !isLang(lang)) return {};
  return {
    title: game.title,
    description: game.summary || undefined,
    alternates: languageAlternates(lang, `/games/${game.slug}/`),
    openGraph: { title: game.title, description: game.summary || undefined, type: "website", images: game.cover ? [{ url: game.cover }] : [OG_IMAGE] },
  };
}

export default async function GamePage({ params }: PageProps<"/[lang]/games/[slug]">) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();
  const data = loadSiteData();
  if (data.goneGames.includes(slug)) return <Gone kind="game" lang={lang} />;
  const game = data.games.find((g) => g.slug === slug);
  const gm = game ? gmById(data, game.gmId) : undefined;
  if (!game || !gm) notFound();
  const t = makeT(lang);
  return (
    <>
      <JsonLd data={[
        ...(game.onDemand ? [] : [gameJsonLd(game, gm, lang)]), // an Event needs a date; a game on request has none
        breadcrumbJsonLd([
          { name: "Quest Board", url: `${SITE_URL}${paths.home(lang)}` },
          { name: t("games.title"), url: `${SITE_URL}${paths.games(lang)}` },
          { name: game.title, url: `${SITE_URL}${paths.game(lang, game.slug)}` },
        ]),
      ]} />
      <GameDetail slug={slug} initial={{ game, gm }} />
    </>
  );
}
