# Going live on the Cloudflare backend

The backend (ADR-25, [backend.md](backend.md)) is built and tested, but **nothing has been deployed**: it needs a D1 database, an R2
bucket, a few secrets and one email relay in your own accounts, which only you can create. This page is the shortest path. The live
site keeps running on the Google Sheet until the last step, so nothing breaks while you do this.

There was no real data in the Sheet when this was written (the live site listed 0 games), so there is nothing to import. If that has
changed, tell me before step 6.

## 1. Create everything in Cloudflare (one command, after one login)

```
npx wrangler login
npm run cloudflare:setup -- --dry     read what it will do
npm run cloudflare:setup
```

It makes the D1 database `quest-board` and the R2 bucket `quest-board-images`, applies the migrations, writes `wrangler.toml` (the
Pages project's bindings), and stores the secrets. It keeps the values you will need in `.cloudflare.local.json` (git-ignored).
It was written without access to a Cloudflare account and has never run for real: if a step fails, do the same by hand:

- Dashboard → Storage → D1 → create `quest-board`; Storage → R2 → create `quest-board-images`.
- Run the SQL in `worker/migrations/0001_init.sql` in the D1 console.
- Pages project → Settings → Bindings: D1 `DB` → quest-board; R2 `IMAGES` → quest-board-images.

## 2. Variables and secrets (Pages project → Settings)

| Name | Where | Value |
|---|---|---|
| `OWNER_EMAIL` | runtime variable | the owner's email: always an admin, can add and remove other admins |
| `SITE_URL` | runtime variable | `https://quest-board-tpk.pages.dev` |
| `BUILD_KEY` | runtime secret | the `buildKey` in `.cloudflare.local.json` |
| `DEPLOY_HOOK` | runtime secret | the Pages deploy hook address (the one the Apps Script has as `DEPLOY_HOOK`) |
| `MAIL_RELAY_URL`, `MAIL_SECRET` | runtime variable, secret | see step 3 |
| `TURNSTILE_SECRET` | runtime secret | optional, see step 4 |
| `TPK_API_BASE` | **build** variable | the site's address |
| `TPK_BUILD_KEY` | **build** variable | the same `buildKey` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | **build** variable | optional, see step 4 |

(If the dashboard locks the runtime variables because `wrangler.toml` exists, put the plain ones under `[vars]` in that file.)

## 3. Email: sign-in links and decision mails go through your Apps Script

There is no domain of our own to send mail from, so the backend asks your existing Apps Script (which already sends from your Gmail) to
send each message. It is limited to 90 mails a day and needs a secret.

```
npm run script:deploy        pushes the relay and makes .apps-script.local.json's mailSecret
npm run cloudflare:setup     stores that secret as MAIL_SECRET
```

Set `MAIL_RELAY_URL` to the Apps Script web app address (the `…/exec` one). Gmail's own sending limit applies; if the board grows
past about 90 sign-ins and decisions a day, switch the mailer to a sending service (`worker/src/email.ts`: Resend's code was the first
version and is a one-file change).

## 4. Turnstile (the robot check), optional but recommended

Cloudflare dashboard → Turnstile → add a widget for the site. Its **site key** is `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, its **secret** is
`TURNSTILE_SECRET`. Without them the sign-in form still works, with only the per-address and per-IP limits.

## 5. The timers

GitHub → the repo → Settings → Secrets and variables → Actions → add the secret `BUILD_KEY` (the same value). The workflow
`.github/workflows/cron.yml` then calls the backend every 10 minutes (sends a waiting build) and once a day (backs up to R2 as JSON and
two CSV files you can open in a spreadsheet, tidies, rebuilds so ended listings leave).

## 6. The cutover

1. Redeploy the Pages project (push, or retry the deployment) so `/api` exists and the build reads from it.
2. Open `/en/account/`, sign in with the owner's email, and check you get the email. Open `/en/admin/`.
3. Add the other admins there (their email addresses), and tell the Game Masters to sign in at `/en/list-your-game/`.
4. When you are happy: delete the two Google Forms and the timers in the Apps Script (keep the script: it is the mail relay), and
   remove `TPK_API_URL` from Cloudflare.

## If something goes wrong

- `GET /api/health?key=<buildKey>` answers counts and whether the deploy hook is set.
- The Activity log is the `activity` table (D1 console: `SELECT * FROM activity ORDER BY id DESC LIMIT 50`).
- Backups are in the R2 bucket under `backups/`. To restore, load the JSON's tables back with the D1 console or `wrangler d1 execute`.
