import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState, SystemTile } from "@/components/ui";
import { gameViews, loadSiteData } from "@/lib/data";
import { systemTiles } from "@/lib/games";
import { makeT } from "@/lib/i18n/dict";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/systems">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("systems.title"), alternates: languageAlternates(lang, "/systems/") };
}

export default async function SystemsPage({ params }: PageProps<"/[lang]/systems">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const systems = systemTiles(gameViews(loadSiteData()));
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{t("systems.title")}</h1>
      <p className="lead mb-[var(--space-xl)] mt-[var(--space-sm)] text-ink-2">{t("systems.lead")}</p>
      {systems.length === 0 ? (
        <EmptyState title={t("systems.empty")} />
      ) : (
        <ul className="grid grid-cols-2 gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {systems.map((s) => <li key={s.name}><SystemTile name={s.name} count={s.count} cover={s.cover} t={t} lang={lang} /></li>)}
        </ul>
      )}
    </div>
  );
}
