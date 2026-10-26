import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactButtons } from "@/components/contact-buttons";
import { Icon } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { Avatar, Cover, languageLabel, priceLabel, whereLabel } from "@/components/ui";
import { genreIcon, genreLabelKey, isGenre, isStyle, styleIcon, styleLabelKey } from "@/lib/categories";
import { contactMessage, encodeContact } from "@/lib/contact";
import { gmById, loadSiteData } from "@/lib/data";
import { formatDay, formatWhen } from "@/lib/format";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import type { RegularIcon } from "@/lib/icons";
import { REPORT_URL, SITE_URL } from "@/lib/site";
import { slugParams } from "@/lib/static-params";
import { breadcrumbJsonLd, gameJsonLd, languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return slugParams(loadSiteData().games);
}

export async function generateMetadata({ params }: PageProps<"/[lang]/games/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const game = isLang(lang) ? loadSiteData().games.find((g) => g.slug === slug) : undefined;
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
  const game = data.games.find((g) => g.slug === slug);
  const gm = game ? gmById(data, game.gmId) : undefined;
  if (!game || !gm) notFound();
  const t = makeT(lang);
  const genres = game.genres.filter(isGenre);
  const styles = game.styles.filter(isStyle);

  const facts: { icon: RegularIcon; label: string; value: React.ReactNode }[] = [
    { icon: "calendar-clock", label: t("game.when"), value: formatWhen(game.startsAt, lang, game.zone) },
    { icon: game.locationType === "online" ? "laptop" : "marker", label: t("game.where"), value: (
      <>
        {game.locationType === "online" ? whereLabel(game, t) : <>{game.venueName ? <span className="block font-semibold">{game.venueName}</span> : null}{game.city}</>}
        {game.locationType === "in_person" && game.venueName && game.venueMapsUrl && (
          <a href={game.venueMapsUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 flex min-h-11 items-center gap-1 font-semibold text-accent hover:underline" data-testid="venue-maps">
            <Icon name="marker" /> {t("game.openMaps")} <span className="sr-only">{t("a11y.opensNewTab")}</span>
          </a>
        )}
      </>
    ) },
    { icon: game.format === "campaign" ? "scroll-old" : "book-open-cover", label: t("game.format"), value: t(game.format === "campaign" ? "format.campaign" : "format.one_shot") },
    { icon: "users", label: t("game.seats"), value: t("common.seats", { n: game.seats }) },
    { icon: "coins", label: t("game.price"), value: <><span className="font-semibold">{priceLabel(game.priceIdr, t)}</span>{game.priceIdr > 0 && <> {t("common.perSeat")}</>}<span className="block text-sm text-muted">{t("game.priceNote")}</span></> },
    { icon: "language", label: t("game.language"), value: languageLabel(game.language, t) },
    { icon: "seedling", label: t("game.level"), value: <>{t(game.level === "beginner" ? "level.beginner" : game.level === "experienced" ? "level.experienced" : "level.any")}{game.minAge > 0 && <> · {t("game.ages", { n: game.minAge })}</>}</> },
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
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <Link href={paths.games(lang)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-text"><Icon name="arrow-left" /> {t("game.allGames")}</Link>

        <div className="mt-2 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <div className="flex gap-5 max-sm:flex-col">
              <Cover src={game.cover} seed={game.title} priority sizes="(min-width: 640px) 220px, 100vw" className="aspect-[4/5] w-full shrink-0 rounded-xl border border-border max-sm:max-w-[200px] sm:w-56" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="chip">{game.system}</span>
                  {game.featured && <span className="chip border-accent/40! text-accent!"><Icon name="star" solid /> {t("game.featured")}</span>}
                </p>
                <h1 className="mt-2 text-3xl font-bold leading-tight">{game.title}</h1>
                {game.summary && <p className="mt-2 text-lg text-muted">{game.summary}</p>}
                <Link href={paths.gm(lang, gm.slug)} className="mt-4 inline-flex min-h-11 items-center gap-2.5 rounded-lg hover:text-accent">
                  <Avatar name={gm.name} photo={gm.photo} size={40} />
                  <span><span className="block text-xs text-muted">{t("game.gm")}</span><span className="font-semibold">{gm.name}</span></span>
                </Link>
                <p className="mt-3 lg:hidden"><a href="#contact" className="btn-primary"><Icon name="comment" /> {t("game.contactTitle")}</a></p>
              </div>
            </div>

            <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-base text-accent"><Icon name={f.icon} /></span>
                    {f.label}
                  </dt>
                  <dd className="mt-1 pl-12">{f.value}</dd>
                </div>
              ))}
            </dl>

            {(genres.length > 0 || styles.length > 0) && (
              <ul className="mt-6 flex flex-wrap gap-1.5">
                {genres.map((g) => <li key={g} className="chip"><Icon name={genreIcon(g)} />{t(genreLabelKey(g))}</li>)}
                {styles.map((s) => <li key={s} className="chip"><Icon name={styleIcon(s)} />{t(styleLabelKey(s))}</li>)}
              </ul>
            )}

            <section className="mt-10" aria-labelledby="about-h">
              <h2 id="about-h" className="text-2xl font-bold">{t("game.about")}</h2>
              <div className="mt-3 max-w-3xl space-y-3">
                {game.description.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
              </div>
            </section>

            {game.scheduleNote && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">{t("game.schedule")}</h2>
                <p className="mt-2 max-w-3xl whitespace-pre-line">{game.scheduleNote}</p>
              </section>
            )}

            <section className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="text-xl font-bold">{t("game.cw")}</h2>
                <p className="mt-2 whitespace-pre-line text-muted">{game.contentWarnings || t("game.cwNone")}</p>
              </div>
              <div>
                <h2 className="text-xl font-bold">{t("game.safety")}</h2>
                <p className="mt-2 text-muted">{game.safetyTools || t("game.safetyNone")}</p>
              </div>
            </section>
            <p className="mt-8 text-sm text-muted">{t("game.listedUntil", { date: formatDay(game.expiresAt, lang, game.zone) })}</p>
          </div>

          <aside id="contact" className="lg:sticky lg:top-24 lg:self-start" aria-labelledby="contact-h">
            <div className="card p-6">
              <h2 id="contact-h" className="text-xl font-bold">{t("game.contactTitle")}</h2>
              <p className="mt-2 text-sm text-muted">{t("game.contactBody")}</p>
              <div className="mt-4"><ContactButtons wa={encodeContact(gm.whatsapp)} discord={gm.discord} message={contactMessage(gm, game, lang)} stacked /></div>
              <p className="mt-5 flex gap-2 border-t border-border pt-4 text-sm text-muted"><Icon name="shield-check" className="mt-0.5 shrink-0 text-gold" /><span>{t("game.safetyNote")}</span></p>
              {REPORT_URL && (
                <p className="mt-3"><a href={REPORT_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted underline hover:text-text"><Icon name="flag" /> {t("game.report")} <span className="sr-only">{t("a11y.opensNewTab")}</span></a></p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}
