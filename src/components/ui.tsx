import Image from "next/image";
import Link from "next/link";
import { Picture } from "./picture";
import type { GameView } from "@/lib/games";
import type { T } from "@/lib/i18n/core";
import type { Lang, SiteGm } from "@/lib/types";
import { genreIcon, genreLabelKey, isGenre } from "@/lib/categories";
import { formatIdr, formatShortDay, formatWhen, initialsOf } from "@/lib/format";
import { paths, smallCover } from "@/lib/hrefs";
import { Icon } from "./icon";

// Presentational pieces shared by server pages and the client-side games list. Anything that needs words takes `t`.

/** A steady hue from any text, for the colour behind a picture that is missing or still loading. */
export function hueOf(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** A 4:5 cover (like an Instagram post) with a colour gradient behind it. */
export function Cover({ src, seed, className = "", priority = false, sizes }: { src: string | null; seed: string; className?: string; priority?: boolean; sizes?: string }) {
  const hue = hueOf(seed);
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(circle at 20% 20%, hsl(${hue} 70% 60% / .9), transparent 55%), radial-gradient(circle at 80% 70%, hsl(${(hue + 50) % 360} 65% 40% / .9), transparent 60%), linear-gradient(135deg, hsl(${hue} 45% 22%), hsl(${(hue + 30) % 360} 50% 12%))`,
      }}
    >
      {src && <Picture src={src} priority={priority} sizes={sizes ?? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} />}
    </div>
  );
}

/** A GM's photo, or their initials on a colour. */
export function Avatar({ name, photo, size = 36 }: { name: string; photo: string | null; size?: number }) {
  if (photo) {
    return (
      <span aria-hidden className="relative inline-block shrink-0 overflow-hidden rounded-full bg-surface-2" style={{ width: size, height: size }}>
        <Picture src={photo} sizes={`${size}px`} />
      </span>
    );
  }
  const hue = hueOf(name);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, hsl(${hue} 55% 45%), hsl(${(hue + 40) % 360} 60% 32%))` }}
    >
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

/** A game as a card. `preview` draws it without a link (the admin page shows cards for games that are not on the site yet). */
export function GameCard({ game, t, lang, preview = false }: { game: GameView; t: T; lang: Lang; preview?: boolean }) {
  const genre = game.genres.find(isGenre);
  const className = "card group flex flex-col overflow-hidden transition-colors hover:border-accent/50";
  const body = (
    <>
      <div className="relative">
        <Cover src={game.cover ? smallCover(game.cover) : null} seed={game.title} className="aspect-[4/5] w-full" />
        <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{game.system}</span>
        {game.featured && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">
            <Icon name="star" solid /> {t("game.featured")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-snug group-hover:text-accent">{game.title}</h3>
          <span className="shrink-0 text-right">
            <span className="block font-semibold">{priceLabel(game.priceIdr, t)}</span>
            {game.priceIdr > 0 && <span className="block text-xs text-muted">{t("common.perSeat")}</span>}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted">{game.summary}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="chip"><Icon name={game.format === "campaign" ? "scroll-old" : "book-open-cover"} />{t(game.format === "campaign" ? "format.campaign" : "format.one_shot")}</span>
          <span className="chip whitespace-normal!"><Icon name={game.locationType === "online" ? "laptop" : "marker"} />{game.locationType === "online" ? t("loc.online") : whereLabel(game, t)}</span>
          <span className="chip"><Icon name="language" />{languageLabel(game.language, t)}</span>
          {game.level === "beginner" ? (
            <span className="chip border-success/30! bg-success-soft! text-success!"><Icon name="seedling" />{t("level.beginner")}</span>
          ) : (
            genre && <span className="chip"><Icon name={genreIcon(genre)} />{t(genreLabelKey(genre))}</span>
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-border pt-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <span className="font-medium">{game.gmName}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-muted"><Icon name="calendar-clock" />{formatShortDay(game.startsAt, lang, game.zone)}</span>
        </div>
      </div>
    </>
  );
  return preview ? <div className={className}>{body}</div> : <Link href={paths.game(lang, game.slug)} className={className}>{body}</Link>;
}

export function GmCard({ gm, openGames, t, lang }: { gm: SiteGm; openGames: number; t: T; lang: Lang }) {
  return (
    <Link href={paths.gm(lang, gm.slug)} className="card group flex items-start gap-4 p-5 transition-colors hover:border-accent/50">
      <Avatar name={gm.name} photo={gm.photo} size={64} />
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold leading-snug group-hover:text-accent">{gm.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
          {gm.city && <span className="inline-flex items-center gap-1"><Icon name="marker" />{gm.city}</span>}
          <span>{t("gm.openGames", { n: openGames })}</span>
        </span>
        {gm.systems.length > 0 && <span className="mt-2 flex flex-wrap gap-1.5">{gm.systems.slice(0, 3).map((s) => <span key={s} className="chip">{s}</span>)}</span>}
      </span>
    </Link>
  );
}

/** "Sun 12 Oct, 19.00 WIB" with a calendar icon. */
export function WhenLine({ iso, zone, lang }: { iso: string; zone: GameView["zone"]; lang: Lang }) {
  return <span className="inline-flex items-center gap-1.5"><Icon name="calendar-clock" />{formatWhen(iso, lang, zone)}</span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "danger" | "warn"; children: React.ReactNode }) {
  const cls = { info: "border-border bg-surface-2", success: "border-success/40 bg-success-soft text-success", danger: "border-danger/40 bg-danger-soft text-danger", warn: "border-gold/50 bg-accent-soft" }[tone];
  const icon = { info: "info", success: "check-circle", danger: "triangle-warning", warn: "triangle-warning" }[tone] as "info" | "check-circle" | "triangle-warning";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${cls}`}>
      <Icon name={icon} className="mt-0.5 shrink-0 text-base" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Image src="/images/tavern/empty-tankard.svg" alt="" width={120} height={90} />
      <p className="font-semibold">{title}</p>
      {children}
    </div>
  );
}
