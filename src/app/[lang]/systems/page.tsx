import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowsePage } from "@/components/browse";
import { allSystemTiles } from "@/lib/games";
import { REPORT_URL } from "@/lib/site";
import { systemCover } from "@/lib/system-covers";
import { SYSTEMS } from "@/lib/systems";
import { gameViews, loadSiteData } from "@/lib/data";
import { paths } from "@/lib/hrefs";
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
  const tiles = allSystemTiles(gameViews(loadSiteData()), SYSTEMS);
  return (
    <BrowsePage cover={systemCover} search={{ label: t("browse.systemSearch"), placeholder: t("browse.systemPlaceholder") }} home={paths.home(lang)} path={paths.systems(lang)} emptyHeading={t("systems.noGames")} title={t("systems.title")} lead={t("systems.lead")} tiles={tiles} href={(n) => paths.games(lang, `?system=${encodeURIComponent(n)}`)} t={t}>
      <p className="mt-[var(--space-2xl)] max-w-prose text-ink-2">
        {t("systems.missing")}
        {REPORT_URL && <> <a href={REPORT_URL} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">{t("systems.tellUs")}<span className="sr-only"> {t("a11y.opensNewTab")}</span></a></>}
      </p>
    </BrowsePage>
  );
}
