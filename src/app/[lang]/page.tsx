import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { EmptyState, GameCard, GameRow } from "@/components/ui";
import { GENRES, genreLabelKey } from "@/lib/categories";
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
    { title: t("home.step1Title"), body: t("home.step1Body") },
    { title: t("home.step2Title"), body: t("home.step2Body") },
    { title: t("home.step3Title"), body: t("home.step3Body") },
  ] as const;

  return (
    <>
      <JsonLd data={websiteJsonLd(lang, t("meta.description"))} />

      {/* Corridor: one centred column, the search is the action. The screen at the foot is the only decoration, and it sits under no type. */}
      <section className="relative flex min-h-[calc(100dvh-9rem)] max-lg:min-h-0">
        <div className="wrap relative z-10 flex flex-col items-center justify-center py-[var(--space-3xl)] text-center">
          <h1 className="mx-auto max-w-[16ch] text-[length:var(--text-display-s)]">{t("home.title1")} {t("home.title2")}</h1>
          <p className="lead mt-[var(--space-lg)] text-ink-2">{t("home.lead")}</p>
          <form action={paths.games(lang)} method="get" role="search" className="mt-[var(--space-xl)] flex w-full max-w-2xl flex-col gap-[var(--space-sm)] text-left sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="home-q" className="label">{t("home.searchLabel")}</label>
              <input id="home-q" name="q" type="search" className="input" placeholder={t("home.searchPlaceholder")} maxLength={80} />
            </div>
            <button type="submit" className="btn btn-primary">{t("games.search")}</button>
          </form>
        </div>
        <div className="halftone halftone-up pointer-events-none absolute inset-x-0 bottom-0 h-[var(--space-3xl)]" aria-hidden />
      </section>

      <section className="section" aria-labelledby="soon-h">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-[var(--space-md)]">
            <h2 id="soon-h">{t("home.soon")}</h2>
            <Link href={paths.games(lang)} className="btn btn-secondary">{t("home.browseAll")}</Link>
          </div>
          {soon.length === 0 ? (
            <div className="mt-[var(--space-xl)]"><EmptyState title={t("home.empty")}><Link href={paths.list(lang)} className="btn btn-primary">{t("nav.list")}</Link></EmptyState></div>
          ) : (
            <ul className="rail mt-[var(--space-xl)]" tabIndex={0} aria-label={t("home.soon")}>
              {soon.map((g, i) => <li key={g.id}><GameCard game={g} t={t} lang={lang} priority={i < 3} /></li>)}
            </ul>
          )}
        </div>
      </section>

      {genres.length > 0 && (
        <section className="section band-tint" aria-labelledby="genres-h">
          <div className="wrap">
            <h2 id="genres-h">{t("home.genresTitle")}</h2>
            <ul className="ruled mt-[var(--space-xl)] grid gap-x-[var(--gap-columns)] sm:grid-cols-2 lg:grid-cols-3">
              {genres.map((g) => (
                <li key={g.key}>
                  <Link href={paths.games(lang, `?genre=${g.key}`)} className="flex min-h-16 items-baseline justify-between gap-[var(--space-md)] py-[var(--space-md)] hover:text-accent-deep">
                    <span className="font-display text-[length:var(--text-title)] leading-tight">{t(genreLabelKey(g.key))}</span>
                    <span className="shrink-0 text-sm text-muted">{t("games.count", { n: games.filter((x) => x.genres.includes(g.key)).length })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {beginner.length > 0 && (
        <section className="section" aria-labelledby="new-h">
          <div className="wrap grid gap-[var(--space-2xl)] lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h2 id="new-h">{t("home.newTitle")}</h2>
              <p className="lead mt-[var(--space-md)]">{t("home.newBody")}</p>
              <p className="mt-[var(--space-xl)]"><Link href={paths.games(lang, "?level=beginner")} className="btn btn-primary">{t("home.moreBeginner")}</Link></p>
            </div>
            <ul className="ruled lg:col-span-6 lg:col-start-7">
              {beginner.map((g) => <li key={g.id}><GameRow game={g} t={t} lang={lang} /></li>)}
            </ul>
          </div>
        </section>
      )}

      <section className="section pt-0" aria-labelledby="steps-h">
        <div className="wrap grid gap-[var(--space-2xl)] lg:grid-cols-12">
          <h2 id="steps-h" className="lg:col-span-4">{t("nav.how")}</h2>
          <ol className="steps ruled lg:col-span-8">
            {steps.map((s) => (
              <li key={s.title} className="grid gap-[var(--space-xs)] py-[var(--space-lg)] sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-x-[var(--space-lg)]">
                <h3 className="sm:col-start-2">{s.title}</h3>
                <p className="text-ink-2 sm:col-start-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="band-ink section" aria-labelledby="gm-h">
        <div className="wrap grid items-center gap-[var(--space-2xl)] lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 id="gm-h">{t("home.gmCtaTitle")}</h2>
            <p className="lead mt-[var(--space-md)]">{t("home.gmCtaBody")}</p>
            <p className="mt-[var(--space-xl)]"><Link href={paths.list(lang)} className="btn btn-primary">{t("nav.list")}</Link></p>
          </div>
          <div className="halftone hidden min-h-64 lg:col-span-4 lg:col-start-9 lg:block" aria-hidden />
        </div>
      </section>
    </>
  );
}
