import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBrowse } from "@/components/live-pages";
import { GENRES } from "@/lib/categories";
import { gameViews, loadSiteData } from "@/lib/data";
import { allGenreTiles } from "@/lib/games";
import { makeT } from "@/lib/i18n/dict";
import { coverRefs } from "@/lib/live";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/genres">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("genres.title"), alternates: languageAlternates(lang, "/genres/") };
}

/** The tiles and their counts are written at build time (the first paint search engines read) and follow the live data in the browser (components/live-pages.tsx). */
export default async function GenresPage({ params }: PageProps<"/[lang]/genres">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const games = gameViews(loadSiteData());
  return (
    <LiveBrowse kind="genres" initialTiles={allGenreTiles(games, GENRES.map((g) => g.key))} covers={coverRefs(games)}></LiveBrowse>
  );
}
