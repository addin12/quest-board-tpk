// Email addresses, and the messages the backend sends (English and Indonesian together, as before).
import { clip } from "./util.ts";

/**
 * The one form of an address the accounts are keyed on: lower case, "googlemail" read as "gmail", and for Gmail the dots
 * and anything after a "+" ignored (a.b+x@gmail.com and ab@gmail.com are the same inbox). "" when it is not an address.
 */
export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim().toLowerCase();
  if (s.length > 254 || !/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/.test(s)) return "";
  let [local, domain] = s.split("@") as [string, string];
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.split("+")[0]!.replace(/\./g, "");
  return local && domain ? `${local}@${domain}` : "";
}

export type Mail = { to: string; subject: string; body: string };

/** Sends one email. The Worker uses Resend (or another sender with the same shape); tests record the mails. */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). `from` must be a verified sender. */
export function resendMailer(apiKey: string, from: string, fetcher: typeof fetch = fetch): Mailer {
  return {
    async send(mail) {
      const res = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.body }),
      });
      if (!res.ok) throw new Error(`mail_failed_${res.status}`);
    },
  };
}

const SIGN = "The Pandemonium Kollektive";

export function loginMail(to: string, link: string, minutes: number): Mail {
  return {
    to,
    subject: "Your sign-in link / Tautan masuk kamu",
    body:
      `Hi,\n\nOpen this link to sign in to Quest Board TPK. It works once and expires in ${minutes} minutes.\n${link}\n\nIf you did not ask for it, ignore this email.\n\n— ${SIGN}\n\n—\n\n` +
      `Halo,\n\nBuka tautan ini untuk masuk ke Quest Board TPK. Tautan hanya berlaku sekali dan kedaluwarsa dalam ${minutes} menit.\n${link}\n\nJika bukan kamu yang meminta, abaikan email ini.\n\n— ${SIGN}`,
  };
}

/** What a GM gets when an admin approves or rejects a profile or a game. */
export function decisionMail(to: string, status: "approved" | "rejected", kind: "game" | "gm", title: string, slug: string, reason: string, siteUrl: string): Mail {
  const link = (lang: string) => (siteUrl ? `\n${siteUrl.replace(/\/$/, "")}/${lang}/${kind === "game" ? "games" : "gm"}/${slug}/` : "");
  const edit = siteUrl ? `${siteUrl.replace(/\/$/, "")}/en/account/` : "";
  const t = clip(title, 120);
  if (status === "approved") {
    return {
      to,
      subject: `Approved: ${t} / Disetujui: ${t}`,
      body:
        `Hi,\n\n“${t}” was approved and will appear on the Quest Board within a few minutes.${link("en")}\n\nTo change something later, sign in at ${edit}; a change goes back to review.\n\n— ${SIGN}\n\n—\n\n` +
        `Halo,\n\n“${t}” sudah disetujui dan akan tampil di Quest Board dalam beberapa menit.${link("id")}\n\nUntuk mengubah sesuatu nanti, masuk di ${edit}; perubahan ditinjau lagi.\n\n— ${SIGN}`,
    };
  }
  const why = reason ? clip(reason, 500) : "(no reason given / tanpa alasan)";
  return {
    to,
    subject: `Not approved yet: ${t} / Belum disetujui: ${t}`,
    body:
      `Hi,\n\n“${t}” was not approved yet.\n\nReason: ${why}\n\nSign in at ${edit} to fix it; it will be reviewed again.\n\n— ${SIGN}\n\n—\n\n` +
      `Halo,\n\n“${t}” belum disetujui.\n\nAlasan: ${why}\n\nMasuk di ${edit} untuk memperbaikinya; nanti ditinjau lagi.\n\n— ${SIGN}`,
  };
}
