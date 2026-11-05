"use client";

import { useState } from "react";
import { gameIcs, icsFileName } from "@/lib/ics";
import { formatWhen } from "@/lib/format";
import { paths } from "@/lib/hrefs";
import { SITE_URL } from "@/lib/site";
import type { SiteGame } from "@/lib/types";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

/**
 * Two small things a player does with a game they like: put the first session in their calendar (a .ics file made right here: no account, nothing sent anywhere)
 * and pass the game on to a friend on WhatsApp. The link is the game's own page, which is what a link preview reads.
 */
export function ShareActions({ game }: { game: Pick<SiteGame, "id" | "slug" | "title" | "summary" | "startsAt" | "zone" | "sessionHours" | "locationType" | "venueName" | "city" | "platform"> }) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}${paths.game(lang, game.slug)}`;

  function addToCalendar() {
    const file = new Blob([gameIcs(game, url, Date.now())], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = icsFileName(game.title);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // the address is in the browser's own bar
    }
  }

  const text = t("game.shareText", { title: game.title, when: formatWhen(game.startsAt, lang, game.zone), url });
  return (
    <div className="mt-[var(--space-md)] flex flex-wrap gap-[var(--space-sm)]" data-testid="share-actions">
      <button type="button" onClick={addToCalendar} className="btn btn-soft" data-testid="add-to-calendar"><Icon name="calendar" /> {t("game.addCalendar")}</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="btn btn-soft" data-testid="share-whatsapp"><Icon name="whatsapp" /> {t("game.shareWhatsApp")} <span className="sr-only">{t("a11y.opensNewTab")}</span></a>
      <button type="button" onClick={copy} className="btn btn-soft" data-testid="copy-link"><Icon name={copied ? "check" : "copy"} /> {copied ? t("common.copied") : t("game.copyLink")}</button>
    </div>
  );
}
