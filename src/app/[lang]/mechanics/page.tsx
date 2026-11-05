import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBrowse } from "@/components/live-pages";
import { MECHANICS } from "@/lib/categories";
import { gameViews, loadSiteData } from "@/lib/data";
import { allMechanicTiles } from "@/lib/games";
import { makeT } from "@/lib/i18n/dict";
import { coverRefs } from "@/lib/live";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/mechanics">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("mechanics.title"), alternates: languageAlternates(lang, "/mechanics/") };
}

/** The tiles and their counts are written at build time (the first paint search engines read) and follow the live data in the browser (components/live-pages.tsx). */
export default async function MechanicsPage({ params }: PageProps<"/[lang]/mechanics">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const games = gameViews(loadSiteData());
  return (
    <LiveBrowse kind="mechanics" initialTiles={allMechanicTiles(games, MECHANICS.map((m) => m.key))} covers={coverRefs(games)}></LiveBrowse>
  );
}
