import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landing } from "@/components/landing";
import { gameViews, loadSiteData } from "@/lib/data";
import { makeT } from "@/lib/i18n/dict";
import { systemPages } from "@/lib/landing";
import { languageAlternates } from "@/lib/seo";
import { slugParams } from "@/lib/static-params";
import { isLang } from "@/lib/types";

// One page for each game system that has a game when the site is built (ADR-56); the rest of the addresses do not exist.
export const dynamicParams = false;

const pages = () => systemPages(gameViews(loadSiteData()), Date.now());

export function generateStaticParams() {
  return slugParams(pages());
}

export async function generateMetadata({ params }: PageProps<"/[lang]/systems/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const page = pages().find((p) => p.slug === slug);
  if (!isLang(lang) || !page) return {};
  const t = makeT(lang);
  return {
    title: t("land.system.title", { name: page.name }),
    description: t("land.system.lead", { name: page.name }),
    alternates: languageAlternates(lang, `/systems/${page.slug}/`),
  };
}

export default async function SystemPage({ params }: PageProps<"/[lang]/systems/[slug]">) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();
  const all = pages();
  const page = all.find((p) => p.slug === slug);
  if (!page) notFound();
  return <Landing kind="system" page={page} others={all.filter((p) => p !== page)} lang={lang} t={makeT(lang)} />;
}
