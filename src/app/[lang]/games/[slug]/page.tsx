import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactButtons } from "@/components/contact-buttons";
import { Gone, goneMetadata } from "@/components/gone";
import { JsonLd } from "@/components/json-ld";
import { Avatar, Cover, languageLabel, priceLabel, whereLabel } from "@/components/ui";
import { genreLabelKey, isGenre, isMechanic, isStyle, mechanicLabelKey, styleLabelKey } from "@/lib/categories";
import { contactMessage, encodeContact } from "@/lib/contact";
import { gmById, loadSiteData } from "@/lib/data";
import { formatDay, formatWhen } from "@/lib/format";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import { REPORT_URL, SITE_URL } from "@/lib/site";
import { slugParams } from "@/lib/static-params";
import { breadcrumbJsonLd, gameJsonLd, languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  const { games, goneGames } = loadSiteData();
  return slugParams([...games, ...goneGames.map((slug) => ({ slug }))]);
}

export async function generateMetadata({ params }: PageProps<"/[lang]/games/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const data = loadSiteData();
  if (isLang(lang) && data.goneGames.includes(slug)) return goneMetadata("game", lang);
  const game = isLang(lang) ? data.games.find((g) => g.slug === slug) : undefined;
  if (!game || !isLang(lang)) return {};
  return {
    title: game.title,
    description: game.summary || undefined,
    alternates: languageAlternates(lang, `/games/${game.slug}/`),
    openGraph: { title: game.title, description: game.summary || undefined, type: "website", images: game.cover ? [{ url: game.cover }] : undefined },
  };
}

