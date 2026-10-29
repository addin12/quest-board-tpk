# Handoff: where the project stands (2026-10-29)

For the next agent or person. Read this first, then [CLAUDE.md](../CLAUDE.md). Facts here are the ones the code and git history
don't tell you.

## State in one paragraph

The site is a Next 16 static export on Cloudflare Pages (EN/ID), redesigned as "Halftone" (ADR-22) and live at
<https://quest-board-tpk.pages.dev> on the **old** Google Forms + Sheet + Apps Script stack (0 real games listed). A complete
replacement backend, Cloudflare Pages Functions + D1 + R2 with email-link accounts (ADR-25, [backend.md](backend.md)), is built and tested
locally but **not deployed and not pushed**. Local `main` is two commits ahead of `origin/main`: `673760b` (phase 1) and `9e8ecfc`
(phases 2 and 3). 73 unit tests and 178 Playwright tests pass.

## Do not push without the owner saying "push"

Pushing deploys `functions/api/[[path]].ts` to Pages **without** the D1/R2 bindings, so `/api` would answer errors, and the build would
read the wrong data source. The owner has to do [cutover.md](cutover.md) steps 1 to 5 first (Cloudflare login, `npm run cloudflare:setup`,
variables and secrets, mail relay, GitHub `BUILD_KEY` secret). Nothing in the repo can do these: they need the owner's Cloudflare,
GitHub and Google accounts. Then the owner says "push", and you follow cutover.md step 6, checking `/api/health` and CI afterwards
(see "Check CI" below).

## Never run against real services

Only fakes were exercised. Check these first when going live:

| Part | Where | Risk |
|---|---|---|
| Cloudflare D1/R2 behaviour | `functions/api/[[path]].ts`, `worker/src/db.ts` | tests use `node:sqlite` and an in-memory bucket behind the same `Db`/`Bucket` interfaces; real D1 may differ on batch/`last_row_id`/error shapes |
| `scripts/cloudflare-setup.mjs` | `npm run cloudflare:setup -- --dry` first | written blind; the by-hand fallback is in cutover.md |
| Mail relay | `apps-script/Code.gs` (`mailRequest_`), `worker/src/email.ts` | real Gmail quota (90/day cap is ours), Apps Script redirects on POST, secret injected by `script:deploy` |
| Turnstile | `verifyTurnstile`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | optional; CSP already allows `challenges.cloudflare.com` |
| `wrangler.toml` vs dashboard variables | cutover.md step 2 | the dashboard may lock variables once the file exists; fallback is `[vars]` in the file |
| Indonesian pages | `src/lib/i18n/id.ts` | written by the agent, not looked at by eye on every page |

## Map of the new backend

- `worker/migrations/0001_init.sql`: schema. `worker/src/handler.ts`: the one router (`handle(req, env)`) with everything injected
  (db, bucket, mailer, clock, fetcher), which is why it is testable without mocks.
- `worker/src/{auth,store,admin,public,deploy,images,backup,rules,email,util,db}.ts`: one concern each; see backend.md for the rules table.
- Site side: `src/app/[lang]/account/`, `src/components/account/*`, `src/lib/account-api.ts`, admin in `src/lib/admin-api.ts` +
  `admin-app.tsx` + `review-pane.tsx`.
- Build: `scripts/build-data.mjs` reads `TPK_API_BASE` + `TPK_BUILD_KEY` (falls back to the old `TPK_API_URL`, then demo data).
- Timers: `.github/workflows/cron.yml` calls `POST /api/cron?job=tick|daily` with the build key.
- Test harness: `tests/support/worker-env.ts` (unit world), `tests/support/test-server.ts` (real backend for Playwright, one world per
  test via the `tpk_world` cookie, `/__test/*` helpers for seeding, clock, mail and SQL).

## Gotchas that cost time (don't relearn them)

- **Git Bash eats backslashes.** Write edit scripts with the Write tool (`.cjs`) and use Edit for regex lines; never heredoc a regex.
- **Hash-only navigation** (`#anchor` links) tripped an e2e test once; the details are in the session transcript, so prefer asserting on real URLs and visible content.
- **`getByLabel` strict mode**: labels that prefix-match two fields break it; use exact names or roles.
- **Mailbox pollution in e2e**: the test server's mailbox is per world; read the *latest* mail, not the first.
- **Cover/photo limits are enforced from the bytes** (sniffed), not from the declared type or filename. Keep it so.
- **Public image route serves only approved images**; admins and the build key see all. Don't loosen it.
- **Build coalescing**: at most one deploy per 120 s plus a "dirty" flag; the tick timer sends the waiting one. Tests move the clock instead of sleeping.
- **HtmlService / Apps Script is not Node**: no `fetch`/`URL` in pure helpers (names ending `_`).
- **Stale servers and ports** break e2e on Windows: kill leftover `node` processes (PowerShell) before re-running.
- **Hallmark waivers**: four sloplint waivers are deliberate (44c, 79, 77, 78) and recorded in `src/app/globals.css`.
- **Check CI after a push**: GitHub CI was once silently red for rounds. Poll the public Actions API; times are UTC.

## Open items (none blocks cutover)

1. Visual leftovers: card row alignment, phone tab bar clips "List your game", rail has no scroll cue, home hero fold.
2. Unused `public/images/tavern` and `public/textures`: delete only with the owner's OK.
3. The Figma review file is outdated (pre-feedback design).
4. Offer the owner a locked `design.md` to retire the four lint waivers.
5. Product decisions still open: how "featured" games are chosen and capped, retention/erasure policy (self-erase exists, no
   automatic expiry), a second Cloudflare account owner.
6. After cutover: delete the two Google Forms and the old timers (keep the script: it is the mail relay), remove `TPK_API_URL`,
   consider `clasp logout` and revoking its token. `docs/forms.md` and the Sheet-based parts of `docs/setup.md`/`docs/curation.md`
   describe the retiring system until then.
7. The owner's older items: owner clean-up and launch of the community listing.

## How the owner works (applies to every session)

Reply in English. Commit locally after typecheck, lint and unit tests; run e2e, push, CI and deploys only when told. Never force-push.
Show text progress bars on long runs. UI changes follow the mandatory real-user rules in CLAUDE.md. Never print secrets
(`.cloudflare.local.json` and `.apps-script.local.json` are git-ignored on purpose).
