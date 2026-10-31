import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowsePage } from "@/components/browse";
import { GENRES, genreCover, genreLabelKey, type GenreKey } from "@/lib/categories";
import { allGenreTiles } from "@/lib/games";
import { gameViews, loadSiteData } from "@/lib/data";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/genres">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("genres.title"), alternates: languageAlternates(lang, "/genres/") };
}

export default async function GenresPage({ params }: PageProps<"/[lang]/genres">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const tiles = allGenreTiles(gameViews(loadSiteData()), GENRES.map((g) => g.key));
  return (
    <BrowsePage title={t("genres.title")} lead={t("genres.lead")} tiles={tiles} href={(n) => paths.games(lang, `?genre=${encodeURIComponent(n)}`)} label={(k) => t(genreLabelKey(k as GenreKey))} cover={(k) => genreCover(k as GenreKey)} t={t} />
  );
}
