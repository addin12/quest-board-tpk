# Runbook

What to do when something needs doing, or something breaks. Going live from scratch is [cutover.md](cutover.md); how the parts fit
together is [architecture.md](architecture.md); the API and data are [backend.md](backend.md); why they are the way they are is
[../DECISIONS.md](../DECISIONS.md).

## The parts, and where each one lives

| Part | Where | You open it to |
|---|---|---|
| The website and `/api` | https://quest-board-tpk.pages.dev, built by Cloudflare Pages from the `main` branch of the GitHub repo | see what players see; read a build log, retry, roll back |
| The admin page | `/en/admin/` on the site | approve, reject, feature, add admins, merge, publish now |
| The database | Cloudflare → Storage & databases → D1 → `quest-board` | read or fix rows (decide on the admin page, not here) |
| Pictures and backups | Cloudflare → R2 → `quest-board-images` (`covers/`, `photos/`, `backups/`) | download a backup |
| The timers | Cloudflare → Workers & Pages → `quest-board-cron` | read its logs and error count |
| The mail relay | the Apps Script project (`apps-script/Code.gs`), script.google.com | read **Executions** if mail stops |
| A look inside | `GET /api/health?key=<build key>` | counts, last backup, last mail success and failure |

Everything runs on free plans. A change goes live in 2 to 5 minutes: the backend asks Pages to rebuild at most once every two minutes
(the 10-minute tick sends a waiting one), and the Worker forces one build a day so ended listings leave. Cloudflare's free plan allows
500 builds a month.

