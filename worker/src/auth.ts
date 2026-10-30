// Accounts and sign-in. An account is a verified email address; it is made the first time someone opens a sign-in link
// sent to that address. Links and sessions are random tokens of which only the hash is stored.
import { exec, many, one, type Db } from "./db.ts";
import { loginMail, normalizeEmail, type Mailer } from "./email.ts";
import { DAY_MS, allow, iso, logEvent, randomId, randomToken, sha256Hex } from "./util.ts";

export type Ctx = {
  db: Db;
  mailer: Mailer;
  now: () => number;
  /** The site's address without a trailing slash, used in links inside emails. */
  siteUrl: string;
  /** The owner's email: always an admin, and the only one who can remove other admins. */
  owner: string;
};

export const LINK_MINUTES = 15;
export const SESSION_DAYS = 30;

export type Session = { accountId: string; email: string };

/** Emails a one-time sign-in link. Says "ok" for any well-formed address, so the reply never shows who has an account. */
export async function requestLogin(ctx: Ctx, rawEmail: unknown, ip: string): Promise<{ ok: true } | { ok: false; error: "bad_email" | "rate_limited" | "mail_failed" }> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: "bad_email" };
  const now = ctx.now();
  if (!(await allow(ctx.db, `login:email:${email}`, 5, 3_600_000, now)) || !(await allow(ctx.db, `login:ip:${ip}`, 20, 3_600_000, now))) {
    return { ok: false, error: "rate_limited" };
  }
  const token = randomToken();
  await exec(ctx.db, "INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)", await sha256Hex(token), email, iso(now + LINK_MINUTES * 60_000));
  try {
    await ctx.mailer.send(loginMail(email, `${ctx.siteUrl}/en/account/#t=${token}`, LINK_MINUTES));
  } catch {
    return { ok: false, error: "mail_failed" };
  }
  return { ok: true };
}

/** Turns a sign-in link's token into a session (and the account, the first time). The token works once. */
export async function verifyLogin(ctx: Ctx, token: unknown): Promise<{ ok: true; session: string; email: string } | { ok: false; error: "invalid_link" }> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return { ok: false, error: "invalid_link" };
  const now = ctx.now();
  const hash = await sha256Hex(token);
  const row = await one<{ email: string; expires_at: string }>(ctx.db, "SELECT email, expires_at FROM login_tokens WHERE token_hash = ? AND used_at IS NULL", hash);
  if (!row || Date.parse(row.expires_at) <= now) return { ok: false, error: "invalid_link" };
  // The UPDATE only changes a row nobody has used yet, so two clicks at once give one session.
  if ((await exec(ctx.db, "UPDATE login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL", iso(now), hash)) !== 1) return { ok: false, error: "invalid_link" };

  let account = await one<{ id: string; merged_into: string | null }>(ctx.db, "SELECT id, merged_into FROM accounts WHERE email = ?", row.email);
  if (!account) {
    const id = randomId(12);
    await exec(ctx.db, "INSERT INTO accounts (id, email, created_at) VALUES (?, ?, ?)", id, row.email, iso(now));
    await logEvent(ctx.db, now, "account", "account", id, row.email, "created", row.email);
    account = { id, merged_into: null };
  }
  const accountId = account.merged_into ?? account.id;
  // Signing in is the proof the account is still wanted: it restarts the inactivity clock and cancels an expiry warning.
  await exec(ctx.db, "UPDATE accounts SET last_seen_at = ?, expiry_warned_at = NULL WHERE id = ?", iso(now), accountId);
  const session = randomToken();
  await exec(ctx.db, "INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)", await sha256Hex(session), accountId, iso(now), iso(now + SESSION_DAYS * DAY_MS));
  const owner = await one<{ email: string }>(ctx.db, "SELECT email FROM accounts WHERE id = ?", accountId);
  return { ok: true, session, email: owner?.email ?? row.email };
}

export async function getSession(ctx: Ctx, token: string | null): Promise<Session | null> {
  if (!token || token.length > 100) return null;
  const row = await one<{ account_id: string; expires_at: string; email: string }>(
    ctx.db,
    "SELECT s.account_id, s.expires_at, a.email FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?",
    await sha256Hex(token),
  );
  return row && Date.parse(row.expires_at) > ctx.now() ? { accountId: row.account_id, email: row.email } : null;
}

export async function endSession(ctx: Ctx, token: string | null): Promise<void> {
  if (token) await exec(ctx.db, "DELETE FROM sessions WHERE token_hash = ?", await sha256Hex(token));
}

/** Sessions and used or expired links older than their lifetime; called from the daily job. */
export async function pruneAuth(ctx: Ctx): Promise<void> {
  const now = iso(ctx.now());
  await exec(ctx.db, "DELETE FROM sessions WHERE expires_at < ?", now);
  await exec(ctx.db, "DELETE FROM login_tokens WHERE expires_at < ?", now);
}

export async function isAdmin(ctx: Ctx, email: string): Promise<boolean> {
  if (email === ctx.owner) return true;
  return Boolean(await one(ctx.db, "SELECT 1 AS x FROM admins WHERE email = ?", email));
}

export const listAdmins = (ctx: Ctx) => many<{ email: string; added_by: string; added_at: string }>(ctx.db, "SELECT email, added_by, added_at FROM admins ORDER BY added_at");
