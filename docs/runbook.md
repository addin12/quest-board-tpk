# Runbook

What to do when something needs doing, or something breaks. Going live from scratch is [cutover.md](cutover.md); how the parts fit
together is [architecture.md](architecture.md); the API and data are [backend.md](backend.md); why they are the way they are is
[../DECISIONS.md](../DECISIONS.md).

## The parts, and where each one lives

| Part | Where | You open it to |
|---|---|---|
| The website and `/api` | https://quest-board-tpk.pages.dev, built by Cloudflare Pages from the `main` branch of the GitHub repo | see what players see; read a build log, retry, roll back |
| The admin page | `/en/admin/` on the site | release or hide held, reported or live listings, add admins, merge, publish now |
| The database | Cloudflare → Storage & databases → D1 → `quest-board` | read or fix rows (decide on the admin page, not here) |
| Pictures and backups | Cloudflare → R2 → `quest-board-images` (`covers/`, `photos/`, `backups/`) | download a backup |
| The timers | Cloudflare → Workers & Pages → `quest-board-cron` | read its logs and error count |
| The mail relay | the Apps Script project (`apps-script/Code.gs`), script.google.com | read **Executions** if mail stops |
| A look inside | `GET /api/health` with `Authorization: Bearer <build key>` | counts, last backup, last mail success and failure |

Everything runs on free plans. A change is on the site within about a minute (the pages read `/api/live`, cached 20 seconds), with nobody pressing a button. The
static copy (what search engines and link previews read) is rebuilt later: the backend asks Pages to rebuild at most once every 2 hours for an ordinary change, and within
10 minutes (12 times a day at most) when a listing has just gone live so its page exists; the one-minute tick sends a waiting one, and the Worker forces one build a day so
ended listings leave. Cloudflare's free plan allows 500 builds a month (about 390 at the most with these gaps).

A change stays marked "waiting" until the site itself shows it has been built: every build writes `/build.json` (the time its data was read) and the one-minute tick
compares it with the change. A build that never lands (refused, failed, over the monthly limit) is sent again after 10, 20, 40, then 60 minutes; after
three sends the owner gets an email and `/api/health` shows `deploy.failingSince` (ADR-46).

