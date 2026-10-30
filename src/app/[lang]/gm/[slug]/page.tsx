import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactButtons } from "@/components/contact-buttons";
import { Gone, goneMetadata } from "@/components/gone";
import { JsonLd } from "@/components/json-ld";
import { Avatar, GameCard } from "@/components/ui";
import { contactMessage, encodeContact } from "@/lib/contact";
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
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-lg)]">
      <JsonLd data={[
        gmJsonLd(gm, lang),
        breadcrumbJsonLd([
          { name: "Quest Board TPK", url: `${SITE_URL}${paths.home(lang)}` },
          { name: t("gm.title"), url: `${SITE_URL}${paths.gms(lang)}` },
          { name: gm.name, url: `${SITE_URL}${paths.gm(lang, gm.slug)}` },
        ]),
      ]} />
      <Link href={paths.gms(lang)} className="link-spot inline-flex min-h-11 items-center font-bold">{t("gm.title")}</Link>
      <header className="mt-[var(--space-lg)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-4"><Avatar name={gm.name} photo={gm.photo} size={416} priority /></div>
        <div className="min-w-0 lg:col-span-8">
          <h1 className="max-w-none text-[length:var(--text-display-s)]">{gm.name}</h1>
          {gm.city && <p className="lead mt-[var(--space-sm)] text-ink-2">{gm.city}</p>}
          {gm.systems.length > 0 && (
            <p className="mt-[var(--space-lg)] flex flex-wrap items-center gap-[var(--space-xs)]"><span className="font-bold">{t("gm.systems")}:</span>{gm.systems.map((x) => <span key={x} className="chip">{x}</span>)}</p>
          )}
          {gm.bio && <div className="mt-[var(--space-lg)] max-w-[65ch] space-y-[var(--space-md)]">{gm.bio.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>}
          <h2 className="mt-[var(--space-xl)] max-w-none text-[length:var(--text-title)]">{t("gm.contact")}</h2>
          <div className="mt-[var(--space-md)]"><ContactButtons wa={encodeContact(gm.whatsapp)} discord={gm.discord} message={contactMessage(gm, null, lang)} /></div>
        </div>
      </header>

      <section className="mt-[var(--section-gap-s)]" aria-labelledby="gm-games-h">
        <h2 id="gm-games-h">{t("gm.gamesTitle")}</h2>
        {games.length === 0 ? (
          <p className="mt-[var(--space-md)] text-muted">{t("gm.noGames")}</p>
        ) : (
          <ul className="mt-[var(--space-xl)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-2xl)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((g, i) => <li key={g.id}><GameCard game={g} t={t} lang={lang} priority={i < 3} /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
