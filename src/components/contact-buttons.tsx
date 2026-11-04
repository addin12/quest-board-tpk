"use client";

import { useState } from "react";
import { openWhatsApp } from "@/lib/contact";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

/**
 * Reach a GM: WhatsApp (always) opens a chat with the message ready to send; Discord (if they gave one) is an
 * invite link, or a username to copy. `wa` is the number as lib/contact.ts encodes it, so it is not written
 * plainly into the page; it is put together when the button is tapped.
 */
export function ContactButtons({ wa, discord, instagram = "", message, stacked = false }: { wa: string; discord: string; instagram?: string; message: string; stacked?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copyDiscord() {
    try {
      await navigator.clipboard.writeText(discord);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // The username is on screen next to the button, so it can be copied by hand.
    }
  }

  const isLink = discord.startsWith("https://");
  return (
    <div className={`flex gap-[var(--space-md)] ${stacked ? "flex-col" : "flex-col sm:flex-row sm:flex-wrap sm:items-center"}`}>
      <a href="https://wa.me/" onClick={(e) => { e.preventDefault(); openWhatsApp(wa, message); }} target="_blank" rel="noopener noreferrer" className="btn btn-primary" data-testid="contact-whatsapp">
        <Icon name="whatsapp" /> {t("game.whatsapp")} <span className="sr-only">{t("a11y.opensNewTab")}</span>
      </a>
      {discord && isLink && (
        <a href={discord} target="_blank" rel="noopener noreferrer" className="btn btn-soft" data-testid="contact-discord">
          <Icon name="discord" /> {t("game.discordOpen")} <span className="sr-only">{t("a11y.opensNewTab")}</span>
        </a>
      )}
      {discord && !isLink && (
        <span className="flex flex-wrap items-center gap-[var(--space-sm)]" data-testid="contact-discord">
          {/* One line, as tall as the WhatsApp button: the Discord mark, the username it copies, and a copy mark that turns into "Copied". */}
          <button type="button" onClick={copyDiscord} className="btn btn-soft min-w-44" aria-label={`${t("game.discordCopy")} ${discord}`}>
            <span aria-hidden className="inline-flex items-center gap-[var(--space-sm)]">
              <Icon name={copied ? "check" : "discord"} />
              {copied ? t("common.copied") : discord}
              {!copied && <Icon name="copy" className="ms-[var(--space-xs)] opacity-70" />}
            </span>
          </button>
          <span role="status" className="sr-only">{copied ? t("common.copied") : ""}</span>
        </span>
      )}
      {instagram && (
        // the username is cleaned to letters, digits, dots and underscores (cleanInstagram), so it is safe in the address
        <a href={`https://www.instagram.com/${instagram}/`} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-soft" data-testid="contact-instagram" aria-label={`${t("game.instagramOpen")} ${instagram}`}>
          <Icon name="instagram" /> {instagram} <span className="sr-only">{t("a11y.opensNewTab")}</span>
        </a>
      )}
    </div>
  );
}
