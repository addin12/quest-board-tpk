"use client";

import { useEffect, useRef, useState } from "react";
import { openWhatsApp } from "@/lib/contact";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

/** How much of the contact panel must be on screen (above the two bars) for this bar to step aside. */
const SHOWN = 0.15;

/**
 * On a phone, the one action of a game page stays within reach: the price and the day on the left, WhatsApp on the right, above the tab bar.
 * It steps out of the way while the contact panel itself is on screen (`targetId`), and does not exist from 1024 px, where the panel is beside the text.
 * `wa` is the number as lib/contact.ts encodes it; it is put together only when the button is tapped, like the one in the contact panel.
 */
export function StickyContact({ wa, message, price, when, targetId }: { wa: string; message: string; price: string; when: string; targetId: string }) {
  const { t } = useI18n();
  const [covered, setCovered] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || !bar.current) return;
    // The two bars (the tabs and this one) cover the foot of the screen, so the panel counts as on screen only above them.
    const tabs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tabbar-h")) || 0;
    const covers = Math.ceil(tabs + bar.current.offsetHeight);
    const watcher = new IntersectionObserver(([entry]) => setCovered((entry?.intersectionRatio ?? 0) >= SHOWN), { threshold: SHOWN, rootMargin: `0px 0px -${covers}px 0px` });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [targetId]);

  return (
    <div
      ref={bar}
      className={`fixed inset-x-0 z-30 border-t border-rule bg-paper px-[var(--gutter)] py-[var(--space-sm)] transition-transform duration-200 lg:hidden ${covered ? "pointer-events-none translate-y-full" : ""}`}
      style={{ bottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom))" }}
      inert={covered}
      data-testid="sticky-contact"
    >
      <div className="flex items-center justify-between gap-[var(--space-md)]">
        <p className="min-w-0 leading-tight">
          <span className="block truncate font-medium">{price}</span>
          <span className="block truncate text-sm text-muted">{when}</span>
        </p>
        <a href="https://wa.me/" onClick={(e) => { e.preventDefault(); openWhatsApp(wa, message); }} target="_blank" rel="noopener noreferrer" aria-label={`${t("game.whatsapp")} ${t("a11y.opensNewTab")}`} className="btn btn-primary shrink-0" data-testid="sticky-whatsapp">
          <Icon name="whatsapp" /> WhatsApp
        </a>
      </div>
    </div>
  );
}