The build key and the other secrets are in `.cloudflare.local.json` (git-ignored, on the owner's computer) and in the Pages project's
encrypted variables. Losing the file is recoverable: `npm run cloudflare:setup` makes a new key and sets it on the project, then
`npm run cron:deploy` sets it on the Worker.

## Everyday jobs

| Job | How |
|---|---|
| Release or hide a listing | `/en/admin/` → Held (scam wording or 3 reports) or Live → open it → Release, or Hide with the reasons. The GM is emailed in both languages. A game of a held Game Master stays off the site until the Game Master is released. |
| Put a change live now | Admin page → **Publish now** |
| Add an admin | Admin page → Admins → Add admin (their email address; they sign in with an emailed link) |
| Remove an admin | Admin page → Admins → Remove (only the owner can) |
| Feature a game | Admin page → open an approved game → Feature |
| Verify a Game Master's WhatsApp number | The Game Master presses *Verify my number* on their account page and sends the message that opens (it holds their code, QB-XXXXX). In WhatsApp check that the sender's number is the one on their profile, then admin page → Game Masters → open the profile → *Mark number as verified* (it adds a "number verified" note to their public page). The button needs `NEXT_PUBLIC_VERIFY_WHATSAPP` set in Cloudflare Pages (the number the messages go to, digits with country code) and a new build |
| Merge two profiles of one person | Admin page → open the profile that should go → *Ask to merge into…*; the person it merges into accepts on their account page (request lapses after 7 days) |
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
| `The backend answered 5xx` | The backend is down or the database binding is missing. Check `GET /api/health` (build key header) and Pages → Settings → Bindings (`DB`, `IMAGES`). |
| `[data] warning:` lines | A record was unusable and dropped; the build kept the good ones. Read the line (it names the game or Game Master) and ask the GM to fix it. |
| `could not download the cover` | The picture is missing from R2. The card shows a colour instead. Ask the GM to upload it again. |
| Something about `npm` or `node` | Cloudflare uses `NODE_VERSION` = 24. Check that variable. |

Retry: Deployments → the failed one → Retry deployment. A build with bad data fails on purpose rather than publish it.

### Nobody can sign in (no email arrives)
1. `GET /api/health` (build key header) → `lastMailError` says why the last send failed (for example `mail_failed_quota`: Gmail's daily limit, it
   clears the next day; `mail_failed_unauthorized`: the secret in the Apps Script and in `MAIL_SECRET` differ, run `npm run script:deploy`
   then `npm run cloudflare:setup`). Open the Apps Script **Executions** page for Google's own error.
2. If Turnstile is on and the button on `/en/account/` never turns solid, the widget is blocked: check the browser console. To switch Turnstile
   off, remove `TURNSTILE_SECRET` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` from the Pages variables and rebuild; the rate limits remain.
3. The owner can always sign in with `OWNER_EMAIL`; if that variable is wrong nobody is an admin.

### The owner got "no backup for N hours" or "the daily backup failed"
The tick emails this at most once a day. Open the Worker `quest-board-cron` → Logs: a failing `daily` run shows the error. Common causes: the
Worker was deleted or its `BUILD_KEY` secret no longer matches (run `npm run cron:deploy`), R2 is over its free limit or switched off, or the
site was down at 01:30 Jakarta. Run the job by hand to test: `POST /api/cron?job=daily` with an `Authorization: Bearer <build key>` header and an `Origin` header of the site.
`GET /api/health` (build key header) then shows `lastBackupAt` and `backupError`.

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
There are two ways back. Both replace what is there now, so decide first which moment to go back to, and expect to lose what changed after it.

**A mistake in the last 7 days** (rows deleted or changed by accident, a bad migration): Cloudflare keeps the database's history (D1 Time Travel:
7 days on the free plan, 30 on the paid one) and puts the whole database back to a moment, in place.
1. `npx --yes wrangler@4.156.2 d1 time-travel info quest-board --timestamp="2026-11-06T10:00:00+07:00"` shows that the moment can be reached.
2. `npx --yes wrangler@4.156.2 d1 time-travel restore quest-board --timestamp=<the same moment as Unix seconds>` restores it. Wrangler prints a
   bookmark of the state it replaced: keep it, it undoes the restore (`--bookmark=<it>`).
3. Ask for a build (the admin page's **Publish now** button) so the static pages match.

**The database is gone, or the damage is older than 7 days**: the nightly backup. Every night the Worker copies the tables to R2 as
`backups/<date>.json` (accounts, profiles, games, admins, activity, merge requests, reports), with the games and profiles as CSV you can open in
a spreadsheet; the newest 14 days are kept. Sign-in links and sessions, rate limits and the backend's own state are left out on purpose: people
sign in again and the rest starts afresh (`NOT_BACKED_UP` in `worker/src/backup.ts`; a unit test fails if a new table is in neither list).
1. Cloudflare → R2 → `quest-board-images` → `backups/` → download the newest `<date>.json`.
2. `npm run restore:sql -- <folder>/<date>.json` writes `<date>.restore.sql` next to it and prints how many rows each table has. Check the
   numbers look right.
3. If the database still exists but is damaged beyond 7 days, delete it first (Cloudflare → D1 → `quest-board` → Settings → Delete). Download
   the backups before this: deleting the database does not touch R2, but check anyway.
4. `npm run cloudflare:setup -- --backend-only` makes an empty `quest-board` database, applies every migration and binds the site to it; the build then
   uses the empty day-one data instead of asking the (not yet restored) backend for it.
5. A changed binding reaches the site only with a new deployment: Cloudflare → the project → Deployments → **Retry deployment** (or push). Wait until
   `GET /api/health` (build key in an Authorization header) answers. **Do not sign in, and do not open the admin page, before step 6**: a new account for your
   address would make the load fail on its unique email.
6. `npx --yes wrangler@4.156.2 d1 execute quest-board --remote --file <folder>/<date>.restore.sql` loads the rows (one transaction: all or nothing;
   references are checked at the end).
7. Take care of the people erased since the backup (below), then run `npm run cloudflare:setup` again without the flag and **Retry deployment** once more:
   the build now reads the restored data. Sign in, press **Publish now**, and open a few games and Game Masters to check.
8. Delete the downloaded `.json` and `.restore.sql`: they hold personal data. (The timers Worker does not use the database, so it needs nothing.)

**A restore brings back everyone erased after the backup was made**, with their email, WhatsApp number, bio and games, because the backup still has them
and the erase left no trace in it. Before going public again, find them: in every backup newer than the one you loaded (they are kept 14 days) the `activity`
rows of kind `erased` (the person asked) or `expired` (two years unused) name the account id in `subject_id`; the old database has the same rows if it still exists.
Erase those accounts again (each person can also sign in with their address and use **Erase my account**). If no newer backup or old database is left, the
only list is the people who asked: tell them it needs doing again. Never publish the restored data before this is done.

The restore is tested: `tests/unit/worker.test.ts` takes a nightly backup of a database with every kind of row (a merged account included),
loads the SQL into a fresh database and compares every table. The backups sit in the same Cloudflare account as the database, so a copy outside
Cloudflare is kept on the owner's computer: `npm run backup:pull` (`scripts/pull-backup.mjs`, needs `wrangler` signed in) downloads the newest backup to
`../quest-board-backups` (next to the project, never inside it: the repository is public) or to a folder you name, and deletes copies older than 28 days, like the bucket does. Run it
by hand now and then, or have Windows run it weekly (not set up; one way, in PowerShell: `schtasks /Create /SC WEEKLY /D SUN /ST 09:00 /TN QuestBoardBackupPull
/TR "cmd /c cd /d D:TTRPGQuest Board TPK && node scriptspull-backup.mjs"`, removed again with `schtasks /Delete /TN QuestBoardBackupPull /F`). The copy holds names, emails and phone numbers: keep the folder private, and note that someone who erased their
account stays in a copy for up to 28 days (the site's own backups keep them 14).

### Mail is over the limit
Apps Script allows about 100 emails a day on a free Gmail account and the relay stops at 90. The backend splits those 90 by kind, each over a rolling
24 hours, so one kind can never use up another's share (`MAIL_BUDGET` in `worker/src/email.ts`, ADR-47):

| Kind | Mails a day | What it is |
|---|---|---|
| sign-in | 40 | the one-time links (counted when the link is asked for, so the visitor is told to try later) |
| decision | 20 | approved, not approved, merge requests; one that does not go is reported to the admin ("N decision email(s) could not be sent") |
| notice | 20 | the review digest to the owner and each admin, and the "still running?" warning to a Game Master whose game on request is about to run out (at most 5 a minute) |
| system | 10 | backup, publishing and expiry warnings to the owner or an inactive account |

`GET /api/health` shows `lastMailError`; `mail_budget_<kind>` there means that kind used its share. If the board outgrows 90 a day, move
`worker/src/email.ts` to a sending service on a domain of the community's own (one file; see "Mail deliverability" below).

### Mail deliverability: check it before the first invitation
The mails leave through a personal Gmail. Gmail to Gmail is usually fine; other inboxes are not proven. Before inviting Game Masters, request a sign-in
link to a test inbox at each of Gmail, Outlook and Yahoo (and one on a company domain if you have it), and write down for each: arrived in the inbox, in
spam, or missing, and how long it took (put the result in `docs/handoff.md`). If any lands in spam: ask the owner of that inbox to mark it "not spam"
once, and plan the move to a sending service on a domain of your own (about 10 USD a year) with SPF, DKIM and DMARC set up; the swap is `worker/src/email.ts`
only. Until then:
- Set a **Reply-To**: add `"mailReplyTo": "<a mailbox people read>"` to `.cloudflare.local.json`, run `npm run cloudflare:setup` (it sets `MAIL_REPLY_TO`) and
  `npm run script:deploy` (the relay script passes it on). Without it a reply goes to the personal Gmail that sends the mail.
- A burst of bounces or spam reports against the personal account can get Gmail suspended, taking the owner's own mail with it: keep the daily volume low
  and the sign-in page's "check your spam folder" hint.

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
| `GET /api/health` with `Authorization: Bearer <build key>` | counts, `lastBackupAt`, `backupError`, `lastMailOkAt`, `lastMailError` (no personal data) |
| GitHub *Uptime* workflow (every 15 minutes at :07, :22, :37 and :52, `.github/workflows/uptime.yml`) | the home page or the backend and database stopped answering: a failed run emails the repository owner. Best effort, so an outage under about 15 minutes may pass unseen. GitHub switches a schedule off after 60 days without any repository activity: re-enable it under Actions if that ever happens |
| An email "the site is not getting its changes" (once a day at most) and `deploy.failingSince` in `/api/health` | a change has waited half an hour or more: a build was refused, failed or never started. Read the newest deployment log; the tick keeps sending it again |
| GitHub *Uptime* workflow, step "The site is not stale" | `/build.json` is more than 36 hours old: the publishing is stuck even though every page answers (the daily build guarantees one at least every 24 hours) |
| A review digest by email ("To review: N waiting", to the owner and each admin) | submissions are waiting: sent once a burst has settled (10 minutes), at most every 3 hours, and again (once a day) when something has waited 3 days; no mail for a single save |
| GitHub CI on every push | the code breaks something |
| Dependabot (weekly) | outdated dependencies; its eslint major is ignored on purpose |

If mail itself is what broke, the alert email cannot be sent: look at `/api/health` now and then, or after any report of a missing email.

## Limits worth knowing

- The public data and pictures are given only to a request with the build key; the API address itself is public.
- Free-plan limits: Pages 500 builds a month; D1 and R2 are far above this site's size (10 GB of pictures is thousands of listings); the
  Worker's one-minute tick makes 1,440 calls a day, plus a few for each change, against 100,000.
- Accounts unused for two years are warned, then erased 30 days later (admins and the owner never). The daily job warns at most 3, or erases at most 1, a run (never both) (ERASE_PER_RUN and WARN_PER_RUN in `worker/src/retention.ts`, sized to the 50 queries a request may make).
