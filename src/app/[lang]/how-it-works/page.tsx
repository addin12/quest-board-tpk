import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { SITE_URL } from "@/lib/site";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/how-it-works">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = makeT(lang);
  return { title: t("how.title"), description: t("how.lead"), alternates: languageAlternates(lang, "/how-it-works/") };
}

export default async function HowItWorksPage({ params }: PageProps<"/[lang]/how-it-works">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const player = [t("how.p1"), t("how.p2"), t("how.p3"), t("how.p4")];
  const gm = [t("how.g1"), t("how.g2"), t("how.g3"), t("how.g4"), t("how.g5")];
  const safety = [t("how.s1"), t("how.s2"), t("how.s3"), t("how.s4")];
  const list = (items: string[]) => (
    <ol className="steps ruled mt-[var(--space-lg)]">
      {items.map((text) => (
        <li key={text} className="py-[var(--space-lg)] sm:pl-[5rem]"><p>{text}</p></li>
      ))}
    </ol>
  );
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: t("how.title"), description: t("how.lead"), url: `${SITE_URL}${paths.how(lang)}` }} />
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{t("how.title")}</h1>
      <p className="lead mt-[var(--space-sm)] text-ink-2">{t("how.lead")}</p>
      <p className="mt-[var(--space-lg)]"><Link href={paths.games(lang)} className="btn btn-primary">{t("nav.games")}</Link></p>

      <div className="mt-[var(--section-gap-s)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-2xl)] lg:grid-cols-12">
        <section className="lg:col-span-6" aria-labelledby="players-h">
          <h2 id="players-h">{t("how.players")}</h2>
          {list(player)}
        </section>

        <section className="lg:col-span-6" aria-labelledby="gms-h">
          <h2 id="gms-h">{t("how.gms")}</h2>
          {list(gm)}
          <p className="mt-[var(--space-xl)]"><Link href={paths.list(lang)} className="btn btn-secondary">{t("nav.list")}</Link></p>
        </section>
      </div>

      <section id="safety" className="mt-[var(--section-gap-s)] scroll-mt-[var(--space-xl)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] lg:grid-cols-12" aria-labelledby="safety-h">
        <h2 id="safety-h" className="lg:col-span-5">{t("how.safetyTitle")}</h2>
        <ul className="ruled lg:col-span-7">
          {safety.map((x) => <li key={x} className="py-[var(--space-md)]"><p>{x}</p></li>)}
        </ul>
      </section>

      <section className="well mt-[var(--section-gap-s)] lg:grid lg:grid-cols-12 lg:gap-x-[var(--gap-columns)]">
        <h2 className="max-w-none text-[length:var(--text-title)] lg:col-span-4">{t("how.aboutTitle")}</h2>
        <p className="mt-[var(--space-sm)] text-ink-2 lg:col-span-8 lg:mt-0">{t("how.about")}</p>
      </section>
    </div>
  );
}
