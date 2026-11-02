import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TileSearch } from "@/components/tile-search";
import { EmptyState, GmCard } from "@/components/ui";
import { loadSiteData } from "@/lib/data";
import { makeT } from "@/lib/i18n/dict";
import { searchText } from "@/lib/search";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/gms">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("gm.title"), alternates: languageAlternates(lang, "/gms/") };
}

export default async function GmsPage({ params }: PageProps<"/[lang]/gms">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const { gms, games } = loadSiteData();
  const open = (id: string) => games.filter((g) => g.gmId === id).length;
  const sorted = [...gms].sort((a, b) => open(b.id) - open(a.id) || a.name.localeCompare(b.name));
  // what the search box looks in: the name, the city, the systems they run and the bio (synonyms count: "dnd" finds a GM who runs Dungeons & Dragons)
  const searchable = (gm: (typeof gms)[number]) => searchText([gm.name, gm.city, ...gm.systems, gm.bio].join(" "));
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{t("gm.title")}</h1>
      <p className="lead mt-[var(--space-sm)] text-ink-2">{t("gm.lead")}</p>
      {sorted.length === 0 ? (
        <div className="mt-[var(--space-xl)]"><EmptyState title={t("gm.empty")} /></div>
      ) : (
        <>
          <div className="mb-[var(--space-xl)] mt-[var(--space-lg)]">
            <TileSearch targetId="gm-list" label={t("gm.search")} placeholder={t("gm.searchPlaceholder")} names={sorted.map(searchable)} />
          </div>
          <ul id="gm-list" className="ruled grid gap-x-[var(--gap-columns)] md:grid-cols-2">
            {sorted.map((gm, i) => <li key={gm.id} data-name={searchable(gm)}><GmCard gm={gm} openGames={open(gm.id)} t={t} lang={lang} priority={i < 4} /></li>)}
          </ul>
        </>
      )}
    </div>
  );
}
