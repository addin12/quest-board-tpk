# The Cloudflare backend (D1 + R2)

Replaces Google Forms, the Google Sheet and Apps Script (ADR-25). **Phase 1 is written and tested; nothing is deployed yet
and the live site still runs on the Sheet.** Everything lives in `worker/` and one Pages Function, `functions/api/[[path]].ts`,
which only wires the bindings to `handle()` in `worker/src/handler.ts`.

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

## Setting it up (you do this once; I cannot reach your Cloudflare account)

1. `npx wrangler login`, then `npx wrangler d1 create quest-board` and `npx wrangler r2 bucket create quest-board-images`.
2. `npx wrangler d1 migrations apply quest-board --remote` (from `worker/`, pointing at `migrations/`).
3. Cloudflare Pages project → Settings → Bindings: D1 `DB`, R2 `IMAGES`.
4. Variables and secrets: `SITE_URL`, `OWNER_EMAIL`, `BUILD_KEY`, `DEPLOY_HOOK`, `MAIL_FROM`, secrets `RESEND_API_KEY`, `TURNSTILE_SECRET`.
5. A free [Resend](https://resend.com) account with a verified sender, and a Turnstile site key.

## Not built yet (phases 2 and 3)

Phase 2: the site's pages (sign-in, "my account" with the profile and games forms, shrink-and-upload of pictures, the Turnstile
widget), the admin page switched to this API, and `scripts/build-data.mjs` reading `/api/public` and `/api/img/…`.
Phase 3: importing the existing GMs and games, a nightly CSV export to a second place, the cron Worker, the cutover and the
shutdown of Forms and the script.
