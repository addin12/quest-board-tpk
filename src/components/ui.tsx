import Link from "next/link";
import { Picture } from "./picture";
import type { GameView } from "@/lib/games";
import type { T } from "@/lib/i18n/core";
import type { Lang, SiteGm } from "@/lib/types";
import { genreLabelKey, isGenre } from "@/lib/categories";
import { formatIdr, formatShortDay, initialsOf } from "@/lib/format";
import { paths, smallCover } from "@/lib/hrefs";
import { Icon } from "./icon";

// Presentational pieces shared by server pages and the client-side games list. Anything that needs words takes `t`.

/** A steady number from any text: it picks the solid field behind a picture that is missing. */
export function hueOf(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
const fieldOf = (text: string) => (hueOf(text) % 2 === 0 ? "bg-ink text-paper" : "bg-accent text-accent-ink");

/** A 4:5 cover (like an Instagram post). With no picture it is a solid field with the title set big. */
export function Cover({ src, seed, className = "", priority = false, sizes }: { src: string | null; seed: string; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={`plate ${src ? "" : `${fieldOf(seed)} flex items-end p-[var(--space-md)]`} ${className}`}>
      {src ? (
        <Picture src={src} priority={priority} sizes={sizes ?? "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"} />
      ) : (
        <span aria-hidden className="font-display text-[length:var(--text-title)] leading-tight">{seed}</span>
      )}
    </div>
  );
}

/** A GM's photo (square), or their initials on a solid field. */
export function Avatar({ name, photo, size = 36, priority = false }: { name: string; photo: string | null; size?: number; priority?: boolean }) {
  if (photo) {
    return (
      <span aria-hidden className="plate inline-block shrink-0" style={{ width: size, maxWidth: "100%", aspectRatio: "1" }}>
        <Picture src={photo} sizes={`${size}px`} priority={priority} />
      </span>
    );
  }
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center font-display ${fieldOf(name)}`} style={{ width: size, maxWidth: "100%", aspectRatio: "1", fontSize: size * 0.4 }}>
      {initialsOf(name)}
    </span>
  );
}

export const priceLabel = (amount: number, t: T): string => (amount === 0 ? t("common.free") : formatIdr(amount));

export function languageLabel(language: "id" | "en" | "both", t: T): string {
  return t(language === "id" ? "lang.gameId" : language === "en" ? "lang.gameEn" : "lang.gameBoth");
}

/** Where a game is played, as one line: the venue and city, "Online (Discord)", or just the city. */
export function whereLabel(g: Pick<GameView, "locationType" | "platform" | "city" | "venueName">, t: T): string {
  if (g.locationType === "online") return g.platform ? t("game.online", { platform: g.platform }) : t("game.onlineNoPlatform");
  return g.venueName ? `${g.venueName}, ${g.city}` : g.city;
}

/**
 * A game as a playbill: the cover, then a ruled label panel. `preview` draws it without a link (the admin page shows cards
 * for games that are not on the site yet).
 * `priority`: the picture is among the first things a visitor sees, so it loads first. `headingLevel`: 2 where the page has no h2 above the cards.
 */
export function GameCard({ game, t, lang, preview = false, priority = false, headingLevel = 3 }: { game: GameView; t: T; lang: Lang; preview?: boolean; priority?: boolean; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const genre = game.genres.find(isGenre);
  const rows: [string, string][] = [
    [t("game.when"), formatShortDay(game.startsAt, lang, game.zone)],
    [t("game.where"), game.locationType === "online" ? t("loc.online") : whereLabel(game, t)],
    [t("game.format"), t(game.format === "campaign" ? "format.campaign" : "format.one_shot")],
    [t("game.language"), languageLabel(game.language, t)],
  ];
  if (game.level === "beginner") rows.push([t("game.level"), t("level.beginner")]);
  else if (genre) rows.push([t("games.genre"), t(genreLabelKey(genre))]);
  const body = (
    <>
      <div className="relative">
        <Cover src={game.cover ? smallCover(game.cover) : null} seed={game.title} className="aspect-[4/5] w-full" priority={priority} />
        {game.featured && <span className="absolute left-0 top-0 bg-accent px-3 py-1 text-sm font-bold text-accent-ink">{t("game.featured")}</span>}
        {game.full && <span className="absolute bottom-0 right-0 bg-ink px-3 py-1 text-sm font-bold text-paper">{t("game.full")}</span>}
      </div>
      <div className="mt-[var(--space-md)] flex flex-1 flex-col border-t-3 border-ink pt-[var(--space-sm)]">
        <Heading className="bill-title">{game.title}</Heading>
        <p className="mt-[var(--space-xs)] flex flex-wrap items-baseline justify-between gap-x-[var(--space-md)]">
          <span className="min-w-0 font-bold">{game.system}</span>
          <span className="shrink-0 text-right font-bold">
            {priceLabel(game.priceIdr, t)}
            {game.priceIdr > 0 && <small className="ml-1 text-sm font-normal text-muted">{t("common.perSeat")}</small>}
          </span>
        </p>
        <p className="mt-[var(--space-xs)] text-muted">{game.summary}</p>
        {/* mt-auto: the facts sit at the foot of the card, so the rows line up across a row of cards whatever the title and summary lengths. */}
        <dl className="mt-auto pt-[var(--space-md)]">
          {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        <p className="pt-[var(--space-sm)] text-sm text-muted">{t("common.by", { name: game.gmName })}</p>
      </div>
    </>
  );
  const cls = "bill tack";
  return preview ? <div className={cls}>{body}</div> : <Link href={paths.game(lang, game.slug)} className={cls}>{body}</Link>;
}

/** A game as one row of an index: a small cover, the title and its facts, the price at the edge. */
export function GameRow({ game, t, lang }: { game: GameView; t: T; lang: Lang }) {
  return (
    <Link href={paths.game(lang, game.slug)} className="bill !h-auto flex-row items-center gap-[var(--space-lg)] py-[var(--space-lg)]">
      <Cover src={game.cover ? smallCover(game.cover) : null} seed={game.title} className="aspect-[4/5] w-20 shrink-0 sm:w-24" sizes="96px" />
      <div className="min-w-0 flex-1">
        <h3 className="bill-title">{game.title}</h3>
        <p className="mt-[var(--space-2xs)] font-bold">{game.system}</p>
        <p className="mt-[var(--space-2xs)] text-muted">{`${formatShortDay(game.startsAt, lang, game.zone)}, ${game.locationType === "online" ? t("loc.online") : whereLabel(game, t)}`}</p>
      </div>
      <span className="shrink-0 text-right font-bold">{priceLabel(game.priceIdr, t)}</span>
    </Link>
  );
}

/** A GM as one row of an index: their photo, their name set as a title, where they play and what. */
export function GmCard({ gm, openGames, t, lang, priority = false }: { gm: SiteGm; openGames: number; t: T; lang: Lang; priority?: boolean }) {
  return (
    <Link href={paths.gm(lang, gm.slug)} className="bill !h-auto flex-row items-start gap-[var(--space-lg)] py-[var(--space-lg)]">
      <Avatar name={gm.name} photo={gm.photo} size={88} priority={priority} />
      <span className="min-w-0 flex-1">
        <span className="bill-title block font-display text-[length:var(--text-title)] leading-tight">{gm.name}</span>
        <span className="mt-[var(--space-2xs)] block text-muted">
          {gm.city ? `${gm.city}, ${t("gm.openGames", { n: openGames })}` : t("gm.openGames", { n: openGames })}
        </span>
        {gm.systems.length > 0 && <span className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-xs)]">{gm.systems.slice(0, 3).map((x) => <span key={x} className="chip">{x}</span>)}</span>}
      </span>
    </Link>
  );
}

/** A message in the page's own voice: a ruled box with its icon and text; the tone changes the edge, never the meaning. */
export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "danger" | "warn"; children: React.ReactNode }) {
  const edge = { info: "border-ink", success: "border-success", danger: "border-danger", warn: "border-ink" }[tone];
  const icon = { info: "info", success: "check-circle", danger: "triangle-warning", warn: "triangle-warning" }[tone] as "info" | "check-circle" | "triangle-warning";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-[var(--space-sm)] border-2 bg-paper-2 px-[var(--space-md)] py-[var(--space-sm)] ${edge}`}>
      <Icon name={icon} className="mt-1 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="ruled flex flex-col items-start gap-[var(--space-md)] py-[var(--space-2xl)]">
      <p className="font-display text-[length:var(--text-section)] leading-tight">{title}</p>
      {children}
    </div>
  );
}
