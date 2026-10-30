"use client";

import { useState } from "react";
import { decodeContact, waLink } from "@/lib/contact";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

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
        <a href={discord} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" data-testid="contact-discord">
          <Icon name="discord" /> {t("game.discordOpen")} <span className="sr-only">{t("a11y.opensNewTab")}</span>
        </a>
      )}
      {discord && !isLink && (
        <span className="flex flex-wrap items-center gap-[var(--space-sm)]" data-testid="contact-discord">
          <button type="button" onClick={copyDiscord} className="btn btn-secondary">
            <Icon name="discord" /> {t("game.discordCopy")}
          </button>
          <span className="text-sm text-muted">{discord}</span>
          <span role="status" className="text-sm font-bold text-success">{copied ? t("common.copied") : ""}</span>
        </span>
      )}
    </div>
  );
}
