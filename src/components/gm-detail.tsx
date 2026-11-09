"use client";

import Link from "next/link";
import { useEffect } from "react";
import { contactMessage } from "@/lib/contact";
import { formatDay } from "@/lib/format";
import { gameViewsOf, type GameView } from "@/lib/games";
import { paths } from "@/lib/hrefs";
import type { SiteGm } from "@/lib/types";
import { ContactButtons } from "./contact-buttons";
import { NotFound } from "./game-detail";
import { GoneNotice } from "./gone-notice";
import { useI18n } from "./i18n-provider";
import { ReportButton } from "./report-button";
import { Avatar, GameCard, gmCityLabel } from "./ui";
import { useLive } from "./use-live";

/** One Game Master's page, following the live data like GameDetail does. `initial` is what the build knew; null for a profile the build never saw. */
export function GmDetail({ slug, initial, onFound }: { slug: string; initial: { gm: SiteGm; games: GameView[] } | null; onFound?: () => void }) {
  const { t, lang } = useI18n();
  const live = useLive({ gms: initial ? [initial.gm] : [], games: initial?.games ?? [] });
  const gm = live ? live.gms.find((m) => m.slug === slug) : initial?.gm;
  const games = live ? gameViewsOf(live).filter((g) => g.gmId === gm?.id) : (initial?.games ?? []);
  const isNew = !initial && Boolean(gm);
  useEffect(() => { if (isNew) onFound?.(); }, [isNew, onFound]);

  if (!gm) {
    if (!live && !initial) return <div className="wrap py-[var(--section-gap-s)]"><p role="status" className="lead text-ink-2">{t("view.loading")}</p></div>;
    if (initial) return <GoneNotice kind="gm" lang={lang} t={t} />;
    return <NotFound kind="gm" />;
  }
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-lg)]">
      <Link href={paths.gms(lang)} className="link-spot inline-flex min-h-11 items-center font-medium">{t("gm.title")}</Link>
      <header className="mt-[var(--space-lg)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] lg:grid-cols-12">
        <div className="w-40 min-w-0 sm:w-52 lg:col-span-3 lg:w-full"><Avatar name={gm.name} photo={gm.photo} size={288} priority /></div>
        <div className="min-w-0 lg:col-span-9">
          <h1 className="max-w-none text-[length:var(--text-display-s)]">{gm.name}</h1>
          {gm.city && <p className="lead mt-[var(--space-sm)] text-ink-2">{gmCityLabel(gm.city, t)}</p>}
          <p className="mt-[var(--space-xs)] text-sm text-muted" data-testid="gm-trust">
            {[gm.joinedAt ? t("gm.memberSince", { date: formatDay(gm.joinedAt, lang, "WIB") }) : "", t("gm.gamesListed", { n: games.length }), gm.verified ? t("gm.verified") : ""].filter(Boolean).join(" · ")}
          </p>
          {gm.systems.length > 0 && (
            <p className="mt-[var(--space-lg)] flex flex-wrap items-center gap-[var(--space-xs)]"><span className="font-medium">{t("gm.systems")}:</span>{gm.systems.map((x) => <span key={x} className="chip">{x}</span>)}</p>
          )}
          {gm.bio && <div className="mt-[var(--space-lg)] max-w-[65ch] space-y-[var(--space-md)]">{gm.bio.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>}
          <h2 className="mt-[var(--space-xl)] max-w-none text-[length:var(--text-title)]">{t("gm.contact")}</h2>
          <div className="mt-[var(--space-md)]"><ContactButtons gmId={gm.id} discord={gm.discord} instagram={gm.instagram} message={contactMessage(gm, null, lang)} /></div>
          <ReportButton kind="gm" id={gm.id} />
        </div>
      </header>

      <section className="mt-[var(--space-2xl)] border-t border-rule pt-[var(--space-xl)]" aria-labelledby="gm-games-h">
        <h2 id="gm-games-h" className="max-w-none text-[length:var(--text-2xl)]">{t("gm.gamesTitle")}</h2>
        {games.length === 0 ? (
          <p className="mt-[var(--space-md)] text-muted">{t("gm.noGames")}</p>
        ) : (
          <ul className="mt-[var(--space-lg)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] max-sm:gap-y-[var(--space-sm)] sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g, i) => <li key={g.id}><GameCard game={g} t={t} lang={lang} priority={i < 6} rowOnPhone /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
