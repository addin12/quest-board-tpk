# The Cloudflare backend (D1 + R2)

Replaces Google Forms, the Google Sheet and Apps Script (ADR-25). **It is built and tested (73 unit and 178 browser tests, run against
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
| Admin merges a duplicate into the real account (games move, the email still signs in) | `merge` action, `accounts.merged_into` |
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
| `POST /images?kind=cover\|photo` | signed in | WebP, JPEG or PNG read from the bytes; cover up to 1.5 MB, photo up to 600 KB |
| `GET /img/<key>` | anyone | only pictures of approved things; the build key sees all |
| `POST /admin {action, …}` | admins | `whoami`, `queue`, `review`, `patch`, `admin.add`, `admin.remove`, `merge`, `deploy` (same names and answers as the old script) |
| `GET /public?key=`, `GET /health?key=` | the build | public data in the old shape, counts only |

Every write needs the site's own `Origin` and JSON. Sign-in and uploads are rate-limited in D1. Deploys are coalesced: at most one
build per two minutes however many changes arrive, plus one forced build a day (`daily`).

## Also in the API

| Call | Who | Does |
|---|---|---|
| `POST /cron?job=tick\|daily&key=` | the timers (the Worker in `cron/`) | tick sends a waiting build; daily backs up to R2 (JSON of every table, plus games and profiles as CSV, kept 14 days), tidies sign-ins, rebuilds |

## What the tests cover

`tests/unit/worker.test.ts` (the API through its HTTP handler: accounts, limits, review, self-service, pictures, builds, backups, timers) and
`tests/e2e/{account,admin}.spec.ts` (the real built pages against the real backend: `tests/support/test-server.ts` gives every test its own
database, bucket, mailbox and clock).

## Not proven

Never run against a real Cloudflare account, a real Resend or Apps Script relay, or real Turnstile: those parts are thin wiring
(`functions/api/[[path]].ts`, `worker/src/email.ts`, `verifyTurnstile`, `scripts/cloudflare-setup.mjs`). Check them first when going live.
