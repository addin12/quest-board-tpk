"use client";

import { useState } from "react";
import { decodeContact, waLink } from "@/lib/contact";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

// The second channel is an outlined button next to the filled WhatsApp one (the same look as the page numbers).
const OUTLINED = "btn rounded-[var(--radius-input)] border border-[color-mix(in_oklab,var(--color-ink)_35%,var(--color-paper))] bg-paper text-ink hover:bg-paper-3";

/**
 * Reach a GM: WhatsApp (always) opens a chat with the message ready to send; Discord (if they gave one) is an
 * invite link, or a username to copy. `wa` is the number as lib/contact.ts encodes it, so it is not written
 * plainly into the page; it is put together when the button is tapped.
 */
export function ContactButtons({ wa, discord, message, stacked = false }: { wa: string; discord: string; message: string; stacked?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  function openWhatsApp(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    window.open(waLink(decodeContact(wa), message), "_blank", "noopener,noreferrer");
  }

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
      <a href="https://wa.me/" onClick={openWhatsApp} target="_blank" rel="noopener noreferrer" className="btn btn-primary" data-testid="contact-whatsapp">
        <Icon name="whatsapp" /> {t("game.whatsapp")} <span className="sr-only">{t("a11y.opensNewTab")}</span>
      </a>
      {discord && isLink && (
        <a href={discord} target="_blank" rel="noopener noreferrer" className={OUTLINED} data-testid="contact-discord">
          <Icon name="discord" /> {t("game.discordOpen")} <span className="sr-only">{t("a11y.opensNewTab")}</span>
        </a>
      )}
      {discord && !isLink && (
        <span className="flex flex-wrap items-center gap-[var(--space-sm)]" data-testid="contact-discord">
          {/* One button that shows what it copies: the username is the button's main text, not a caption beside it. */}
          <button type="button" onClick={copyDiscord} className={OUTLINED} aria-label={`${t("game.discordCopy")} ${discord}`}>
            <Icon name="discord" />
            <span className="text-left leading-tight"><span className="block text-sm font-normal text-muted">{t("game.discord")}</span>{discord}</span>
            <span className="ms-[var(--space-xs)] border-s border-rule ps-[var(--space-md)] text-sm">{t("common.copy")}</span>
          </button>
          <span role="status" className="text-sm font-bold text-success">{copied ? t("common.copied") : ""}</span>
        </span>
      )}
    </div>
  );
}
