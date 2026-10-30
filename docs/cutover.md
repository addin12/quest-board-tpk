# Going live on the Cloudflare backend

The backend (ADR-25, [backend.md](backend.md)) was switched on with these steps on 2026-10-30 (the log is in [handoff.md](handoff.md)). It needs a D1 database, an R2
bucket, a few secrets and one email relay in the owner's own accounts. This page is the shortest path, kept for a rebuild from scratch or a new owner.
There was no real data to import when it went live (the old Sheet held 0 games).

## 1. Create everything in Cloudflare (one command, after one login)

```
npx wrangler login                          a Cloudflare page opens: click Allow
npm run cloudflare:setup -- --dry           read what it will do
npm run cloudflare:setup
```

R2 must be switched on once first (dashboard → Storage & databases → R2 → enable; the free plan, it may ask for a payment method):
Cloudflare does not allow that through the API, and the script stops with that message if it is off.

The script makes the D1 database `quest-board` and the R2 bucket `quest-board-images`, applies the schema to an empty database, makes a
deploy hook for the backend, and sets the Pages project's **bindings and variables through the Pages API**. There is deliberately no
`wrangler.toml` in the repo: a config file there makes the dashboard lock its variables, and the repo is public. It keeps what it
generated in `.cloudflare.local.json` (git-ignored). Run it again whenever you change something: it reuses what exists.

If a step fails, do the same by hand: create the D1 database and the R2 bucket in the dashboard, run
`worker/migrations/0001_init.sql` in the D1 console, and under Pages project → Settings → Bindings add D1 `DB` and R2 `IMAGES`.

## 2. Variables and secrets (the script sets these; this is the list)

| Name | Kind | Value |
|---|---|---|
| `OWNER_EMAIL` | encrypted | the owner's email (the Cloudflare account's, or `OWNER_EMAIL=… npm run cloudflare:setup`): always an admin |
| `SITE_URL` | plain | `https://quest-board-tpk.pages.dev` |
| `BUILD_KEY` | encrypted | the `buildKey` in `.cloudflare.local.json` |
| `DEPLOY_HOOK` | encrypted | a deploy hook the script makes (named `backend`) |
| `MAIL_RELAY_URL`, `MAIL_SECRET` | encrypted | the Apps Script web app address (already on the project) and the secret from step 3 |
| `TPK_API_BASE` | plain, used by the build | the site's address |
| `TPK_BUILD_KEY` | encrypted, used by the build | the same `buildKey` |
| `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | encrypted, plain | optional, see step 4 |

## 3. Email: sign-in links and decision mails go through your Apps Script

There is no domain of our own to send mail from, so the backend asks your existing Apps Script (which already sends from your Gmail) to
send each message. It is limited to 90 mails a day and needs a secret.

```
npm run script:deploy        pushes the relay and makes .apps-script.local.json's mailSecret
npm run cloudflare:setup     stores that secret as MAIL_SECRET
```

Gmail's own sending limit applies; if the board grows past about 90 sign-ins and decisions a day, switch the mailer to a sending
service (`worker/src/email.ts`: one file).

## 4. Turnstile (the robot check), optional but recommended

`npm run cloudflare:setup -- --turnstile` makes the widget (free) and stores its keys; rebuild afterwards (the site key is a build variable).
Without it the sign-in form still works, with only the per-address and per-IP limits. Check the button on `/en/account/` enables in a normal browser.

## 5. The timers

The backend needs something to call it every 10 minutes (sends a waiting build) and once a day (backs up to R2 as JSON and two CSV
files you can open in a spreadsheet, tidies, rebuilds so ended listings leave). `npm run cron:deploy` deploys the Worker in `cron/`
with its two cron triggers and stores the `BUILD_KEY` secret. Free plan; no GitHub secret, and none of GitHub's rule that switches
scheduled workflows off after 60 days without repo activity.

## 6. The cutover

1. Redeploy the Pages project (push, or retry the deployment) so `/api` exists and the build reads from it. **On a fresh project** the
   build cannot read an `/api` that is not deployed yet, so run `npm run cloudflare:setup -- --backend-only` first (the build then uses
   the empty day-one data), push, and when `/api/health` answers run the setup again without the flag and trigger a rebuild.
2. Open `/en/account/`, sign in with the owner's email, and check you get the email. Open `/en/admin/`.
3. Add the other admins there (their email addresses), and tell the Game Masters to sign in at `/en/list-your-game/`.
4. The Google Forms and the Sheet are not read by anything: delete them in Google when you like. The Apps Script is kept (it is the mail
   relay); its old triggers remove themselves within a minute of `npm run script:deploy`.

## If something goes wrong

- `GET /api/health?key=<buildKey>` answers counts and whether the deploy hook is set.
- The Activity log is the `activity` table (D1 console: `SELECT * FROM activity ORDER BY id DESC LIMIT 50`).
- Backups are in the R2 bucket under `backups/`. To restore, load the JSON's tables back with the D1 console or `wrangler d1 execute`.
