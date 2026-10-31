import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowsePage } from "@/components/browse";
import { STYLES, styleLabelKey, type StyleKey } from "@/lib/categories";
import { allStyleTiles } from "@/lib/games";
import { gameViews, loadSiteData } from "@/lib/data";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/styles">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("styles.title"), alternates: languageAlternates(lang, "/styles/") };
}

export default async function StylesPage({ params }: PageProps<"/[lang]/styles">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const tiles = allStyleTiles(gameViews(loadSiteData()), STYLES.map((s) => s.key));
  return (
    <BrowsePage title={t("styles.title")} lead={t("styles.lead")} tiles={tiles} href={(n) => paths.games(lang, `?style=${encodeURIComponent(n)}`)} label={(k) => t(styleLabelKey(k as StyleKey))} variant="card" t={t} />
  );
}
