import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { Quiz } from "@/components/quiz";
import { gameViews, loadSiteData } from "@/lib/data";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { coverRefs } from "@/lib/live";
import { languageAlternates } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/find-a-game">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = makeT(lang);
  return { title: t("quiz.title"), description: t("quiz.lead"), alternates: languageAlternates(lang, "/find-a-game/") };
}

/** Five questions and the games that fit (components/quiz.tsx); the list is written at build time and follows the live data in the browser. */
export default async function FindAGamePage({ params }: PageProps<"/[lang]/find-a-game">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const games = gameViews(loadSiteData());
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)] max-sm:pt-[var(--space-lg)]">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: t("quiz.title"), description: t("quiz.lead"), url: `${SITE_URL}${paths.quiz(lang)}` }} />
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{t("quiz.title")}</h1>
      <p className="lead mb-[var(--space-xl)] mt-[var(--space-sm)] max-w-[60ch] text-ink-2">{t("quiz.lead")}</p>
      <Quiz games={games} covers={coverRefs(games)} />
    </div>
  );
}
