import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactButtons } from "@/components/contact-buttons";
import { Icon } from "@/components/icon";
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
  return slugParams(loadSiteData().gms);
}

export async function generateMetadata({ params }: PageProps<"/[lang]/gm/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const gm = isLang(lang) ? loadSiteData().gms.find((g) => g.slug === slug) : undefined;
  if (!gm || !isLang(lang)) return {};
  return { title: gm.name, description: gm.bio.slice(0, 160) || undefined, alternates: languageAlternates(lang, `/gm/${gm.slug}/`) };
}

export default async function GmPage({ params }: PageProps<"/[lang]/gm/[slug]">) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();
  const data = loadSiteData();
  const gm = data.gms.find((g) => g.slug === slug);
  if (!gm) notFound();
  const t = makeT(lang);
  const games = gameViews(data).filter((g) => g.gmId === gm.id);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <JsonLd data={[
        gmJsonLd(gm, lang),
        breadcrumbJsonLd([
          { name: "Quest Board TPK", url: `${SITE_URL}${paths.home(lang)}` },
          { name: t("gm.title"), url: `${SITE_URL}${paths.gms(lang)}` },
          { name: gm.name, url: `${SITE_URL}${paths.gm(lang, gm.slug)}` },
        ]),
      ]} />
      <Link href={paths.gms(lang)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"><Icon name="arrow-left" /> {t("gm.title")}</Link>
      <header className="card mt-2 flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
        <Avatar name={gm.name} photo={gm.photo} size={112} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">{gm.name}</h1>
          {gm.city && <p className="mt-1 inline-flex items-center gap-1.5 text-muted"><Icon name="marker" />{gm.city}</p>}
          {gm.systems.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5"><span className="text-sm text-muted">{t("gm.systems")}:</span>{gm.systems.map((s) => <span key={s} className="chip">{s}</span>)}</p>
          )}
          {gm.bio && <div className="mt-4 max-w-2xl space-y-3">{gm.bio.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>}
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">{t("gm.contact")}</h2>
          <div className="mt-2"><ContactButtons wa={encodeContact(gm.whatsapp)} discord={gm.discord} message={contactMessage(gm, null, lang)} /></div>
        </div>
      </header>

      <section className="mt-10" aria-labelledby="gm-games-h">
        <h2 id="gm-games-h" className="text-2xl font-bold">{t("gm.gamesTitle")}</h2>
        {games.length === 0 ? (
          <p className="mt-3 text-muted">{t("gm.noGames")}</p>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => <li key={g.id} className="flex"><div className="flex w-full flex-col [&>a]:flex-1"><GameCard game={g} t={t} lang={lang} /></div></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
