"use client";

import Link from "next/link";
import { useEffect, ViewTransition } from "react";
import { genreLabelKey, isGenre, isMechanic, isStyle, mechanicLabelKey, styleLabelKey } from "@/lib/categories";
import { contactMessage } from "@/lib/contact";
import { formatDay, formatShortDay, formatWhen } from "@/lib/format";
import { paths } from "@/lib/hrefs";
import type { SiteGame, SiteGm } from "@/lib/types";
import { ContactButtons } from "./contact-buttons";
import { GoneNotice } from "./gone-notice";
import { useI18n } from "./i18n-provider";
import { ReportButton } from "./report-button";
import { StickyContact } from "./sticky-contact";
import { Avatar, Cover, languageLabel, priceLabel, whereLabel } from "./ui";
import { useLive } from "./use-live";

/**
 * One game's page. `initial` is what the last build knew (it is also what the static HTML shows); once the live data arrives, what it says wins: new
 * seats, price or words appear within a minute, a game that has ended or was taken down turns into the "no longer listed" notice, and a game the build
 * never saw (`initial` null, reached through the /view/ page) appears as soon as it is live.
 * `onFound` is called once a game is on screen that the page was not built with.
 */
export function GameDetail({ slug, initial, onFound }: { slug: string; initial: { game: SiteGame; gm: SiteGm } | null; onFound?: () => void }) {
  const { t, lang } = useI18n();
  const live = useLive({ games: initial ? [initial.game] : [], gms: initial ? [initial.gm] : [] });
  const found = live ? live.games.find((g) => g.slug === slug) : initial?.game;
  const owner = live ? (found ? live.gms.find((m) => m.id === found.gmId) : undefined) : initial?.gm;
  const game = found && owner ? found : undefined;
  const gm = game ? owner : undefined;
  const isNew = !initial && Boolean(game);
  useEffect(() => { if (isNew) onFound?.(); }, [isNew, onFound]);

  if (!game || !gm) {
    if (!live && !initial) return <div className="wrap py-[var(--section-gap-s)]"><p role="status" className="lead text-ink-2">{t("view.loading")}</p></div>;
    if (initial) return <GoneNotice kind="game" lang={lang} t={t} />;
    return <NotFound kind="game" />;
  }

  const genres = game.genres.filter(isGenre);
  const styles = game.styles.filter(isStyle);
  const mechanics = game.mechanics.filter(isMechanic);

  // `wide`: on a phone the facts sit two to a row; these take the whole row.
  const priceText = `${priceLabel(game.priceIdr, t)}${game.priceIdr > 0 ? ` ${t("common.perSeat")}` : ""}`;
  const facts: { label: string; value: React.ReactNode; wide?: boolean }[] = [
    { label: t("game.when"), wide: true, value: formatWhen(game.startsAt, lang, game.zone) },
    { label: t("game.where"), wide: true, value: (
      <>
        {game.locationType === "online" ? whereLabel(game, t) : <>{game.venueName ? <span className="block">{game.venueName}</span> : null}{game.city}</>}
        {game.locationType === "in_person" && game.venueName && game.venueMapsUrl && (
          <small>
            <a href={game.venueMapsUrl} target="_blank" rel="noopener noreferrer nofollow" className="link-spot inline-flex min-h-11 items-center font-medium text-ink" data-testid="venue-maps">
              {t("game.openMaps")} <span className="sr-only">{t("a11y.opensNewTab")}</span>
            </a>
          </small>
        )}
      </>
    ) },
    { label: t("game.format"), value: t(game.format === "campaign" ? "format.campaign" : "format.one_shot") },
    { label: t("game.seats"), value: t("common.seats", { n: game.seats }) },
    { label: t("game.price"), wide: true, value: <>{priceLabel(game.priceIdr, t)}{game.priceIdr > 0 && <> {t("common.perSeat")}</>}<small>{t("game.priceNote")}</small></> },
    { label: t("game.language"), value: languageLabel(game.language, t) },
    { label: t("game.level"), value: <>{t(game.level === "beginner" ? "level.beginner" : game.level === "experienced" ? "level.experienced" : "level.any")}{game.minAge > 0 && <small>{t("game.ages", { n: game.minAge })}</small>}</> },
  ];
  const message = contactMessage(gm, game, lang);

  return (
    <article>
      <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-lg)] max-lg:pb-[calc(var(--tabbar-h)+6rem)]">
        <Link href={paths.games(lang)} className="link-spot inline-flex min-h-11 items-center font-medium">{t("game.allGames")}</Link>

        <div className="mt-[var(--space-lg)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] lg:grid-cols-12">
          {/* From 1024 px two columns: the cover with the facts under it, and the title, contact and the text beside. Below that the four blocks (display: contents) stack in the order 1 to 4. */}
          <div className="contents lg:block lg:col-span-4">
            <div className="order-1 min-w-0 lg:order-none">
              <ViewTransition name={`cover-${game.slug}`}>
                <Cover src={game.cover} seed={game.title} priority sizes="(min-width: 1024px) 30vw, 100vw" className="aspect-[4/5] w-full max-sm:aspect-[3/2]" />
              </ViewTransition>
            </div>

            <dl className="panel order-3 lg:order-none lg:mt-[var(--space-lg)]">
              {facts.map((f) => (
                <div key={f.label} className={f.wide ? "wide" : undefined}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="contents lg:block lg:col-span-8">
          <div className="order-2 min-w-0 lg:order-none">
            <p className="flex flex-wrap items-center gap-[var(--space-xs)]">
              <span className="chip">{game.system}</span>
              {game.full && <span className="chip chip-spot" data-testid="full-chip">{t("game.full")}</span>}
            </p>
            <h1 className="mt-[var(--space-md)] max-w-none text-[length:var(--text-display-s)] max-sm:text-[2.125rem] max-sm:leading-[1.1]">{game.title}</h1>
            {game.summary && <p className="lead mt-[var(--space-md)] text-ink-2">{game.summary}</p>}
            <Link href={paths.gm(lang, gm.slug)} className="mt-[var(--space-lg)] inline-flex min-h-11 items-center gap-[var(--space-md)] hover:text-accent-deep">
              <Avatar name={gm.name} photo={gm.photo} size={48} />
              <span><span className="block text-sm text-muted">{t("game.gm")}</span><span className="font-medium">{gm.name}</span></span>
            </Link>

            <aside id="contact" className="well mt-[var(--space-xl)] scroll-mt-[var(--space-xl)]" aria-labelledby="contact-h">
              <h2 id="contact-h" className="max-w-none text-[length:var(--text-title)]">{t("game.contactTitle")}</h2>
              <p className="mt-[var(--space-sm)] text-ink-2">{t("game.contactBody")}</p>
              {game.full && <p className="mt-[var(--space-md)] bg-accent px-[var(--space-md)] py-[var(--space-sm)] font-medium text-accent-ink" data-testid="full-note">{t("game.fullNote")}</p>}
              <div className="mt-[var(--space-lg)]"><ContactButtons gmId={gm.id} discord={gm.discord} instagram={gm.instagram} message={message} /></div>
              <p className="mt-[var(--space-lg)] border-t border-rule pt-[var(--space-md)] text-sm text-ink-2">{t("game.safetyNote")}</p>
              <ReportButton kind="game" id={game.id} />
            </aside>

          </div>

          <div className="order-4 min-w-0 lg:order-none lg:mt-[var(--space-xl)]">
            <section aria-labelledby="about-h">
              <h2 id="about-h" className="max-w-none text-[length:var(--text-xl)]">{t("game.about")}</h2>
              <div className="mt-[var(--space-sm)] max-w-[65ch] space-y-[var(--space-md)]">
                {game.description.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
              </div>
            </section>

            {game.scheduleNote && (
              <section aria-labelledby="schedule-h" className="mt-[var(--space-xl)] border-t border-rule pt-[var(--space-lg)]">
                <h2 id="schedule-h" className="max-w-none text-[length:var(--text-xl)]">{t("game.schedule")}</h2>
                <p className="mt-[var(--space-sm)] max-w-[65ch] whitespace-pre-line">{game.scheduleNote}</p>
              </section>
            )}

            <div className="mt-[var(--space-xl)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-lg)] border-t border-rule pt-[var(--space-lg)] md:grid-cols-2">
              <section aria-labelledby="cw-h">
                <h2 id="cw-h" className="max-w-none text-[length:var(--text-xl)]">{t("game.cw")}</h2>
                <p className="mt-[var(--space-sm)] whitespace-pre-line">{game.contentWarnings || t("game.cwNone")}</p>
              </section>
              <section aria-labelledby="safety-h">
                <h2 id="safety-h" className="max-w-none text-[length:var(--text-xl)]">{t("game.safety")}</h2>
                <p className="mt-[var(--space-sm)]">{game.safetyTools || t("game.safetyNone")}</p>
              </section>
            </div>

            {(genres.length > 0 || styles.length > 0 || mechanics.length > 0) && (
              <ul className="mt-[var(--space-xl)] flex flex-wrap gap-[var(--space-xs)]">
                {genres.map((g) => <li key={g} className="chip">{t(genreLabelKey(g))}</li>)}
                {styles.map((s) => <li key={s} className="chip">{t(styleLabelKey(s))}</li>)}
                {mechanics.map((m) => <li key={m} className="chip">{t(mechanicLabelKey(m))}</li>)}
              </ul>
            )}
            <p className="mt-[var(--space-xl)] text-sm text-muted">{t("game.listedUntil", { date: formatDay(game.expiresAt, lang, game.zone) })}</p>
          </div>
          </div>
        </div>
      </div>
      {!game.full && (
        <StickyContact gmId={gm.id} discord={gm.discord} instagram={gm.instagram} message={message} targetId="contact" price={priceText} when={formatShortDay(game.startsAt, lang, game.zone)} />
      )}
    </article>
  );
}

/** A listing nobody knows (a wrong address, or one removed long ago): not a "no longer listed" notice, which would claim it once existed. */
export function NotFound({ kind }: { kind: "game" | "gm" }) {
  const { t, lang } = useI18n();
  return (
    <div className="wrap py-[var(--section-gap-s)]" data-testid="listing-not-found">
      <div className="ruled flex flex-col items-start gap-[var(--space-md)] pt-[var(--space-xl)]">
        <h1 className="max-w-[18ch] text-[length:var(--text-display-s)]">{t("view.notFoundTitle")}</h1>
        <p className="lead max-w-[52ch] text-ink-2">{t("view.notFoundBody")}</p>
        <Link href={kind === "game" ? paths.games(lang) : paths.gms(lang)} className="btn btn-primary mt-[var(--space-md)]">{t(kind === "game" ? "gone.gamesLink" : "gone.gmsLink")}</Link>
      </div>
    </div>
  );
}
