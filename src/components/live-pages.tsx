"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { GENRES, MECHANICS, STYLES, genreCover, genreLabelKey, mechanicAboutKey, mechanicLabelKey, styleAboutKey, styleLabelKey, type GenreKey, type MechanicKey, type StyleKey } from "@/lib/categories";
import { allGenreTiles, allMechanicTiles, allStyleTiles, allSystemTiles, gameViewsOf, type Tile } from "@/lib/games";
import { homeModel, type HomeModel } from "@/lib/home";
import { paths } from "@/lib/hrefs";
import { searchText } from "@/lib/search";
import { systemCover } from "@/lib/system-covers";
import { SYSTEMS } from "@/lib/systems";
import type { SiteGm } from "@/lib/types";
import { BrowseGateway, BrowsePage, BrowseSection, RAIL_BASE } from "./browse";
import { useI18n } from "./i18n-provider";
import { TileSearch } from "./tile-search";
import { EmptyState, GameCard, GameRow, GmCard } from "./ui";
import { useLive } from "./use-live";

// The home, browse and Game Master list pages. The build writes what it knew (a first paint search engines can read); in the browser the same pages start from that,
// ask the live data (components/use-live.ts) and show what it says: counts, tiles and lists follow a new game within a minute, without a build.

/** What the build knew of each picture, so a cover it already cropped is kept while it is the current one (lib/live.ts). */
export type CoverRef = { id: string; cover: string | null; coverKey?: string };
export type PhotoRef = { id: string; photo: string | null; photoKey?: string };

