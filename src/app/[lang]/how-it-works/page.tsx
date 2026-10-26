import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
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
    <ol className="mt-4 space-y-4">
      {items.map((text, i) => (
        <li key={text} className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink" aria-hidden>{i + 1}</span>
          <p className="pt-0.5">{text}</p>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: t("how.title"), description: t("how.lead"), url: `${SITE_URL}${paths.how(lang)}` }} />
      <h1 className="text-4xl font-bold">{t("how.title")}</h1>
      <p className="mt-3 text-lg text-muted">{t("how.lead")}</p>

      <section className="mt-10" aria-labelledby="players-h">
        <h2 id="players-h" className="text-2xl font-bold">{t("how.players")}</h2>
        {list(player)}
        <p className="mt-6"><Link href={paths.games(lang)} className="btn-primary"><Icon name="search" /> {t("nav.games")}</Link></p>
      </section>

      <section className="mt-12" aria-labelledby="gms-h">
        <h2 id="gms-h" className="text-2xl font-bold">{t("how.gms")}</h2>
        {list(gm)}
        <p className="mt-6"><Link href={paths.list(lang)} className="btn-secondary"><Icon name="megaphone" /> {t("nav.list")}</Link></p>
      </section>

      <section id="safety" className="mt-12 scroll-mt-24" aria-labelledby="safety-h">
        <h2 id="safety-h" className="flex items-center gap-2 text-2xl font-bold"><Icon name="shield-check" className="text-gold" /> {t("how.safetyTitle")}</h2>
        <ul className="mt-4 space-y-3">
          {safety.map((s) => <li key={s} className="flex gap-3"><Icon name="check" className="mt-1.5 shrink-0 text-success" /><p>{s}</p></li>)}
        </ul>
      </section>

      <section className="card mt-12 p-6">
        <h2 className="text-xl font-bold">{t("how.aboutTitle")}</h2>
        <p className="mt-2 text-muted">{t("how.about")}</p>
      </section>
    </div>
  );
}
