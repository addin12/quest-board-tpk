import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gone, goneMetadata } from "@/components/gone";
import { JsonLd } from "@/components/json-ld";
import { GmDetail } from "@/components/gm-detail";
import { gameViews, loadSiteData } from "@/lib/data";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";
import { slugParams } from "@/lib/static-params";
import { breadcrumbJsonLd, gmJsonLd, languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  const { gms, goneGms } = loadSiteData();
  return slugParams([...gms, ...goneGms.map((slug) => ({ slug }))]);
}

export async function generateMetadata({ params }: PageProps<"/[lang]/gm/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const data = loadSiteData();
  if (isLang(lang) && data.goneGms.includes(slug)) return goneMetadata("gm", lang);
  const gm = isLang(lang) ? data.gms.find((g) => g.slug === slug) : undefined;
  if (!gm || !isLang(lang)) return {};
  return { title: gm.name, description: gm.bio.slice(0, 160) || undefined, alternates: languageAlternates(lang, `/gm/${gm.slug}/`) };
}

export default async function GmPage({ params }: PageProps<"/[lang]/gm/[slug]">) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();
  const data = loadSiteData();
  if (data.goneGms.includes(slug)) return <Gone kind="gm" lang={lang} />;
  const gm = data.gms.find((g) => g.slug === slug);
  if (!gm) notFound();
  const t = makeT(lang);
  const games = gameViews(data).filter((g) => g.gmId === gm.id);
  return (
    <>
      <JsonLd data={[
        gmJsonLd(gm, lang),
        breadcrumbJsonLd([
          { name: "Quest Board", url: `${SITE_URL}${paths.home(lang)}` },
          { name: t("gm.title"), url: `${SITE_URL}${paths.gms(lang)}` },
          { name: gm.name, url: `${SITE_URL}${paths.gm(lang, gm.slug)}` },
        ]),
      ]} />
      <GmDetail slug={slug} initial={{ gm, games }} />
    </>
  );
}
