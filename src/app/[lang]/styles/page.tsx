import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBrowse } from "@/components/live-pages";
import { STYLES } from "@/lib/categories";
import { gameViews, loadSiteData } from "@/lib/data";
import { allStyleTiles } from "@/lib/games";
import { makeT } from "@/lib/i18n/dict";
import { coverRefs } from "@/lib/live";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/styles">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("styles.title"), alternates: languageAlternates(lang, "/styles/") };
}

/** The tiles and their counts are written at build time (the first paint search engines read) and follow the live data in the browser (components/live-pages.tsx). */
export default async function StylesPage({ params }: PageProps<"/[lang]/styles">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const games = gameViews(loadSiteData());
  return (
    <LiveBrowse kind="styles" initialTiles={allStyleTiles(games, STYLES.map((s) => s.key))} covers={coverRefs(games)}></LiveBrowse>
  );
}
