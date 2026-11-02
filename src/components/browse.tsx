import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import type { T } from "@/lib/i18n/core";
import { searchText } from "@/lib/search";
import { TileSearch } from "./tile-search";
import { BrowseCard, BrowseTile } from "./ui";

type Tile = { name: string; count: number; cover: string | null };
type Common = {
  tiles: Tile[];
  /** Where a tile goes: the games list filtered to it. */
  href: (name: string) => string;
  /** The shown name when it is not the key itself (a genre or a style has a translated label). */
  label?: (name: string) => string;
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
const RAIL = "flex snap-x snap-mandatory scroll-pl-[var(--gutter)] gap-[var(--gap-columns)] overflow-x-auto pb-[var(--space-sm)] max-sm:-mx-[var(--gutter)] max-sm:px-[var(--gutter)] [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:gap-y-[var(--space-xl)] sm:overflow-visible lg:grid-cols-4 xl:grid-cols-5";
const CARD_RAIL = "flex snap-x snap-mandatory scroll-pl-[var(--gutter)] gap-[var(--space-md)] overflow-x-auto pb-[var(--space-sm)] max-sm:-mx-[var(--gutter)] max-sm:px-[var(--gutter)] [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-4 xl:grid-cols-5";
const RAIL_ITEM = "w-[44vw] max-w-56 shrink-0 snap-start sm:w-auto sm:max-w-none";
const CARD_GRID = "grid grid-cols-2 gap-[var(--space-md)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
// Two blocks side by side (BrowsePair) each have half the width, so fewer columns.
const CARD_RAIL_HALF = "flex snap-x snap-mandatory scroll-pl-[var(--gutter)] gap-[var(--space-md)] overflow-x-auto pb-[var(--space-sm)] max-sm:-mx-[var(--gutter)] max-sm:px-[var(--gutter)] [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-2 xl:grid-cols-3";

function Tiles({ tiles, href, label, cover, variant = "tile", level, rail, ranked, half, t }: Common & { rail?: boolean; ranked?: boolean; half?: boolean }) {
  const shown = (name: string) => (label ? label(name) : name);
  if (variant === "card") {
    return <ul className={rail ? (half ? CARD_RAIL_HALF : CARD_RAIL) : CARD_GRID}>{tiles.map((x) => <li key={x.name} data-name={searchText(shown(x.name))} className={`flex ${rail ? RAIL_ITEM : ""}`}><BrowseCard name={shown(x.name)} count={x.count} href={href(x.name)} t={t} level={level} /></li>)}</ul>;
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

type Block = Common & { id: string; title: string; allHref: string; allLabel: string };

/** Two home blocks side by side from 1024 px (stacked below): the page does not repeat one composition four times (R-05). */
export function BrowsePair({ left, right }: { left: Block; right: Block }) {
  const sides = [left, right].filter((b) => b.tiles.length > 0);
  if (sides.length === 0) return null;
  return (
    <section className="section pt-0">
      <div className={`wrap grid gap-x-[var(--space-3xl)] gap-y-[var(--section-gap-s)] ${sides.length === 2 ? "lg:grid-cols-2" : ""}`}>
        {sides.map(({ id, title, allHref, allLabel, ...rest }) => (
          <div key={id} role="group" aria-labelledby={id} className="min-w-0">
            <div className="flex flex-col items-start gap-[var(--space-md)]">
              <h2 id={id}>{title}</h2>
              <Link href={allHref} className="btn btn-soft">{allLabel}</Link>
            </div>
            <div className="mt-[var(--space-xl)]"><Tiles {...rest} rail half={sides.length === 2} /></div>
          </div>
        ))}
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
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
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
