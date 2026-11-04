"use client";

import { useEffect, useRef, useState } from "react";
import { openWhatsApp } from "@/lib/contact";
import { clickedBackdrop } from "@/lib/dialog";
import { ContactButtons } from "./contact-buttons";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

/** How much of the contact panel must be on screen (above the two bars) for this bar to step aside. */
const SHOWN = 0.15;

/**
 * On a phone, the one action of a game page stays within reach: the price and the day on the left, WhatsApp on the right, above the tab bar.
 * If the Game Master gave Discord or Instagram too, a "more" button opens a sheet with all the ways to reach them.
 * It steps out of the way while the contact panel itself is on screen (`targetId`), and does not exist from 1024 px, where the panel is beside the text.
 * `wa` is the number as lib/contact.ts encodes it; it is put together only when the button is tapped, like the one in the contact panel.
 */
export function StickyContact({ wa, discord, instagram, message, price, when, targetId }: { wa: string; discord: string; instagram: string; message: string; price: string; when: string; targetId: string }) {
  const { t } = useI18n();
  const [covered, setCovered] = useState(false);
  const [sheet, setSheet] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

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

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (sheet && !d.open) d.showModal();
    if (!sheet && d.open) d.close();
  }, [sheet]);

  return (
    <>
      <div
        ref={bar}
        className={`fixed inset-x-0 z-30 border-t border-rule bg-paper px-[var(--gutter)] py-[var(--space-sm)] transition-transform duration-200 lg:hidden ${covered ? "pointer-events-none translate-y-full" : ""}`}
        style={{ bottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom))" }}
        inert={covered}
        data-testid="sticky-contact"
      >
        <div className="flex items-center justify-between gap-[var(--space-sm)]">
          <p className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-medium">{price}</span>
            <span className="block truncate text-sm text-muted">{when}</span>
          </p>
          {(discord || instagram) && (
            <button type="button" className="btn btn-soft shrink-0 !px-3" aria-label={t("game.moreTitle")} aria-haspopup="dialog" onClick={() => setSheet(true)} data-testid="sticky-more">
              <Icon name="more" className="text-[1.5rem]" />
            </button>
          )}
          <a href="https://wa.me/" onClick={(e) => { e.preventDefault(); openWhatsApp(wa, message); }} target="_blank" rel="noopener noreferrer" aria-label={`${t("game.whatsapp")} ${t("a11y.opensNewTab")}`} className="btn btn-primary shrink-0" data-testid="sticky-whatsapp">
            <Icon name="whatsapp" /> WhatsApp
          </a>
        </div>
      </div>

      {/* The sheet fills in only while it is open: until then the page holds just the buttons of its contact panel. */}
      <dialog ref={dialog} className="sheet" aria-labelledby="contact-sheet-h" onClose={() => setSheet(false)} onClick={(e) => { if (clickedBackdrop(e)) setSheet(false); }} data-testid="contact-sheet">
        {sheet && (
          <div className="grid gap-[var(--space-lg)]">
            <h2 id="contact-sheet-h" className="text-[length:var(--text-title)]">{t("game.moreTitle")}</h2>
            <ContactButtons wa={wa} discord={discord} instagram={instagram} message={message} stacked />
            <button type="button" className="btn btn-secondary w-full" onClick={() => setSheet(false)}>{t("acct.cancel")}</button>
          </div>
        )}
      </dialog>
    </>
  );
}
