import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseTile } from "@/components/ui";
import { GENRES, genreCover, genreLabelKey, type GenreKey } from "@/lib/categories";
import { gameViews, loadSiteData } from "@/lib/data";
import { allGenreTiles } from "@/lib/games";
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
  const genres = allGenreTiles(gameViews(loadSiteData()), GENRES.map((g) => g.key));
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{t("genres.title")}</h1>
      <p className="lead mb-[var(--space-xl)] mt-[var(--space-sm)] text-ink-2">{t("genres.lead")}</p>
      <ul className="grid grid-cols-2 gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {genres.map((g) => <li key={g.name}><BrowseTile name={t(genreLabelKey(g.name as GenreKey))} count={g.count} cover={genreCover(g.name as GenreKey)} href={paths.games(lang, `?genre=${g.name}`)} t={t} /></li>)}
      </ul>
    </div>
  );
}
