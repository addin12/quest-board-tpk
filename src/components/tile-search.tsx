"use client";

import { useEffect, useState } from "react";
import { norm } from "@/lib/games";
import { useI18n } from "./i18n-provider";

const wordsOf = (q: string) => norm(q).split(/\s+/).filter(Boolean);

/**
 * A search box for a long page of tiles (the 141 game systems). The tiles are drawn on the server, so the page is complete without scripts; this
 * hides the `[data-name]` items inside `#targetId` that do not contain every word typed, and keeps the words in the address (?q=).
 * `names` are the tiles' normalised names, only to count the matches.
 */
export function TileSearch({ targetId, label, placeholder, names }: { targetId: string; label: string; placeholder: string; names: string[] }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [ready, setReady] = useState(false); // the scripts have run: typing now counts (the tests wait for this)

  useEffect(() => {
    setQ((new URLSearchParams(window.location.search).get("q") ?? "").slice(0, 60)); // eslint-disable-line react-hooks/set-state-in-effect -- the address is only known in the browser
    setReady(true);
  }, []);

  useEffect(() => {
    const words = wordsOf(q);
    for (const el of document.querySelectorAll<HTMLElement>(`#${targetId} [data-name]`)) el.hidden = !words.every((w) => (el.dataset.name ?? "").includes(w));
  }, [q, targetId]);

  function change(value: string) {
    setQ(value);
    window.history.replaceState(null, "", window.location.pathname + (value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ""));
  }

  const words = wordsOf(q);
  const shown = words.length ? names.filter((n) => words.every((w) => n.includes(w))).length : names.length;
  return (
    <div className="max-w-xl" data-ready={ready ? "" : undefined}>
      <label htmlFor="tile-q" className="label">{label}</label>
      <input id="tile-q" type="search" className="input" value={q} placeholder={placeholder} maxLength={60} onChange={(e) => change(e.target.value)} autoComplete="off" />
      <p className="mt-[var(--space-xs)] min-h-6 text-sm text-muted" role="status" aria-live="polite" data-testid="tile-count">
        {words.length ? (shown === 0 ? t("browse.noMatch") : t("browse.shownOf", { n: shown, total: names.length })) : ""}
      </p>
    </div>
  );
}
