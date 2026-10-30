// Email addresses, and the messages the backend sends (English and Indonesian together, as before).
import type { Db } from "./db.ts";
import { clip, iso, metaSet } from "./util.ts";

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

/** Sends one email. The Worker uses the Apps Script relay below (a sending service would have the same shape); tests record the mails. */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/**
 * Wraps a mailer so the last success and the last failure are kept in the "meta" table, where /api/health shows them: a relay that
 * has stopped working (the Gmail limit, a revoked script) is otherwise only seen when a Game Master complains. The error is
 * rethrown, so the callers behave as before.
 */
export function recordingMailer(inner: Mailer, db: Db, now: () => number): Mailer {
  return {
    async send(mail) {
      try {
        await inner.send(mail);
        await metaSet(db, "mail_ok_at", iso(now()));
      } catch (e) {
        await metaSet(db, "mail_error_at", iso(now()));
        await metaSet(db, "mail_error", String(e instanceof Error ? e.message : e).slice(0, 80));
        throw e;
      }
    },
  };
}

/**
 * Sends through the Apps Script web app (its "mail" action), which mails from the owner's Gmail: there is no domain of our own to
 * send from. The secret is shared with the script (scripts/push-apps-script.mjs puts it there). The script answers JSON after a redirect.
 */
export function relayMailer(url: string, secret: string, fetcher: typeof fetch = fetch): Mailer {
  return {
    async send(mail) {
      const res = await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "mail", secret, to: mail.to, subject: mail.subject, body: mail.body }),
        redirect: "follow",
      });
      const answer = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || answer.ok !== true) throw new Error(`mail_failed_${answer.error ?? res.status}`);
    },
  };
}

const SIGN = "The Pandemonium Kollektive";

export function loginMail(to: string, link: string, minutes: number): Mail {
  return {
    to,
    subject: "Your sign-in link / Tautan masuk kamu",
    body:
      `Hi,\n\nOpen this link to sign in to Quest Board TPK. It works once and expires in ${minutes} minutes.\n${link}\n\nIf you did not ask for it, ignore this email.\n\n${SIGN}\n\n* * *\n\n` +
      `Halo,\n\nBuka tautan ini untuk masuk ke Quest Board TPK. Tautan hanya berlaku sekali dan kedaluwarsa dalam ${minutes} menit.\n${link}\n\nJika bukan kamu yang meminta, abaikan email ini.\n\n${SIGN}`,
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
        `Hi,\n\n“${t}” was approved and will appear on the Quest Board within a few minutes.${link("en")}\n\nTo change something later, sign in at ${edit}; a change goes back to review.\n\n${SIGN}\n\n* * *\n\n` +
        `Halo,\n\n“${t}” sudah disetujui dan akan tampil di Quest Board dalam beberapa menit.${link("id")}\n\nUntuk mengubah sesuatu nanti, masuk di ${edit}; perubahan ditinjau lagi.\n\n${SIGN}`,
    };
  }
  const why = reason ? clip(reason, 500) : "(no reason given / tanpa alasan)";
  return {
    to,
    subject: `Not approved yet: ${t} / Belum disetujui: ${t}`,
    body:
      `Hi,\n\n“${t}” was not approved yet.\n\nReason: ${why}\n\nSign in at ${edit} to fix it; it will be reviewed again.\n\n${SIGN}\n\n* * *\n\n` +
      `Halo,\n\n“${t}” belum disetujui.\n\nAlasan: ${why}\n\nMasuk di ${edit} untuk memperbaikinya; nanti ditinjau lagi.\n\n${SIGN}`,
  };
}

/** The warning before an unused account is erased: sign in within the grace period and nothing happens. */
export function expiryMail(to: string, graceDays: number, siteUrl: string): Mail {
  const where = `${siteUrl.replace(/\/$/, "")}/en/account/`;
  return {
    to,
    subject: "Your Quest Board TPK account will be erased / Akun Quest Board TPK kamu akan dihapus",
    body:
      `Hi,\n\nYou have not signed in to Quest Board TPK for a long time. In ${graceDays} days we will erase your account, your Game Master profile, your games and your pictures.\n\nTo keep them, sign in once at ${where}. That is all.\n\n${SIGN}\n\n* * *\n\n` +
      `Halo,\n\nKamu sudah lama tidak masuk ke Quest Board TPK. Dalam ${graceDays} hari kami akan menghapus akunmu, profil Game Master, game, dan gambarmu.\n\nUntuk menyimpannya, masuk sekali di ${where}. Itu saja.\n\n${SIGN}`,
  };
}
