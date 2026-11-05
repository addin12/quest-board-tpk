import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import type { T } from "@/lib/i18n/core";
import { searchText } from "@/lib/search";
import { TileSearch } from "./tile-search";
import { BrowseCard, BrowseTile } from "./ui";
import { Icon } from "./icon";
import type { IconName } from "@/lib/icons";

type Tile = { name: string; count: number; cover: string | null };
type Common = {
  tiles: Tile[];
  /** Where a tile goes: the games list filtered to it. */
  href: (name: string) => string;
  /** The shown name when it is not the key itself (a genre or a style has a translated label). */
  label?: (name: string) => string;
  /** A short description under the name of a card (a style or a mechanic); cards that have one go in a wider grid, three across on a desktop. */
  about?: (name: string) => string;
  /** The picture when it is not the cover of the tile's soonest listing (a genre has its own engraving, a system its book cover); null falls back to that listing cover. */
  cover?: (name: string) => string | null;
  /** "card" is a rounded rectangle with the name only (no picture); the default is a picture tile. */
  variant?: "tile" | "card";
  /** The heading level of each tile: 3 under a section heading (the default), 2 straight under the page title. */
  level?: 2 | 3;
  t: T;
};

const GRID = "grid grid-cols-2 gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
// On a phone the home blocks are one row that scrolls sideways, the next tile peeking in; from 640 px up they are the grids above.
/** The sideways row of a phone, the next card peeking in (the games of the home page use it too); each user adds its own gap and its grid from 640 px. */
export const RAIL_BASE = "flex snap-x snap-mandatory scroll-pl-[var(--gutter)] overflow-x-auto pb-[var(--space-sm)] max-sm:-mx-[var(--gutter)] max-sm:px-[var(--gutter)] [scrollbar-width:none]";
const RAIL = RAIL_BASE + " gap-[var(--gap-columns)] sm:grid sm:grid-cols-3 sm:gap-y-[var(--space-xl)] sm:overflow-visible lg:grid-cols-4 xl:grid-cols-5";
const CARD_RAIL = RAIL_BASE + " gap-[var(--space-md)] sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-4 xl:grid-cols-5";
const RAIL_ITEM = "w-[44vw] max-w-56 shrink-0 snap-start sm:w-auto sm:max-w-none";
// Cards with a description are wider: one column on a phone, two from 640 px, three from 1024 px.
const ABOUT_GRID = "grid gap-[var(--space-md)] sm:grid-cols-2 lg:grid-cols-3";
const CARD_GRID = "grid grid-cols-2 gap-[var(--space-md)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

function Tiles({ tiles, href, label, about, cover, variant = "tile", level, rail, ranked, t }: Common & { rail?: boolean; ranked?: boolean }) {
  const shown = (name: string) => (label ? label(name) : name);
  if (variant === "card") {
    return <ul className={rail ? CARD_RAIL : about ? ABOUT_GRID : CARD_GRID}>{tiles.map((x) => <li key={x.name} data-name={searchText(shown(x.name))} className={`flex ${rail ? RAIL_ITEM : ""}`}><BrowseCard name={shown(x.name)} count={x.count} href={href(x.name)} about={about?.(x.name)} t={t} level={level} /></li>)}</ul>;
  }
  return (
    <ul className={rail ? RAIL : GRID}>
      {tiles.map((x, i) => <li key={x.name} data-name={searchText(shown(x.name))} className={rail ? RAIL_ITEM : undefined}><BrowseTile name={shown(x.name)} count={x.count} cover={(cover ? cover(x.name) : null) ?? x.cover} href={href(x.name)} t={t} level={level} rank={ranked ? i + 1 : undefined} /></li>)}
    </ul>
  );
}

