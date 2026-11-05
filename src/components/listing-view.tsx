"use client";

import { useCallback, useEffect, useState } from "react";
import { paths } from "@/lib/hrefs";
import { GameDetail } from "./game-detail";
import { GmDetail } from "./gm-detail";
import { useI18n } from "./i18n-provider";

/**
 * Shows a listing the last build did not know: the 404 page sends an unknown /games/<slug>/ or /gm/<slug>/ here as /view/?g=<slug> or ?m=<slug>. The page loads
 * the listing from the live data and, once it is on screen, puts the real address back in the address bar, so a copied link is the one that will be a page after
 * the next build. Nothing here is indexed (the page says noindex).
 */
export function ListingView() {
  const { t, lang } = useI18n();
  const [target, setTarget] = useState<{ kind: "game" | "gm"; slug: string } | null | undefined>(undefined);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const g = q.get("g");
    const m = q.get("m");
    const ok = (s: string | null): s is string => Boolean(s && /^[a-z0-9][a-z0-9-]{2,80}$/.test(s));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only known in the browser, so this cannot be the first render
    setTarget(ok(g) ?{ kind: "game", slug: g } : ok(m) ? { kind: "gm", slug: m } : null); // the address is only known in the browser
  }, []);
  const found = useCallback(() => {
    if (!target) return;
    window.history.replaceState(null, "", target.kind === "game" ? paths.game(lang, target.slug) : paths.gm(lang, target.slug));
  }, [target, lang]);

  if (target === undefined) return <div className="wrap py-[var(--section-gap-s)]"><p role="status" className="lead text-ink-2">{t("view.loading")}</p></div>;
  if (target === null) return <div className="wrap py-[var(--section-gap-s)]"><p className="lead text-ink-2">{t("view.notFoundBody")}</p></div>;
  return target.kind === "game" ? <GameDetail slug={target.slug} initial={null} onFound={found} /> : <GmDetail slug={target.slug} initial={null} onFound={found} />;
}
