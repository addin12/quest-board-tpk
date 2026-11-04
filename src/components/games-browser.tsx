"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GENRES, MECHANICS, STYLES, genreLabelKey, mechanicLabelKey, styleLabelKey } from "@/lib/categories";
import { EMPTY_FILTERS, PAGE_SIZE, activeFilterCount, applyFilters, filtersToQuery, isLive, pageList, parseFilters, type Filters, type GameView, type filterOptions } from "@/lib/games";
import { clickedBackdrop } from "@/lib/dialog";
import { paths } from "@/lib/hrefs";
import { SearchPicker, type PickerOption } from "./search-picker";
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
  const [open, setOpen] = useState(false); // the inline filter panel (640 px and up)
  const [sheet, setSheet] = useState(false); // the filter sheet (phones)
  const [phone, setPhone] = useState(false);
  const [swapped, setSwapped] = useState(false); // the list fades in after a change of page, and only then

  useEffect(() => {
    const m = window.matchMedia("(max-width: 639px)");
    const apply = () => setPhone(m.matches);
    apply(); // the screen width is only known in the browser
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const f = parseFilters(window.location.search);
    setFilters(f); // the address is only known in the browser
    setNow(Date.now());
    // A tap on Filters made before these scripts ran (see REMEMBER_FILTERS_TAP in the page) opens them now.
    const tapped = document.documentElement.dataset.ft;
    delete document.documentElement.dataset.ft;
    const onPhone = window.matchMedia("(max-width: 639px)").matches;
    if (tapped && onPhone) setSheet(true);
    setOpen(tapped && !onPhone ? true : activeFilterCount({ ...f, q: "" }) > 0);
    const onBack = () => setFilters(parseFilters(window.location.search)); // Back and Forward step through the pages
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);

  /** Typing and picking filters rewrite the address in place; moving to another page adds a history entry so Back returns to the previous page. */
  function set(patch: Partial<Filters>, newEntry = false) {
    const next = { ...filters, page: 1, ...patch };
    setFilters(next);
    if (!newEntry) setSwapped(false); // only a change of page fades the list in
    window.history[newEntry ? "pushState" : "replaceState"](null, "", window.location.pathname + filtersToQuery(next));
  }

  const live = useMemo(() => (now === null ? games : games.filter((g) => isLive(g, now))), [games, now]);
  const shown = useMemo(() => applyFilters(live, filters), [live, filters]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages); // a shared address can point past the end
  const visible = useMemo(() => shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [shown, page]);
  const active = activeFilterCount(filters);
  const filterCount = activeFilterCount({ ...filters, q: "" });

  useEffect(() => { if (now !== null) delete document.documentElement.dataset.q; }, [now]); // the address is read and applied: show the list

  // a rounded rectangle, 48 px tall; the current page is filled with the accent. On a phone the numbers get a row above Previous and Next.
  const pageBtn = "btn rounded-[var(--radius-input)] border border-[color-mix(in_oklab,var(--color-ink)_35%,var(--color-paper))] bg-paper px-3 text-ink hover:not-disabled:bg-paper-3";

  function clear() {
    setFilters(EMPTY_FILTERS);
    window.history.replaceState(null, "", window.location.pathname);
  }

  function go(page: number) {
    setSwapped(true);
    set({ page }, true);
    document.getElementById("games-top")?.scrollIntoView({ block: "start" });
  }

  const select = (id: string, label: string, value: string, onChange: (v: string) => void, choices: { value: string; label: string }[], anyLabel = t("common.any")) => (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{anyLabel}</option>
        {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </div>
  );

  // the long lists (system, genre, style, mechanic) are searchable; the short ones stay native dropdowns
  const search = (id: string, label: string, value: string, onChange: (v: string) => void, choices: PickerOption[]) => (
    <div className="max-sm:col-span-2">
      <label htmlFor={id} className="label">{label}</label>
      <SearchPicker id={id} value={value} options={choices} any={t("common.any")} placeholder={t("games.typeToSearch")} listLabel={t("games.choicesFor", { name: label })} onChange={onChange} />
    </div>
  );

  const quick = [
    { label: t("loc.online"), on: filters.where === "online", toggle: () => set({ where: filters.where === "online" ? "" : "online" }) },
    { label: t("loc.inPerson"), on: filters.where === "in_person", toggle: () => set({ where: filters.where === "in_person" ? "" : "in_person" }) },
    { label: t("format.one_shot"), on: filters.format === "one_shot", toggle: () => set({ format: filters.format === "one_shot" ? "" : "one_shot" }) },
    { label: t("format.campaign"), on: filters.format === "campaign", toggle: () => set({ format: filters.format === "campaign" ? "" : "campaign" }) },
    { label: t("level.beginner"), on: filters.level === "beginner", toggle: () => set({ level: filters.level === "beginner" ? "" : "beginner" }) },
    { label: t("games.chipFree"), on: filters.free, toggle: () => set({ free: !filters.free }) },
  ];
  const ready = now !== null;
  const wait = ready ? "" : "pending"; // until the scripts have run, the search, the Filters button and the pager ignore taps (and look it, if it takes long)

  return (
    <div data-ready={ready ? "" : undefined} /* set once the page's scripts run: the list is then interactive (the tests wait for it) */>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="q" className="label">{t("games.search")}</label>
          <input id="q" type="search" className={`input ${wait}`} readOnly={!ready} value={filters.q} placeholder={t("games.searchPlaceholder")} maxLength={80} onChange={(e) => set({ q: e.target.value })} />
        </div>
        <button type="button" data-filters-btn className={`btn btn-secondary min-w-11 ${wait}`} aria-disabled={!ready || undefined} aria-expanded={phone ? sheet : open} aria-controls="filter-panel" onClick={() => (phone ? setSheet(true) : setOpen(!open))}>
          {t("games.filters")}{filterCount > 0 ? ` (${filterCount})` : ""}
        </button>
      </div>

      {/* The five filters people reach for first, one tap each, under the search on a phone (a second tap on one clears it). The sheet below has the rest. */}
      <div role="group" aria-label={t("games.quick")} className="mt-[var(--space-sm)] flex gap-[var(--space-xs)] overflow-x-auto pb-1 [scrollbar-width:none] max-sm:-mx-[var(--gutter)] max-sm:px-[var(--gutter)] sm:hidden">
        {quick.map((c) => <button key={c.label} type="button" className={`chip-toggle ${wait}`} aria-pressed={c.on} onClick={c.toggle}>{c.label}</button>)}
      </div>

      <FilterShell phone={phone} open={open} sheet={sheet} count={shown.length} active={active} onClear={clear} onClose={() => setSheet(false)}>
        {search("f-system", t("games.system"), filters.system, (v) => set({ system: v }), options.systems.map((s) => ({ value: s, label: s })))}
        {search("f-genre", t("games.genre"), filters.genre, (v) => set({ genre: v }), GENRES.filter((g) => options.genres.includes(g.key)).map((g) => ({ value: g.key, label: t(genreLabelKey(g.key)) })))}
        {search("f-style", t("games.style"), filters.style, (v) => set({ style: v }), STYLES.filter((s) => options.styles.includes(s.key)).map((s) => ({ value: s.key, label: t(styleLabelKey(s.key)) })))}
        {search("f-mechanic", t("games.mechanic"), filters.mechanic, (v) => set({ mechanic: v }), MECHANICS.filter((m) => options.mechanics.includes(m.key)).map((m) => ({ value: m.key, label: t(mechanicLabelKey(m.key)) })))}
        {select("f-format", t("games.format"), filters.format, (v) => set({ format: v as Filters["format"] }), [{ value: "one_shot", label: t("format.one_shot") }, { value: "campaign", label: t("format.campaign") }])}
        {select("f-where", t("games.where"), filters.where, (v) => set({ where: v as Filters["where"] }), [{ value: "online", label: t("loc.online") }, { value: "in_person", label: t("loc.inPerson") }])}
        <div className="max-sm:col-span-2">{select("f-level", t("games.level"), filters.level, (v) => set({ level: v as Filters["level"] }), [{ value: "beginner", label: t("level.beginner") }, { value: "experienced", label: t("level.experienced") }], t("level.any"))}</div>
        {select("f-language", t("games.language"), filters.language, (v) => set({ language: v as Filters["language"] }), [{ value: "id", label: t("lang.gameId") }, { value: "en", label: t("lang.gameEn") }])}
        <div>
          <label htmlFor="f-sort" className="label">{t("games.sort")}</label>
          <select id="f-sort" className="input" value={filters.sort} onChange={(e) => set({ sort: e.target.value as Filters["sort"] })}>
            <option value="soonest">{t("sort.soonest")}</option>
            <option value="newest">{t("sort.newest")}</option>
            <option value="priceAsc">{t("sort.priceAsc")}</option>
          </select>
        </div>
        {/* On wide screens it shares a row with Sort by and is laid out like that cell (an empty label line, then a box as tall as the select), so the checkbox sits level with the middle of the select. */}
        <div className="col-span-2 flex flex-col">
          <span className="label invisible hidden lg:block" aria-hidden>&nbsp;</span>
          <label className="flex min-h-11 flex-1 items-center gap-[var(--space-sm)] font-medium">
            <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={filters.free} onChange={(e) => set({ free: e.target.checked })} />
            {t("games.freeOnly")}
          </label>
        </div>
      </FilterShell>

      <div className="mt-[var(--space-xl)] flex flex-wrap items-center justify-between gap-[var(--space-md)]">
        <p id="games-top" data-late className="scroll-mt-24 text-muted" role="status" aria-live="polite" data-testid="games-count">{t("games.results", { n: shown.length })}</p>
        {active > 0 && (
          <button type="button" className="btn btn-ghost" onClick={clear}>
            {t("games.clear")}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div data-late className="mt-[var(--space-md)]">
          <EmptyState title={t(games.length === 0 ? "games.noneYet" : "games.none")}>
            {active > 0 && <button type="button" className="btn btn-soft" onClick={clear}>{t("games.clear")}</button>}
            {games.length === 0 && <Link href={paths.list(lang)} className="btn btn-primary">{t("nav.list")}</Link>}
          </EmptyState>
        </div>
      ) : (
        <ul key={page} data-late className={`mt-[var(--space-md)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] max-sm:gap-y-[var(--space-sm)] sm:grid-cols-2 lg:grid-cols-3 ${swapped ? "list-in" : ""}`} data-testid="games-list">
          {visible.map((g, i) => <li key={g.id}><GameCard game={g} t={t} lang={lang} priority={i < 4} headingLevel={2} rowOnPhone /></li>)}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label={t("games.pages")} data-late className={`mt-[var(--space-2xl)] flex flex-wrap items-center justify-center gap-[var(--space-sm)] ${wait}`} data-testid="games-pager">
          <button type="button" className={pageBtn} disabled={page <= 1} onClick={() => go(page - 1)}>{t("games.prev")}</button>
          <div className="order-first flex w-full items-center justify-center gap-1.5 sm:gap-[var(--space-sm)] sm:order-none sm:w-auto">
          {pageList(page, pages).map((n, i) =>
            n === 0 ? (
              <span key={`gap${i}`} aria-hidden="true" className="px-0.5 text-muted sm:px-1">…</span>
            ) : (
              <button key={n} type="button" className={`${pageBtn} min-w-11 !px-2 sm:min-w-12 sm:!px-3 ${n === page ? "!border-accent !bg-accent !text-accent-ink" : ""}`} aria-current={n === page ? "page" : undefined} aria-label={t("games.pageN", { page: n })} onClick={() => go(n)}>{n}</button>
            ),
          )}
          </div>
          <button type="button" className={pageBtn} disabled={page >= pages} onClick={() => go(page + 1)}>{t("games.next")}</button>
        </nav>
      )}
    </div>
  );
}

/**
 * The filter fields: an inline panel from 640 px up, and on a phone a bottom sheet (a native modal dialog, so focus stays inside, Escape and the
 * backdrop close it) with a button that says how many games the filters leave.
 */
function FilterShell({ phone, open, sheet, count, active, onClear, onClose, children }: { phone: boolean; open: boolean; sheet: boolean; count: number; active: number; onClear: () => void; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (phone && sheet && !d.open) d.showModal();
    if (!(phone && sheet) && d.open) d.close();
  }, [phone, sheet]);

  if (!phone) {
    return <div id="filter-panel" hidden={!open} className="well mt-[var(--space-md)] grid gap-[var(--space-lg)] sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
  }
  return (
    <dialog ref={dialog} id="filter-panel" className="sheet" aria-labelledby="filter-title" onClose={onClose} onClick={(e) => { if (clickedBackdrop(e)) onClose(); }}>
      {/* Two columns: the long pickers, Experience level (its choice is long) and Free games only take a row each; Format and Where, and Language and Sort by, pair up. */}
      <div className="grid grid-cols-2 gap-x-[var(--space-md)] gap-y-[var(--space-lg)]">
        <div className="col-span-2 flex items-center justify-between gap-[var(--space-md)]">
          <h2 id="filter-title" ref={title} tabIndex={-1} className="text-[length:var(--text-title)] outline-none">{t("games.filters")}</h2>
          {/* The button goes away once nothing is left to clear, so the focus moves to the title first. */}
          {active > 0 && <button type="button" className="btn btn-ghost" onClick={() => { onClear(); title.current?.focus(); }}>{t("games.clear")}</button>}
        </div>
        {children}
        <div className="sticky bottom-[calc(-1*var(--space-xl))] col-span-2 -mx-[var(--gutter)] border-t border-rule bg-paper px-[var(--gutter)] py-[var(--space-sm)]">
          <button type="button" className="btn btn-primary w-full" onClick={onClose}>{t("games.showN", { n: count })}</button>
        </div>
      </div>
    </dialog>
  );
}