The build key and the other secrets are in `.cloudflare.local.json` (git-ignored, on the owner's computer) and in the Pages project's
encrypted variables. Losing the file is recoverable: `npm run cloudflare:setup` makes a new key and sets it on the project, then
`npm run cron:deploy` sets it on the Worker.

## Everyday jobs

| Job | How |
|---|---|
| Approve or reject a listing | `/en/admin/` → open it → Approve, or Reject with the reasons. The GM is emailed in both languages. **Approve the Game Master before their game.** |
| Put a change live now | Admin page → **Publish now** |
| Add an admin | Admin page → Admins → Add admin (their email address; they sign in with an emailed link) |
| Remove an admin | Admin page → Admins → Remove (only the owner can) |
| Feature a game | Admin page → open an approved game → Feature |
| Merge two profiles of one person | Admin page → open the profile that should go → *Merge into…* |
| Read what happened | D1 console: `SELECT * FROM activity ORDER BY id DESC LIMIT 50` |

## Changing the code

Commit to `main` and push. GitHub CI runs the audit, typecheck, lint, unit tests, the demo and empty builds, and the browser tests in
three browsers. Cloudflare builds and deploys the site and `/api` from the same push. Do not merge on red.

- **A schema change** is a new file in `worker/migrations/`. Apply it to the live database **before** pushing the code that uses it
  (`npm run cloudflare:setup` applies the ones not yet applied, and adds them to its list in `scripts/cloudflare-setup.mjs`).
- **The mail relay** (`apps-script/Code.gs`) is not deployed by the push: `npm run script:deploy` does it (needs `clasp`, see the top of
  `scripts/push-apps-script.mjs`). Its login lives in `.clasprc.json` in your user folder; end it with `npx @google/clasp@3.4.1 logout`
  and revoke it at https://myaccount.google.com/permissions.
- **The timers Worker** (`cron/`): `npm run cron:deploy`.

## Rolling back

- **The site and `/api`:** Cloudflare → the project → Deployments → an earlier successful production deployment → Rollback to this
  deployment. Or revert the commit on `main` and push. The data is read at build time, so a rollback serves old pages with old data.
- **The database** is not rolled back by a deployment. A migration is added columns only, so older code keeps working with it.

## When something breaks

### A build failed
You get an email from Cloudflare, and the admin page says *the last publish is not in this page yet*. The site that is live stays up as
it was. Open Cloudflare → Deployments → the failed one → its log.

| The log says | Cause and fix |
|---|---|
| `The backend answered 403` / `did not answer with JSON` | `TPK_BUILD_KEY` and `BUILD_KEY` differ. Run `npm run cloudflare:setup` (it sets both from `.cloudflare.local.json`), retry. |
| `The backend answered 5xx` | The backend is down or the database binding is missing. Check `GET /api/health?key=…` and Pages → Settings → Bindings (`DB`, `IMAGES`). |
| `[data] warning:` lines | A record was unusable and dropped; the build kept the good ones. Read the line (it names the game or Game Master) and ask the GM to fix it. |
| `could not download the cover` | The picture is missing from R2. The card shows a colour instead. Ask the GM to upload it again. |
| Something about `npm` or `node` | Cloudflare uses `NODE_VERSION` = 24. Check that variable. |

Retry: Deployments → the failed one → Retry deployment. A build with bad data fails on purpose rather than publish it.

### Nobody can sign in (no email arrives)
1. `GET /api/health?key=…` → `lastMailError` says why the last send failed (for example `mail_failed_quota`: Gmail's daily limit, it
   clears the next day; `mail_failed_unauthorized`: the secret in the Apps Script and in `MAIL_SECRET` differ, run `npm run script:deploy`
   then `npm run cloudflare:setup`). Open the Apps Script **Executions** page for Google's own error.
2. If Turnstile is on and the button on `/en/account/` never turns solid, the widget is blocked: check the browser console. To switch Turnstile
   off, remove `TURNSTILE_SECRET` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` from the Pages variables and rebuild; the rate limits remain.
3. The owner can always sign in with `OWNER_EMAIL`; if that variable is wrong nobody is an admin.

### The owner got "no backup for N hours" or "the daily backup failed"
The tick emails this at most once a day. Open the Worker `quest-board-cron` → Logs: a failing `daily` run shows the error. Common causes: the
Worker was deleted or its `BUILD_KEY` secret no longer matches (run `npm run cron:deploy`), R2 is over its free limit or switched off, or the
site was down at 01:30 Jakarta. Run the job by hand to test: `POST /api/cron?job=daily&key=<build key>` with an `Origin` header of the site.
`GET /api/health?key=…` then shows `lastBackupAt` and `backupError`.

### A status changed and nobody knows why
D1 console → `SELECT * FROM activity ORDER BY id DESC LIMIT 100`. Every decision, every change a GM made, every admin added or removed,
every merge, erasure and expiry is one row: when, what, which listing, and who (an admin's email, or *the daily job*). A row with no
matching entry was changed in the D1 console by hand.

### A listing must come down now
1. Admin page → reject it (a Game Master's profile is rejected on the Game Masters tab) → **Publish now**.
2. Within a few minutes the lists, the sitemap and the data no longer have it, and its own address shows *no longer listed* (no details,
   no contact). Cover images of removed games can linger in caches ([ADR-11](../DECISIONS.md)).
3. If it is a scam, keep the row: the reason is recorded.

### The build key or the deploy hook was shown somewhere
- **Build key:** delete `buildKey` from `.cloudflare.local.json`, run `npm run cloudflare:setup`, then `npm run cron:deploy` and retry the
  deployment. Both the project and the Worker get the new key.
- **Deploy hook:** Cloudflare → the project → Settings → Builds → Deploy hooks → delete the hook named `backend`; delete `deployHook`
  from `.cloudflare.local.json` and run `npm run cloudflare:setup`: it makes a new one and sets it.

### The database was damaged or deleted
Every night the Worker copies every table to R2 as `backups/<date>.json`, and the games and profiles as CSV you can open in a spreadsheet
(the newest 14 days are kept). Download the newest JSON. To restore, create a new D1 database, apply the migrations
(`npm run cloudflare:setup` does it), and load each table's rows back with `wrangler d1 execute` (the JSON holds `tables.<name>` as arrays of
rows). Then `npm run cloudflare:setup` again to point the project at it. A backup contains personal data: it is in the same Cloudflare
account; do not share it.

### Mail is over the limit
Apps Script allows about 100 emails a day on a free Gmail account and the relay stops at 90. Sign-in links and decisions share that
budget. The next day it works again. If the board outgrows it, move `worker/src/email.ts` to a sending service on a domain of the
community's own (one file).

### The whole site is down
It is static files on Cloudflare: check https://www.cloudflarestatus.com first. A visitor needs nothing but the static files; only signing
in, the account pages, the admin page and builds need `/api`.

## What watches the system

| What | Tells you |
|---|---|
| Cloudflare notification *Project updates → Deployment failed* | a build failed (email) |
| The admin page's *last publish is not in this page yet* | a publish did not reach the site |
| An email "no backup for N hours" or "the daily backup failed" | the timer or the backup is broken (at most one a day) |
| The Worker `quest-board-cron` error count in the dashboard | a tick or daily call failed |
| `GET /api/health?key=<build key>` | counts, `lastBackupAt`, `backupError`, `lastMailOkAt`, `lastMailError` (no personal data) |
| GitHub CI on every push | the code breaks something |
| Dependabot (weekly) | outdated dependencies; its eslint major is ignored on purpose |

If mail itself is what broke, the alert email cannot be sent: look at `/api/health` now and then, or after any report of a missing email.

## Limits worth knowing

- The public data and pictures are given only to a request with the build key; the API address itself is public.
- Free-plan limits: Pages 500 builds a month; D1 and R2 are far above this site's size (10 GB of pictures is thousands of listings); the
  Worker makes about 145 requests a day against 100,000.
- Accounts unused for two years are warned, then erased 30 days later (admins and the owner never). The daily job does at most 20 a run.
