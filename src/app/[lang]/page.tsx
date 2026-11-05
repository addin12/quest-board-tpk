import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { HomeSections } from "@/components/live-pages";
import { gameViews, loadSiteData } from "@/lib/data";
import { homeModel } from "@/lib/home";
import { coverRefs } from "@/lib/live";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { languageAlternates, websiteJsonLd } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { alternates: languageAlternates(lang, "/") } : {};
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const games = gameViews(loadSiteData());
  const [, leadFirst = "", leadRest = ""] = /^([\s\S]+?[.!?])\s+([\s\S]*)$/.exec(t("home.lead")) ?? ["", t("home.lead")];
  return (
    <>
      <JsonLd data={websiteJsonLd(lang, t("meta.description"))} />

      {/* The hero is one centered column: the head and the search, which is the action. The soonest game is the first card of "Starting soon" below. */}
      <section>
        <div className="wrap grid justify-items-center pb-[var(--space-2xl)] pt-[var(--space-3xl)] text-center max-sm:pb-[var(--space-xl)] max-sm:pt-[var(--space-xl)]">
          <div className="grid w-full justify-items-center">
            <h1 className="max-w-none text-[length:var(--text-display)] max-sm:text-[length:var(--text-display-s)]"><span className="block">{t("home.title1")}</span><span className="block">{t("home.title2")}</span></h1>
            {/* The first sentence gets a line of its own and the paragraph the full width (the lead style caps at 52ch); on a phone each still wraps. */}
            <p className="lead mx-auto mt-[var(--space-lg)] max-w-none text-ink-2">{leadFirst}{leadRest && <span className="block max-sm:hidden">{leadRest}</span>}</p>
            <form action={paths.games(lang)} method="get" role="search" className="mt-[var(--space-xl)] flex w-full max-w-2xl flex-col gap-[var(--space-sm)] text-left sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="home-q" className="label">{t("home.searchLabel")}</label>
                <input id="home-q" name="q" type="search" className="input" placeholder={t("home.searchPlaceholder")} maxLength={80} />
              </div>
              <button type="submit" className="btn btn-primary">{t("games.search")}</button>
            </form>
            <p className="mt-[var(--space-lg)] flex flex-wrap items-center justify-center gap-x-[var(--space-md)] gap-y-[var(--space-xs)] text-ink-2">{t("home.gmHint")} <Link href={paths.list(lang)} className="btn btn-soft">{t("nav.list")}</Link></p>
          </div>
        </div>
      </section>

      <HomeSections initial={homeModel(games)} covers={coverRefs(games)} />

      <section className="section border-t-4 border-double border-ink" aria-labelledby="gm-h">
        <div className="wrap">
          <h2 id="gm-h">{t("home.gmCtaTitle")}</h2>
          <p className="lead mt-[var(--space-md)]">{t("home.gmCtaBody")}</p>
          <p className="mt-[var(--space-xl)]"><Link href={paths.list(lang)} className="btn btn-primary">{t("nav.list")}</Link></p>
        </div>
      </section>
    </>
  );
}
