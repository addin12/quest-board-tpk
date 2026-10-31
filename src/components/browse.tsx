import Link from "next/link";
import type { T } from "@/lib/i18n/core";
import { BrowseCard, BrowseTile } from "./ui";

type Tile = { name: string; count: number; cover: string | null };
type Common = {
  tiles: Tile[];
  /** Where a tile goes: the games list filtered to it. */
  href: (name: string) => string;
  /** The shown name when it is not the key itself (a genre or a style has a translated label). */
  label?: (name: string) => string;
  /** The picture when it is not the cover of the tile's soonest listing (the genres have their own engravings). */
  cover?: (name: string) => string | null;
  /** "card" is a rounded rectangle with the name only (no picture); the default is a picture tile. */
  variant?: "tile" | "card";
  t: T;
};

const GRID = "grid grid-cols-2 gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
const CARD_GRID = "grid grid-cols-2 gap-[var(--space-md)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

function Tiles({ tiles, href, label, cover, variant = "tile", t }: Common) {
  if (variant === "card") {
    return <ul className={CARD_GRID}>{tiles.map((x) => <li key={x.name} className="flex"><BrowseCard name={label ? label(x.name) : x.name} count={x.count} href={href(x.name)} t={t} /></li>)}</ul>;
  }
  return (
    <ul className={GRID}>
      {tiles.map((x) => <li key={x.name}><BrowseTile name={label ? label(x.name) : x.name} count={x.count} cover={cover ? cover(x.name) : x.cover} href={href(x.name)} t={t} /></li>)}
    </ul>
  );
}

/** A home block: a heading with a button to the page with all of them on its right (as in Starting soon), then the tiles. */
export function BrowseSection({ id, title, allHref, allLabel, ...rest }: Common & { id: string; title: string; allHref: string; allLabel: string }) {
  if (rest.tiles.length === 0) return null;
  return (
    <section className="section pt-0" aria-labelledby={id}>
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-[var(--space-md)]">
          <h2 id={id}>{title}</h2>
          <Link href={allHref} className="btn btn-soft">{allLabel}</Link>
        </div>
        <div className="mt-[var(--space-xl)]"><Tiles {...rest} /></div>
      </div>
    </section>
  );
}

/** A page that lists every tile of one kind (all systems, all genres, ...). */
export function BrowsePage({ title, lead, ...rest }: Common & { title: string; lead: string }) {
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{title}</h1>
      <p className="lead mb-[var(--space-xl)] mt-[var(--space-sm)] text-ink-2">{lead}</p>
      <Tiles {...rest} />
    </div>
  );
}
