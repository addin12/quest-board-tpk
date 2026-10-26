import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { EmptyState, GameCard } from "@/components/ui";
import { GENRES, genreIcon, genreLabelKey } from "@/lib/categories";
import { gameViews, loadSiteData } from "@/lib/data";
import { sortGames } from "@/lib/games";
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
  const soon = sortGames(games, "soonest").slice(0, 6);
  const beginner = sortGames(games.filter((g) => g.level === "beginner" && !soon.slice(0, 3).includes(g)), "soonest").slice(0, 3);
  const genres = GENRES.filter((g) => games.some((x) => x.genres.includes(g.key))).slice(0, 12);

  const steps = [
    { icon: "search", title: t("home.step1Title"), body: t("home.step1Body") },
    { icon: "comment", title: t("home.step2Title"), body: t("home.step2Body") },
    { icon: "dice-d20", title: t("home.step3Title"), body: t("home.step3Body") },
  ] as const;

  return (
    <>
      <JsonLd data={websiteJsonLd(lang, t("meta.description"))} />
      <section className="on-wood relative overflow-hidden border-b-2 border-[#8a6a3a] bg-[#1b1008]">
        <Image src="/images/tavern/hero.webp" alt="" fill priority sizes="100vw" className="object-cover object-[75%_center] opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1b1008]/90 via-[#1b1008]/60 to-transparent" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="eyebrow text-accent">{t("home.eyebrow")}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            {t("home.title1")} <span className="text-accent">{t("home.title2")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted">{t("home.lead")}</p>
          <form action={paths.games(lang)} method="get" role="search" className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="home-q" className="label">{t("home.searchLabel")}</label>
              <input id="home-q" name="q" type="search" className="input" placeholder={t("home.searchPlaceholder")} maxLength={80} />
            </div>
            <button type="submit" className="btn-primary"><Icon name="search" /> {t("games.search")}</button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold">{t("home.soon")}</h2>
          <Link href={paths.games(lang)} className="btn-ghost">{t("home.browseAll")} <Icon name="arrow-right" /></Link>
        </div>
        {soon.length === 0 ? (
          <div className="mt-5"><EmptyState title={t("home.empty")}><Link href={paths.list(lang)} className="btn-primary">{t("nav.list")}</Link></EmptyState></div>
        ) : (
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {soon.map((g) => <li key={g.id} className="flex"><div className="flex w-full flex-col [&>a]:flex-1"><GameCard game={g} t={t} lang={lang} /></div></li>)}
          </ul>
        )}
      </section>

      {beginner.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14">
          <h2 className="text-2xl font-bold">{t("home.newTitle")}</h2>
          <p className="mt-1 text-muted">{t("home.newBody")}</p>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {beginner.map((g) => <li key={g.id} className="flex"><div className="flex w-full flex-col [&>a]:flex-1"><GameCard game={g} t={t} lang={lang} /></div></li>)}
          </ul>
          <p className="mt-4"><Link href={paths.games(lang, "?level=beginner")} className="btn-secondary">{t("home.moreBeginner")}</Link></p>
        </section>
      )}

      {genres.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14" aria-labelledby="genres-h">
          <h2 id="genres-h" className="text-2xl font-bold">{t("home.genresTitle")}</h2>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {genres.map((g) => (
              <li key={g.key}>
                <Link href={paths.games(lang, `?genre=${g.key}`)} className="btn-secondary"><Icon name={genreIcon(g.key)} /> {t(genreLabelKey(g.key))}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-14" aria-labelledby="steps-h">
        <h2 id="steps-h" className="sr-only">{t("nav.how")}</h2>
        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.title} className="card p-6">
              <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-xl text-accent"><Icon name={s.icon} /></span>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="card flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t("home.gmCtaTitle")}</h2>
            <p className="mt-1 max-w-xl text-muted">{t("home.gmCtaBody")}</p>
          </div>
          <Link href={paths.list(lang)} className="btn-primary shrink-0"><Icon name="megaphone" /> {t("nav.list")}</Link>
        </div>
      </section>
    </>
  );
}
