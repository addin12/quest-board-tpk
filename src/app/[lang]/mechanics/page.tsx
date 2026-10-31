import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowsePage } from "@/components/browse";
import { MECHANICS, mechanicLabelKey, type MechanicKey } from "@/lib/categories";
import { allMechanicTiles } from "@/lib/games";
import { gameViews, loadSiteData } from "@/lib/data";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/mechanics">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("mechanics.title"), alternates: languageAlternates(lang, "/mechanics/") };
}

export default async function MechanicsPage({ params }: PageProps<"/[lang]/mechanics">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const tiles = allMechanicTiles(gameViews(loadSiteData()), MECHANICS.map((m) => m.key));
  return (
    <BrowsePage title={t("mechanics.title")} lead={t("mechanics.lead")} tiles={tiles} href={(n) => paths.games(lang, `?mechanic=${encodeURIComponent(n)}`)} label={(k) => t(mechanicLabelKey(k as MechanicKey))} t={t} />
  );
}
