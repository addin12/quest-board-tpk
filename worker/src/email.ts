// Email addresses, and the messages the backend sends (English and Indonesian together, as before).
import type { Db } from "./db.ts";
import { DAY_MS, allow, clip, iso, metaSet } from "./util.ts";

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

/**
 * What a mail is for. Each kind has its own daily share of the relay's 90 mails (MAIL_BUDGET), so a burst of one kind (a flood of sign-in requests, a
 * long review with notifications) can never use up the share of another: decisions and alerts keep working when sign-ins are used up.
 */
export type MailKind = "login" | "decision" | "notice" | "system";

export type Mail = { to: string; subject: string; body: string; kind?: MailKind };

/**
 * Mails a day per kind, counted over a rolling 24 hours (Gmail's own limit is a rolling day too). They add up to the relay's 90 a day.
 * Sign-ins are counted at the door instead (auth.ts, so a visitor gets a clear "try later" and no link is made); the budgeted mailer lets them through.
 */
export const MAIL_BUDGET: Record<MailKind, number> = { login: 40, decision: 20, notice: 20, system: 10 };

/** Refuses a mail (it throws `mail_budget_<kind>`) when its kind has used its share of the day. A mail without a kind counts as a system mail. */
export function budgetedMailer(inner: Mailer, db: Db, now: () => number): Mailer {
  return {
    async send(mail) {
      const kind = mail.kind ?? "system";
      if (kind !== "login" && !(await allow(db, `mail:${kind}`, MAIL_BUDGET[kind], DAY_MS, now()))) throw new Error(`mail_budget_${kind}`);
      await inner.send(mail);
    },
  };
}

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
export function relayMailer(url: string, secret: string, fetcher: typeof fetch = fetch, replyTo = ""): Mailer {
  return {
    async send(mail) {
      const res = await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "mail", secret, to: mail.to, subject: mail.subject, body: mail.body, ...(replyTo ? { replyTo } : {}) }),
        redirect: "follow",
      });
      const answer = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || answer.ok !== true) throw new Error(`mail_failed_${answer.error ?? res.status}`);
    },
  };
}

const SIGN = "Quest Board";

export function loginMail(to: string, link: string, minutes: number): Mail {
  return {
    to,
    kind: "login",
    subject: "Your sign-in link / Tautan masuk kamu",
    body:
      `Hi,\n\nOpen this link to sign in to Quest Board. It works once and expires in ${minutes} minutes.\n${link}\n\nIf you did not ask for it, ignore this email.\n\n${SIGN}\n\n* * *\n\n` +
      `Halo,\n\nBuka tautan ini untuk masuk ke Quest Board. Tautan hanya berlaku sekali dan kedaluwarsa dalam ${minutes} menit.\n${link}\n\nJika bukan kamu yang meminta, abaikan email ini.\n\n${SIGN}`,
  };
}

/** What a GM gets when an admin approves or rejects a profile or a game. */
export function decisionMail(to: string, status: "approved" | "rejected", kind: "game" | "gm", title: string, slug: string, reason: string, siteUrl: string, waitingForGm = false): Mail {
  const link = (lang: string) => (siteUrl ? `\n${siteUrl.replace(/\/$/, "")}/${lang}/${kind === "game" ? "games" : "gm"}/${slug}/` : "");
  const edit = siteUrl ? `${siteUrl.replace(/\/$/, "")}/en/account/` : "";
  const t = clip(title, 120);
  if (status === "approved" && waitingForGm) {
    // The game is approved, but the site lists a game only with an approved Game Master profile: say so, do not promise it is on the board.
    return {
      to,
      kind: "decision",
      subject: `Approved, waiting for your profile: ${t} / Disetujui, menunggu profilmu: ${t}`,
      body:
        `Hi,\n\n“${t}” was approved, but it will appear on the Quest Board only once your Game Master profile is approved too.\n\nYou can check the state of both at ${edit}.\n\n${SIGN}\n\n* * *\n\n` +
        `Halo,\n\n“${t}” sudah disetujui, tetapi baru tampil di Quest Board setelah profil Game Master-mu juga disetujui.\n\nKamu bisa melihat keadaan keduanya di ${edit}.\n\n${SIGN}`,
    };
  }
  if (status === "approved") {
    return {
      to,
      kind: "decision",
      subject: `Approved: ${t} / Disetujui: ${t}`,
      body:
        `Hi,\n\n“${t}” was looked at and is live on the Quest Board.${link("en")}\n\nTo change something later, sign in at ${edit}; a change is live at once.\n\n${SIGN}\n\n* * *\n\n` +
        `Halo,\n\n“${t}” sudah diperiksa dan tampil di Quest Board.${link("id")}\n\nUntuk mengubah sesuatu nanti, masuk di ${edit}; perubahan langsung tampil.\n\n${SIGN}`,
    };
  }
  const why = reason ? clip(reason, 500) : "(no reason given / tanpa alasan)";
  return {
    to,
    kind: "decision",
    subject: `Hidden: ${t} / Disembunyikan: ${t}`,
    body:
      `Hi,\n\n“${t}” was hidden by an admin.\n\nReason: ${why}\n\nSign in at ${edit} to fix it; an admin will look at it again.\n\n${SIGN}\n\n* * *\n\n` +
      `Halo,\n\n“${t}” disembunyikan oleh admin.\n\nAlasan: ${why}\n\nMasuk di ${edit} untuk memperbaikinya; admin akan memeriksanya lagi.\n\n${SIGN}`,
  };
}