/** The home page's data-dependent sections. */
export function HomeSections({ initial, covers }: { initial: HomeModel; covers: CoverRef[] }) {
  const { t, lang } = useI18n();
  const live = useLive({ games: covers });
  const model = useMemo(() => (live ? homeModel(gameViewsOf(live)) : initial), [live, initial]);
  const { soon, beginner, systems, genres } = model;
  const gateway = [
    { href: paths.systems(lang), title: t("systems.title"), hint: t("home.allSystems", { n: SYSTEMS.length }), cover: systems[0] ? (systemCover(systems[0].name) ?? systems[0].cover) : null },
    { href: paths.genres(lang), title: t("genres.title"), hint: t("home.allGenres", { n: GENRES.length }), cover: genres[0] ? genreCover(genres[0].name as GenreKey) : null },
    { href: paths.styles(lang), title: t("styles.title"), hint: t("home.allStyles", { n: STYLES.length }), cover: model.styledCover },
    { href: paths.mechanics(lang), title: t("mechanics.title"), hint: t("home.allMechanics", { n: MECHANICS.length }), cover: model.mechanicalCover },
  ];
  const filterHref = (key: string) => (name: string) => paths.games(lang, `?${key}=${encodeURIComponent(name)}`);
  return (
    <>
      <section className="section pt-0" aria-labelledby="soon-h">
        <div className="wrap">
          <div className="flex items-end justify-between gap-[var(--space-md)] sm:flex-wrap">
            <h2 id="soon-h" className="max-sm:text-[length:var(--text-title)]">{t("home.soon")}</h2>
            <Link href={paths.games(lang)} className="btn btn-soft">{t("home.browseAll")}</Link>
          </div>
          {/* On a phone the six are one row that swipes sideways (the next card peeking in); from 640 px they are a grid. */}
          {soon.length === 0 ? (
            <div className="mt-[var(--space-xl)]"><EmptyState title={t("home.empty")}><Link href={paths.list(lang)} className="btn btn-primary">{t("nav.list")}</Link></EmptyState></div>
          ) : (
            <ul className={`mt-[var(--space-xl)] ${RAIL_BASE} gap-[var(--space-md)] sm:grid sm:grid-cols-2 sm:gap-x-[var(--gap-columns)] sm:gap-y-[var(--space-xl)] sm:overflow-visible lg:grid-cols-3`}>
              {soon.map((g, i) => <li key={g.id} className="max-sm:w-[78vw] max-sm:max-w-72 max-sm:shrink-0 max-sm:snap-start"><GameCard game={g} t={t} lang={lang} priority={i < 3} /></li>)}
            </ul>
          )}
        </div>
      </section>

      <BrowseGateway title={t("home.browseTitle")} items={gateway} />

      <BrowseSection id="systems-h" ranked cover={systemCover} title={t("home.systemsTitle")} tiles={systems} href={filterHref("system")} allHref={paths.systems(lang)} allLabel={t("home.allSystems", { n: SYSTEMS.length })} t={t} />
      <BrowseSection id="genres-h" title={t("home.genresTitle")} tiles={genres} href={filterHref("genre")} label={(k) => t(genreLabelKey(k as GenreKey))} cover={(k) => genreCover(k as GenreKey)} allHref={paths.genres(lang)} allLabel={t("home.allGenres", { n: GENRES.length })} t={t} />
      {beginner.length > 0 && (
        <section className="section pt-0" aria-labelledby="new-h">
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
    </>
  );
}

export type BrowseKind = "systems" | "genres" | "styles" | "mechanics";

/** One of the four "all of them" pages (systems, genres, play styles, mechanics): the tiles with their counts follow the live data. */
export function LiveBrowse({ kind, initialTiles, covers, children }: { kind: BrowseKind; initialTiles: Tile[]; covers: CoverRef[]; children?: ReactNode }) {
  const { t, lang } = useI18n();
  const live = useLive({ games: covers });
  const tiles = useMemo(() => {
    if (!live) return initialTiles;
    const games = gameViewsOf(live);
    if (kind === "systems") return allSystemTiles(games, SYSTEMS);
    if (kind === "genres") return allGenreTiles(games, GENRES.map((g) => g.key));
    if (kind === "styles") return allStyleTiles(games, STYLES.map((s) => s.key));
    return allMechanicTiles(games, MECHANICS.map((m) => m.key));
  }, [live, initialTiles, kind]);
  const param = { systems: "system", genres: "genre", styles: "style", mechanics: "mechanic" }[kind];
  const common = {
    home: paths.home(lang), path: paths[kind](lang), title: t(`${kind}.title`), lead: t(`${kind}.lead`), tiles, t,
    href: (n: string) => paths.games(lang, `?${param}=${encodeURIComponent(n)}`),
  };
  if (kind === "systems") {
    return <BrowsePage {...common} cover={systemCover} search={{ label: t("browse.systemSearch"), placeholder: t("browse.systemPlaceholder") }} emptyHeading={t("systems.noGames")}>{children}</BrowsePage>;
  }
  if (kind === "genres") {
    return <BrowsePage {...common} label={(k) => t(genreLabelKey(k as GenreKey))} cover={(k) => genreCover(k as GenreKey)}>{children}</BrowsePage>;
  }
  if (kind === "styles") {
    return <BrowsePage {...common} label={(k) => t(styleLabelKey(k as StyleKey))} about={(k) => t(styleAboutKey(k as StyleKey))} variant="card">{children}</BrowsePage>;
  }
  return <BrowsePage {...common} label={(k) => t(mechanicLabelKey(k as MechanicKey))} about={(k) => t(mechanicAboutKey(k as MechanicKey))} variant="card">{children}</BrowsePage>;
}

/** The Game Master list: who is listed and how many open games each has follow the live data. */
export function GmList({ initialGms, initialOpen, photos }: { initialGms: SiteGm[]; initialOpen: Record<string, number>; photos: PhotoRef[] }) {
  const { t, lang } = useI18n();
  const live = useLive({ gms: photos });
  const { sorted, open } = useMemo(() => {
    const gms = live ? live.gms : initialGms;
    const counts: Record<string, number> = { ...(live ? {} : initialOpen) }; // a copy: counted afresh from the live games
    if (live) for (const g of live.games) counts[g.gmId] = (counts[g.gmId] ?? 0) + 1;
    const openOf = (id: string) => counts[id] ?? 0;
    return { sorted: [...gms].sort((a, b) => openOf(b.id) - openOf(a.id) || a.name.localeCompare(b.name)), open: openOf };
  }, [live, initialGms, initialOpen]);
  // what the search box looks in: the name, the city, the systems they run and the bio (synonyms count: "dnd" finds a GM who runs Dungeons & Dragons)
  const searchable = (gm: SiteGm) => searchText([gm.name, gm.city, ...gm.systems, gm.bio].join(" "));
  if (sorted.length === 0) return <div className="mt-[var(--space-xl)]"><EmptyState title={t("gm.empty")} /></div>;
  return (
    <>
      <div className="mb-[var(--space-xl)] mt-[var(--space-lg)]">
        <TileSearch targetId="gm-list" label={t("gm.search")} placeholder={t("gm.searchPlaceholder")} names={sorted.map(searchable)} />
      </div>
      <ul id="gm-list" className="ruled grid gap-x-[var(--gap-columns)] md:grid-cols-2">
        {sorted.map((gm, i) => <li key={gm.id} data-name={searchable(gm)}><GmCard gm={gm} openGames={open(gm.id)} t={t} lang={lang} priority={i < 4} /></li>)}
      </ul>
    </>
  );
}
