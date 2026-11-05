import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBrowse } from "@/components/live-pages";
import { SYSTEMS } from "@/lib/systems";
import { gameViews, loadSiteData } from "@/lib/data";
import { allSystemTiles } from "@/lib/games";
import { makeT } from "@/lib/i18n/dict";
import { coverRefs } from "@/lib/live";
import { REPORT_URL } from "@/lib/site";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/systems">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("systems.title"), alternates: languageAlternates(lang, "/systems/") };
}

/** The tiles and their counts are written at build time (the first paint search engines read) and follow the live data in the browser (components/live-pages.tsx). */
export default async function SystemsPage({ params }: PageProps<"/[lang]/systems">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const games = gameViews(loadSiteData());
  return (
    <LiveBrowse kind="systems" initialTiles={allSystemTiles(games, SYSTEMS)} covers={coverRefs(games)}>
      <p className="mt-[var(--space-2xl)] max-w-prose text-ink-2">
        {t("systems.missing")}
        {REPORT_URL && <> <a href={REPORT_URL} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">{t("systems.tellUs")}<span className="sr-only"> {t("a11y.opensNewTab")}</span></a></>}
      </p>
    </LiveBrowse>
  );
}