/** A home block: a heading with a button to the page with all of them on its right (as in Starting soon), then the tiles. */
export function BrowseSection({ id, title, allHref, allLabel, ranked, ...rest }: Common & { id: string; title: string; allHref: string; allLabel: string; ranked?: boolean }) {
  if (rest.tiles.length === 0) return null;
  return (
    <section className="section pt-0" aria-labelledby={id}>
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-[var(--space-md)]">
          <h2 id={id}>{title}</h2>
          <Link href={allHref} className="btn btn-soft">{allLabel}</Link>
        </div>
        <div className="mt-[var(--space-xl)]"><Tiles {...rest} rail ranked={ranked} /></div>
      </div>
    </section>
  );
}

/**
 * The four ways in to the whole board: systems, genres, play styles, mechanics. Each is a round mark (a Phosphor duotone icon in the accent, on a soft disc)
 * with its name and how many there are under it: one calm row, the same style for all four, and no borrowed artwork. Two across on a phone, four from 640 px.
 */
export function BrowseGateway({ title, items }: { title: string; items: { href: string; title: string; hint: string; icon: IconName }[] }) {
  return (
    <section className="section pt-0" aria-labelledby="gateway-h">
      <div className="wrap">
        <h2 id="gateway-h">{title}</h2>
        <ul className="mt-[var(--space-xl)] grid grid-cols-2 gap-x-[var(--space-md)] gap-y-[var(--space-xl)] sm:grid-cols-4" data-testid="browse-gateway">
          {items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className="group flex min-h-11 flex-col items-center rounded-[var(--radius-card)] p-[var(--space-sm)] text-center">
                <span aria-hidden className="grid aspect-square w-28 place-items-center rounded-full border border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-accent)_18%,var(--color-paper))] text-accent transition-transform duration-200 group-hover:scale-[1.04] sm:w-36">
                  <Icon name={it.icon} className="text-[4.5rem] sm:text-[5.75rem]" />
                </span>
                <h3 className="mt-[var(--space-md)] text-[length:var(--text-lg)] group-hover:text-accent-deep">{it.title}</h3>
                <p className="mt-[var(--space-3xs)] text-sm text-muted">{it.hint}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * A page that lists every tile of one kind (all systems, all genres, ...), with a breadcrumb for search engines. With `emptyHeading` the tiles that
 * have no games are not drawn as pictures: they follow under that heading as compact cards, so a long list of blanks does not push the real ones away.
 */
export function BrowsePage({ title, lead, home, path, emptyHeading, search, children, ...rest }: Common & { title: string; lead: string; home: string; path: string; emptyHeading?: string; search?: { label: string; placeholder: string }; children?: ReactNode }) {
  // with `emptyHeading`, a tile with no games and no picture is a compact card; one with a picture stays a picture tile even at 0 games
  const drawn = (x: Tile) => x.count > 0 || !!rest.cover?.(x.name);
  const listed = emptyHeading ? rest.tiles.filter(drawn) : rest.tiles;
  const unlisted = emptyHeading ? rest.tiles.filter((x) => !drawn(x)) : [];
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)] max-sm:pt-[var(--space-lg)]">
      <JsonLd data={breadcrumbJsonLd([{ name: "Quest Board", url: `${SITE_URL}${home}` }, { name: title, url: `${SITE_URL}${path}` }])} />
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{title}</h1>
      <p className="lead mt-[var(--space-sm)] text-ink-2">{lead}</p>
      <div className="mb-[var(--space-xl)] mt-[var(--space-lg)]">{search && <TileSearch targetId="browse-tiles" {...search} names={rest.tiles.map((x) => searchText(rest.label ? rest.label(x.name) : x.name))} />}</div>
      <div id="browse-tiles">
      {listed.length > 0 && <Tiles {...rest} tiles={listed} level={2} />}
      {unlisted.length > 0 && (
        <section className={listed.length > 0 ? "mt-[var(--space-3xl)]" : ""}>
          <h2 className="mb-[var(--space-lg)] max-w-none text-[length:var(--text-2xl)]">{emptyHeading}</h2>
          <Tiles {...rest} tiles={unlisted} variant="card" level={3} />
        </section>
      )}
      </div>
      {children}
    </div>
  );
}
