# The Cloudflare backend (D1 + R2)

Replaced Google Forms, the Google Sheet and the Sheet script (ADR-25, ADR-27). **It is built and tested (73 unit and 178 browser tests, run against
the real code on an in-memory SQLite database) and has been live since 2026-10-30: how it was switched on is [cutover.md](cutover.md), the
state is [handoff.md](handoff.md).** Everything lives in
`worker/` and one Pages Function, `functions/api/[[path]].ts`, which only wires the bindings to `handle()` in `worker/src/handler.ts`.
The site's side is `src/app/[lang]/account/` (sign-in, profile, games), `src/components/account/`, and the admin page, which now
signs in the same way and calls `/api/admin`.

## Data (D1)

`worker/migrations/0001_init.sql`. One verified email is one **account**; an account has at most one **profile** (the GM) and
any number of **games**. Also: `admins`, `activity` (the audit trail), `login_tokens`, `sessions` (only hashes of the tokens),
`rate_events` (limits) and `meta` (build state). Pictures are R2 objects (`covers/…`, `photos/…`), referenced by key.

## How the rules are met

| Rule | Where |
|---|---|
| One account per verified email; `a.b+x@gmail.com` is `ab@gmail.com` | `normalizeEmail`, `accounts.email UNIQUE` |
| One profile per account, many games, all tied to the session's account | `profiles.account_id UNIQUE`, `store.ts` |
| Same WhatsApp number on two profiles is flagged to the admin | `sharesPhoneWith` in the queue, `check.duplicatePhone` |
| An admin asks to merge a duplicate into the real account; its owner accepts while signed in, then the games move and the email still signs in (ADR-45) | `merge` action → `merge_requests`, `POST /merge/respond`, `accounts.merged_into` |
| Jabodetabek and online only; short description at most 80 characters | `worker/src/rules.ts`, `src/lib/areas.ts` (enforced, not just warned) |
| A GM marks a game full or removes it without a review | `POST /games/:id/full`, `DELETE /games/:id` |
| Any other change goes back to review (same as before) | `saveProfile`, `saveGame` |
| A person can erase their account and pictures | `DELETE /api/account` |

## API (`/api/*`, same origin as the site)

| Call | Who | Does |
|---|---|---|
| `POST /login/request {email, turnstile}` | anyone | emails a one-time link (15 min); always answers ok for a well-formed address; 5 per address and 20 per IP per hour |
| `POST /login/verify {token}` | anyone | opens the link once, sets the `tpk_session` cookie (HttpOnly, Secure, SameSite=Lax, 30 days) |
| `POST /logout`, `GET /me` | signed in | end the session; the account, its profile and its games |
| `PUT /profile`, `POST /games`, `PUT /games/:id` | signed in | create or change; invalid input answers 422 with `fields` |
| `POST /games/:id/full {full}`, `DELETE /games/:id`, `DELETE /account` | owner of it | self-service |
| `POST /merge/respond {id, accept}` | owner of the account the request is for | accept or decline an admin's merge request (`GET /me` lists them as `mergeOffers`); anyone else gets 404 |
| `POST /images?kind=cover\|photo` | signed in | WebP, JPEG or PNG read from the bytes; cover up to 1.5 MB, photo up to 600 KB |
| `GET /img/<key>` | anyone | only pictures of approved things; the build key sees all |
| `POST /admin {action, …}` | admins | `whoami`, `queue`, `review`, `patch`, `admin.add`, `admin.remove`, `merge`, `deploy` (the old script's names) |
| `GET /public`, `GET /health` (both with `Authorization: Bearer <build key>`) | the build, the owner | public data; health: counts, `lastBackupAt`, `backupError`, `lastMailOkAt`, `lastMailError` (no personal data) |

Every write needs the site's own `Origin` and JSON. Sign-in and uploads are rate-limited in D1. Deploys are coalesced: at most one
build per 30 seconds however many changes arrive, plus one forced build a day (`daily`).

## Also in the API

| Call | Who | Does |
|---|---|---|
| `POST /cron?job=tick\|daily` (with the same header) | the timers (the Worker in `cron/`) | tick sends a waiting build; daily backs up to R2 (JSON of every table, plus games and profiles as CSV, kept 14 days), tidies sign-ins, rebuilds |

## What the tests cover

`tests/unit/worker.test.ts` (the API through its HTTP handler: accounts, limits, review, self-service, pictures, builds, backups, timers) and
`tests/e2e/{account,admin}.spec.ts` (the real built pages against the real backend: `tests/support/test-server.ts` gives every test its own
database, bucket, mailbox and clock).

## Request budget (ADR-46)

Cloudflare's free plan allows 50 database queries per request ([limits](https://developers.cloudflare.com/d1/platform/limits)). A review call decides at most `REVIEW_MAX_IDS` (8) records: one read, one `db.batch` of every change and its log row, then the emails (the admin page sends longer selections in turns). Erasing an account is three reads and one batch, however many games the person had. `tests/unit/worker.test.ts` counts the statements of those calls (each statement of a batch counted on its own, the worst case) and fails above 50. The daily job erases at most 2 accounts and warns at most 8 per run for the same reason.

## Not proven

The tests use SQLite and an in-memory bucket behind the same `Db` and `Bucket` interfaces as D1 and R2; the live database, bucket, mail relay
and Turnstile were exercised only by the cutover checks in [handoff.md](handoff.md). If something differs in production, look first at the thin
wiring: `functions/api/[[path]].ts`, `worker/src/email.ts`, `verifyTurnstile`.

## Watching itself, and expiring unused accounts (ADR-27)

- **Mail:** every send goes through `recordingMailer` (`worker/src/email.ts`), which keeps the last success and the last error in `meta`;
  `/api/health` shows them. The error is the relay's code (`mail_failed_quota`, `mail_failed_unauthorized`…), never an address.
- **Backups:** the daily job records `backup_ok_at` or `backup_error`; on failure it emails the owner, still runs the rest, and fails the
  timer call. The 10-minute tick (`watchBackup`, `worker/src/watch.ts`) emails the owner once a day while no backup has succeeded for 36 hours.
- **Retention** (`worker/src/retention.ts`, run by the daily job): an account with no sign-in for 730 days is emailed; if still unused 30
  days later it is erased with its profile, games and pictures. Signing in (`last_seen_at`, `expiry_warned_at` in `0002_retention.sql`) cancels it.
  Admins and the owner never expire. At most 20 per step per run.
