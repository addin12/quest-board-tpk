"use client";

import { useEffect, useMemo, useState } from "react";
import { GENRES, genreLabelKey } from "@/lib/categories";
import { EMPTY_FILTERS, activeFilterCount, applyFilters, filtersToQuery, isLive, parseFilters, type Filters, type GameView, type filterOptions } from "@/lib/games";
import { useI18n } from "./i18n-provider";
import { EmptyState, GameCard } from "./ui";

/**
 * The games list with its filters. The page is built with every game in it (so search engines and slow phones
 * get a full list); in the browser the filters read the address (?q=horror&where=online), narrow the list, and
 * keep the address up to date so a filtered list can be shared. Games whose time has passed since the last
 * build are left out.
 */
export function GamesBrowser({ games, options }: { games: GameView[]; options: ReturnType<typeof filterOptions> }) {
  const { t, lang } = useI18n();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const f = parseFilters(window.location.search);
    setFilters(f); // the address is only known in the browser
    setNow(Date.now());
    setOpen(activeFilterCount({ ...f, q: "" }) > 0);
  }, []);

  function set(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    window.history.replaceState(null, "", window.location.pathname + filtersToQuery(next));
  }

  const live = useMemo(() => (now === null ? games : games.filter((g) => isLive(g, now))), [games, now]);
  const shown = useMemo(() => applyFilters(live, filters), [live, filters]);
  const active = activeFilterCount(filters);
  const filterCount = activeFilterCount({ ...filters, q: "" });

  const select = (id: string, label: string, value: string, onChange: (v: string) => void, choices: { value: string; label: string }[], anyLabel = t("common.any")) => (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{anyLabel}</option>
        {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="q" className="label">{t("games.search")}</label>
          <input id="q" type="search" className="input" value={filters.q} placeholder={t("games.searchPlaceholder")} maxLength={80} onChange={(e) => set({ q: e.target.value })} />
        </div>
        <button type="button" className="btn btn-secondary" aria-expanded={open} aria-controls="filter-panel" onClick={() => setOpen(!open)}>
          {t("games.filters")}{filterCount > 0 ? ` (${filterCount})` : ""}
        </button>
      </div>

      <div id="filter-panel" hidden={!open} className="well mt-[var(--space-md)] grid gap-[var(--space-lg)] sm:grid-cols-2 lg:grid-cols-4">
        {select("f-system", t("games.system"), filters.system, (v) => set({ system: v }), options.systems.map((s) => ({ value: s, label: s })))}
        {select("f-genre", t("games.genre"), filters.genre, (v) => set({ genre: v }), GENRES.filter((g) => options.genres.includes(g.key)).map((g) => ({ value: g.key, label: t(genreLabelKey(g.key)) })))}
        {select("f-format", t("games.format"), filters.format, (v) => set({ format: v as Filters["format"] }), [{ value: "one_shot", label: t("format.one_shot") }, { value: "campaign", label: t("format.campaign") }])}
        {select("f-where", t("games.where"), filters.where, (v) => set({ where: v as Filters["where"] }), [{ value: "online", label: t("loc.online") }, { value: "in_person", label: t("loc.inPerson") }])}
        {select("f-level", t("games.level"), filters.level, (v) => set({ level: v as Filters["level"] }), [{ value: "beginner", label: t("level.beginner") }, { value: "any", label: t("level.any") }, { value: "experienced", label: t("level.experienced") }])}
        {select("f-language", t("games.language"), filters.language, (v) => set({ language: v as Filters["language"] }), [{ value: "id", label: t("lang.gameId") }, { value: "en", label: t("lang.gameEn") }])}
        <div>
          <label htmlFor="f-sort" className="label">{t("games.sort")}</label>
          <select id="f-sort" className="input" value={filters.sort} onChange={(e) => set({ sort: e.target.value as Filters["sort"] })}>
            <option value="soonest">{t("sort.soonest")}</option>
            <option value="newest">{t("sort.newest")}</option>
            <option value="priceAsc">{t("sort.priceAsc")}</option>
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-[var(--space-sm)] font-bold sm:col-span-2">
          <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={filters.free} onChange={(e) => set({ free: e.target.checked })} />
          {t("games.freeOnly")}
        </label>
      </div>

      <div className="mt-[var(--space-xl)] flex flex-wrap items-center justify-between gap-[var(--space-md)]">
        <p className="text-muted" role="status" aria-live="polite" data-testid="games-count">{t("games.results", { n: shown.length })}</p>
        {active > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => { setFilters(EMPTY_FILTERS); window.history.replaceState(null, "", window.location.pathname); }}>
            {t("games.clear")}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="mt-[var(--space-md)]"><EmptyState title={t(games.length === 0 ? "games.noneYet" : "games.none")} /></div>
      ) : (
        <ul className="mt-[var(--space-md)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] sm:grid-cols-2 lg:grid-cols-3" data-testid="games-list">
          {shown.map((g, i) => <li key={g.id}><GameCard game={g} t={t} lang={lang} priority={i < 4} headingLevel={2} /></li>)}
        </ul>
      )}
    </div>
  );
}
