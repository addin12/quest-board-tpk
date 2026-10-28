import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState, GmCard } from "@/components/ui";
import { loadSiteData } from "@/lib/data";
import { makeT } from "@/lib/i18n/dict";
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
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{t("gm.title")}</h1>
      <p className="lead mb-[var(--space-xl)] mt-[var(--space-sm)] text-ink-2">{t("gm.lead")}</p>
      {sorted.length === 0 ? (
        <EmptyState title={t("gm.empty")} />
      ) : (
        <ul className="ruled grid gap-x-[var(--gap-columns)] md:grid-cols-2">
          {sorted.map((gm) => <li key={gm.id}><GmCard gm={gm} openGames={open(gm.id)} t={t} lang={lang} /></li>)}
        </ul>
      )}
    </div>
  );
}