/**
 * Tells the owner and the admins that submissions are waiting: how many, the titles of the new ones, and how long the oldest has waited. One mail for a
 * burst of saves (watch.ts decides when), and nothing about the people (the admin page has that).
 */
export function reviewDigestMail(to: string, waiting: { games: number; gms: number; oldestDays: number }, newTitles: string[], siteUrl: string): Mail {
  const total = waiting.games + waiting.gms;
  const page = `${siteUrl.replace(/\/$/, "")}/en/admin/`;
  const shown = newTitles.slice(0, 5).map((t) => `“${clip(t, 60).replace(/\s+/g, " ")}”`);
  const more = newTitles.length - shown.length;
  const list = (and: string, others: (n: number) => string) => (shown.length ? shown.join(", ") + (more > 0 ? ` ${and} ${others(more)}` : "") : "");
  const old = waiting.oldestDays >= 3;
  return {
    to,
    kind: "notice",
    subject: `To review: ${total} waiting / Untuk ditinjau: ${total} menunggu`,
    body:
      `Hi,

${total} item${total === 1 ? " is" : "s are"} waiting for review (${waiting.games} game${waiting.games === 1 ? "" : "s"}, ${waiting.gms} Game Master profile${waiting.gms === 1 ? "" : "s"}).
${shown.length ? `New since the last message: ${list("and", (n) => `${n} more`)}.\n` : ""}${old ? `The oldest has been waiting ${waiting.oldestDays} days.\n` : ""}${page}

${SIGN}

* * *

` +
      `Halo,

${total} item menunggu ditinjau (${waiting.games} game, ${waiting.gms} profil Game Master).
${shown.length ? `Baru sejak pesan terakhir: ${list("dan", (n) => `${n} lainnya`)}.\n` : ""}${old ? `Yang paling lama sudah menunggu ${waiting.oldestDays} hari.\n` : ""}${page}

${SIGN}`,
  };
}

/**
 * Asked of the owner of an account before an admin links another sign-in address to it (nothing happens until they accept while signed
 * in). The address is named, so they can tell a duplicate of their own from a stranger's.
 */
export function mergeRequestMail(to: string, linked: string, siteUrl: string): Mail {
  const page = `${siteUrl.replace(/\/$/, "")}/en/account/`;
  return {
    to,
    kind: "decision",
    subject: "Please confirm: link another address to your account / Mohon konfirmasi: tautkan alamat lain ke akunmu",
    body:
      `Hi,

An admin asks to link the address ${linked} to your Quest Board account (they think it is a duplicate of yours). If you accept, anyone who can open that mailbox can sign in to your account.

Nothing changes until you sign in and accept. If you do not know this address, decline, or ignore this email: the request expires in 7 days.
${page}

${SIGN}

* * *

` +
      `Halo,

Seorang admin meminta untuk menautkan alamat ${linked} ke akun Quest Board-mu (dianggap duplikat dari akunmu). Jika kamu setuju, siapa pun yang bisa membuka kotak surat itu bisa masuk ke akunmu.

Tidak ada yang berubah sebelum kamu masuk dan menyetujui. Jika kamu tidak mengenal alamat ini, tolak, atau abaikan email ini: permintaan kedaluwarsa dalam 7 hari.
${page}

${SIGN}`,
  };
}

/** The warning before an unused account is erased: sign in within the grace period and nothing happens. */
export function expiryMail(to: string, graceDays: number, siteUrl: string): Mail {
  const where = `${siteUrl.replace(/\/$/, "")}/en/account/`;
  return {
    to,
    kind: "system",
    subject: "Your Quest Board account will be erased / Akun Quest Board kamu akan dihapus",
    body:
      `Hi,\n\nYou have not signed in to Quest Board for a long time. In ${graceDays} days we will erase your account, your Game Master profile, your games and your pictures.\n\nTo keep them, sign in once at ${where}. That is all.\n\n${SIGN}\n\n* * *\n\n` +
      `Halo,\n\nKamu sudah lama tidak masuk ke Quest Board. Dalam ${graceDays} hari kami akan menghapus akunmu, profil Game Master, game, dan gambarmu.\n\nUntuk menyimpannya, masuk sekali di ${where}. Itu saja.\n\n${SIGN}`,
  };
}