export default async function GamePage({ params }: PageProps<"/[lang]/games/[slug]">) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();
  const data = loadSiteData();
  if (data.goneGames.includes(slug)) return <Gone kind="game" lang={lang} />;
  const game = data.games.find((g) => g.slug === slug);
  const gm = game ? gmById(data, game.gmId) : undefined;
  if (!game || !gm) notFound();
  const t = makeT(lang);
  const genres = game.genres.filter(isGenre);
  const styles = game.styles.filter(isStyle);
  const mechanics = game.mechanics.filter(isMechanic);

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t("game.when"), value: formatWhen(game.startsAt, lang, game.zone) },
    { label: t("game.where"), value: (
      <>
        {game.locationType === "online" ? whereLabel(game, t) : <>{game.venueName ? <span className="block">{game.venueName}</span> : null}{game.city}</>}
        {game.locationType === "in_person" && game.venueName && game.venueMapsUrl && (
          <small>
            <a href={game.venueMapsUrl} target="_blank" rel="noopener noreferrer nofollow" className="link-spot inline-flex min-h-11 items-center font-bold text-ink" data-testid="venue-maps">
              {t("game.openMaps")} <span className="sr-only">{t("a11y.opensNewTab")}</span>
            </a>
          </small>
        )}
      </>
    ) },
    { label: t("game.format"), value: t(game.format === "campaign" ? "format.campaign" : "format.one_shot") },
    { label: t("game.seats"), value: t("common.seats", { n: game.seats }) },
    { label: t("game.price"), value: <>{priceLabel(game.priceIdr, t)}{game.priceIdr > 0 && <> {t("common.perSeat")}</>}<small>{t("game.priceNote")}</small></> },
    { label: t("game.language"), value: languageLabel(game.language, t) },
    { label: t("game.level"), value: <>{t(game.level === "beginner" ? "level.beginner" : game.level === "experienced" ? "level.experienced" : "level.any")}{game.minAge > 0 && <small>{t("game.ages", { n: game.minAge })}</small>}</> },
  ];

  return (
    <article>
      <JsonLd data={[
        gameJsonLd(game, gm, lang),
        breadcrumbJsonLd([
          { name: "Quest Board TPK", url: `${SITE_URL}${paths.home(lang)}` },
          { name: t("games.title"), url: `${SITE_URL}${paths.games(lang)}` },
          { name: game.title, url: `${SITE_URL}${paths.game(lang, game.slug)}` },
        ]),
      ]} />
      <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-lg)]">
        <Link href={paths.games(lang)} className="link-spot inline-flex min-h-11 items-center font-bold">{t("game.allGames")}</Link>

        <div className="mt-[var(--space-lg)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-4">
            <Cover src={game.cover} seed={game.title} priority sizes="(min-width: 1024px) 30vw, 100vw" className="aspect-[4/5] w-full max-sm:max-w-xs" />
          </div>

          <div className="min-w-0 lg:col-span-8">
            <p className="flex flex-wrap items-center gap-[var(--space-xs)]">
              <span className="chip">{game.system}</span>
              {game.full && <span className="chip chip-spot" data-testid="full-chip">{t("game.full")}</span>}
            </p>
            <h1 className="mt-[var(--space-md)] max-w-none text-[length:var(--text-display-s)]">{game.title}</h1>
            {game.summary && <p className="lead mt-[var(--space-md)] text-ink-2">{game.summary}</p>}
            <Link href={paths.gm(lang, gm.slug)} className="mt-[var(--space-lg)] inline-flex min-h-11 items-center gap-[var(--space-md)] hover:text-accent-deep">
              <Avatar name={gm.name} photo={gm.photo} size={48} />
              <span><span className="block text-sm text-muted">{t("game.gm")}</span><span className="font-bold">{gm.name}</span></span>
            </Link>
            <p className="mt-[var(--space-lg)] lg:hidden"><a href="#contact" className="btn btn-primary">{t("game.contactTitle")}</a></p>

            <aside id="contact" className="well mt-[var(--space-xl)] scroll-mt-[var(--space-xl)]" aria-labelledby="contact-h">
              <h2 id="contact-h" className="max-w-none text-[length:var(--text-title)]">{t("game.contactTitle")}</h2>
              <p className="mt-[var(--space-sm)] text-ink-2">{t("game.contactBody")}</p>
              {game.full && <p className="mt-[var(--space-md)] bg-accent px-[var(--space-md)] py-[var(--space-sm)] font-bold text-accent-ink" data-testid="full-note">{t("game.fullNote")}</p>}
              <div className="mt-[var(--space-lg)]"><ContactButtons wa={encodeContact(gm.whatsapp)} discord={gm.discord} message={contactMessage(gm, game, lang)} /></div>
              <p className="mt-[var(--space-lg)] border-t border-rule pt-[var(--space-md)] text-sm text-ink-2">{t("game.safetyNote")}</p>
              {REPORT_URL && (
                <p className="mt-[var(--space-sm)]"><a href={REPORT_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-deep">{t("game.report")} <span className="sr-only">{t("a11y.opensNewTab")}</span></a></p>
              )}
            </aside>

            <dl className="panel mt-[var(--space-xl)] lg:grid lg:grid-cols-2 lg:gap-x-[var(--gap-columns)] lg:[&>div:last-child]:col-span-2">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>


            {(genres.length > 0 || styles.length > 0 || mechanics.length > 0) && (
              <ul className="mt-[var(--space-xl)] flex flex-wrap gap-[var(--space-xs)]">
                {genres.map((g) => <li key={g} className="chip">{t(genreLabelKey(g))}</li>)}
                {styles.map((s) => <li key={s} className="chip">{t(styleLabelKey(s))}</li>)}
                {mechanics.map((m) => <li key={m} className="chip">{t(mechanicLabelKey(m))}</li>)}
              </ul>
            )}
          </div>
        </div>

        <section className="ruled mt-[var(--section-gap-s)]" aria-label={t("game.about")}>
          <div className="grid gap-x-[var(--gap-columns)] gap-y-[var(--space-md)] py-[var(--space-xl)] lg:grid-cols-12">
            <h2 id="about-h" className="max-w-none text-[length:var(--text-section)] lg:col-span-4">{t("game.about")}</h2>
            <div className="max-w-[65ch] space-y-[var(--space-md)] lg:col-span-8">
              {game.description.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
            </div>
          </div>

          {game.scheduleNote && (
            <div className="grid gap-x-[var(--gap-columns)] gap-y-[var(--space-md)] py-[var(--space-xl)] lg:grid-cols-12">
              <h2 className="max-w-none text-[length:var(--text-section)] lg:col-span-4">{t("game.schedule")}</h2>
              <p className="max-w-[65ch] whitespace-pre-line lg:col-span-8">{game.scheduleNote}</p>
            </div>
          )}

          <div className="grid gap-x-[var(--gap-columns)] gap-y-[var(--space-md)] py-[var(--space-xl)] lg:grid-cols-12">
            <h2 className="max-w-none text-[length:var(--text-section)] lg:col-span-4">{t("game.cw")}</h2>
            <p className="max-w-[65ch] whitespace-pre-line lg:col-span-8">{game.contentWarnings || t("game.cwNone")}</p>
          </div>

          <div className="grid gap-x-[var(--gap-columns)] gap-y-[var(--space-md)] py-[var(--space-xl)] lg:grid-cols-12">
            <h2 className="max-w-none text-[length:var(--text-section)] lg:col-span-4">{t("game.safety")}</h2>
            <p className="max-w-[65ch] lg:col-span-8">{game.safetyTools || t("game.safetyNone")}</p>
          </div>
        </section>
        <p className="mt-[var(--space-lg)] text-sm text-muted">{t("game.listedUntil", { date: formatDay(game.expiresAt, lang, game.zone) })}</p>
      </div>
    </article>
  );
}
