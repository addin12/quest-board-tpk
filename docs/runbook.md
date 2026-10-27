# Runbook

What to do when something needs doing, or something breaks. Setup from scratch is in [setup.md](setup.md); how the
parts fit together is in [architecture.md](architecture.md); why they are the way they are is in
[../DECISIONS.md](../DECISIONS.md).

## The parts, and where each one lives

| Part | Where | You open it to |
|---|---|---|
| The website | https://quest-board-tpk.pages.dev, built by Cloudflare Pages from the `main` branch of the GitHub repo | see what players see |
| The admin page | `/en/admin/` on the site | approve, reject, feature, add admins, publish now |
| The Sheet (the database) | Google Sheets, the file *Quest Board TPK* | read the rows (decide on the admin page, not here) |
| The script | the Sheet's own Apps Script project: Sheet → Extensions → Apps Script | change code, read **Executions**, run `setup`, `backup`, `rotateBuildKey` |
| The two forms (and the report form) | Google Forms, owned by the Google account that owns the Sheet | change a question, see responses |
| Builds and the deploy hook | Cloudflare → Workers & Pages → the project | read a build log, retry, roll back |
| Google sign-in | Google Cloud console → the *Quest Board TPK* project → Google Auth Platform | Test users, the OAuth client |

Everything runs on free tiers. The script runs three timers: `tick` every minute (new responses, admin email, rebuild
after a change), `nightly` around 00:30 Jakarta (a rebuild, so ended games leave), `backup` on Mondays around 03:00.
A change goes live in 2–5 minutes: the script waits a minute after the last change, builds at most once every 5 minutes
and at most 20 times a day. Cloudflare's free plan allows 500 builds a month.

## Everyday jobs

| Job | How |
|---|---|
| Approve or reject a listing | `/en/admin/` → open it → Approve, or Reject with the reasons. The GM is emailed in both languages. **Approve the Game Master before their game.** |
| Put a change live now | Admin page → **Publish now** |
| Add an admin | Their Gmail in Google Cloud → Audience → **Test users**, **and** the admin page → Admins → Add admin. Both are needed. |
| Remove an admin | Admin page → Admins → Remove (and take them off Test users) |
| Feature a game | Admin page → open an approved game → Feature |
| Mark a game full | Admin page → open an approved game → Mark as full (Reopen to undo), then Publish now |
| Take a listing down | Reject it (or set an end date earlier), then **Publish now**. See *A listing must come down now* below. |
| Change what a form asks | Edit the form. A new wording is read as it is; a renamed question needs an entry in `COLUMN_ALIASES` in `Code.gs` ([forms.md](forms.md)). |

## Changing the code

**The site** (anything but `apps-script/`): commit to `main` and push. GitHub CI runs the audit, typecheck, lint, unit
tests, the demo and the empty-Sheet builds, and the browser tests in three browsers. Cloudflare builds the site from the
same push. Do not merge on red.

**The script** (`apps-script/Code.gs`) is not deployed by the push. One command does it, with Google's `clasp`:

```bash
npm run script:deploy          # pushes Code.gs and the manifest, moves the web app to a new version (same address)
npm run script:deploy -- --dry # only stages the files
```

Set it up once: `npx @google/clasp@3.4.1 login` (a Google consent page), switch on the Apps Script API at
https://script.google.com/home/usersettings, and put the Script ID and the deployment id (`npx @google/clasp@3.4.1
list-deployments`: the one that is not @HEAD) in `.apps-script.local.json` (git-ignored). The login is kept in
`.clasprc.json` in your user folder: anything running as you can read it. To end it: `npx @google/clasp@3.4.1 logout`
and revoke it at https://myaccount.google.com/permissions. `CreateForms.gs` is never pushed. If a `setup` run is
needed (a new column or timer), run it by hand in the editor afterwards.

Or by hand:

1. Open the file, copy all of it. In the Sheet: Extensions → Apps Script → `Code.gs` → select all → paste → save.
2. If the change adds a Sheet column or a timer, run `setup` (it is safe to run again; it keeps the build key).
3. Deploy → Manage deployments → the pencil → Version: **New version** → Deploy. The web address stays the same.

The timers use the saved code at once; the web address (`doGet`, `doPost`) uses the deployed version.

## Rolling back

- **The site:** Cloudflare → the project → Deployments → an earlier successful production deployment → Rollback to this
  deployment. Or revert the commit on `main` and push. Remember that the data is read at build time: a rollback serves
  the old pages and the old data together.
- **The script:** Deploy → Manage deployments → the pencil → Version: pick the earlier one → Deploy. The saved code that
  the timers use is only changed by pasting the old file back.

## When something breaks

### A build failed
You get an email from Cloudflare, and the admin page says *the last publish is not in this page yet*. The site that is
live stays up as it was. Open Cloudflare → Deployments → the failed one → its log.

| The log says | Cause and fix |
|---|---|
| `The data script answered 405` / `did not answer with JSON` / `forbidden` | `TPK_API_URL` in Cloudflare is wrong. It must be one line: the web address ending in `/exec`, then `?key=` and the build key. Nothing else in it. Fix it, retry. |
| `forbidden` with a good-looking value | The key changed. Run `setup` (it logs the current key) and put that key in `TPK_API_URL`. |
| `[data] warning:` lines | A record was unusable and dropped; the build kept the good ones. Read the line (it names the game or Game Master) and ask the GM to fix it with their edit link. |
| `could not download the cover` | A picture is not shared by link or is not an image. The card shows a colour instead. Open the row in the Sheet, check the Drive link opens when signed out. |
| `generateStaticParams ... empty array` | Fixed in the code (a placeholder page). If it comes back, someone removed `src/lib/static-params.ts`. |
| Something about `npm` or `node` | Cloudflare uses `NODE_VERSION` = 24. Check that variable. |

Retry: Deployments → the failed one → Retry deployment. A build with bad data fails on purpose rather than publish it.

### Responses do not appear in the Sheet, or get no Id
1. Is the form still linked to the Sheet? Form → Responses → the Sheets icon. The tabs must be called *Games* and *GM profiles* (capitals do not matter).
2. In the script editor, open **Executions**: a failed `tick` shows its error. Run `setup` and read the log: it lists missing columns or properties.
3. Open the **Triggers** page: `tick`, `nightly` and `backup` must be listed. If not, run `setup`.

### A status changed and nobody knows why
Open the **Activity** tab of the Sheet. Every decision, every edit the script noticed, every change on the admin page, every
admin added or removed, every rebuild, backup and `setup` run is one line there: when, what, which listing, and who (an
admin's email, or *script*). A status that changed with **no line** in the Activity tab was changed by hand in the Sheet,
or by Version history or undo. Compare the time with File → Version history. The tab keeps the latest 5,000 lines.

### An admin cannot sign in
- *Access blocked*: their Gmail is not under Google Cloud → Audience → **Test users**.
- *origin_mismatch*: the site's address is not an authorized origin on the OAuth client (it must be exactly `https://quest-board-tpk.pages.dev`). Google can take a few minutes to accept a change.
- *Your sign-in expired*: sign in again (the token lasts an hour).
- *This account is not an admin*: add the Gmail on the Admins tab of the admin page.

### A listing must come down now
1. Admin page → reject it (a Game Master's profile is rejected on the Game Masters tab) → **Publish now**.
2. Within a few minutes the lists, the sitemap and the data no longer have it, and its own address shows *no longer
   listed* (no details, no contact). Before this was built the old page could linger for up to 7 days
   ([ADR-11](../DECISIONS.md)); pages removed earlier still can, and so can cover images of removed games.
3. If it is a scam, also tell the GM's contacts if you know them, and keep the row: the reason is recorded in the Sheet.

### The build key or the deploy hook was shown somewhere
- **Build key:** in the script editor run `rotateBuildKey`, copy the key it logs, put it in Cloudflare's `TPK_API_URL`
  (`…/exec?key=…`), retry the deployment.
- **Deploy hook:** Cloudflare → Settings → Builds → Deploy hooks → delete the old one, create a new one, then set the
  script property `DEPLOY_HOOK` to the new address (Project Settings → Script properties; if you cannot find it, a
  one-line function that calls `PropertiesService.getScriptProperties().setProperty('DEPLOY_HOOK', '…')`, run once and
  deleted again, does the same).

### The Sheet was damaged or deleted
Every Monday the script copies the whole Sheet into the Drive folder *Quest Board TPK backups* (the newest 8 are kept).
Open the newest copy; in the live Sheet paste its `Games` and `GM profiles` rows back under the headers (same columns,
including the admin ones, so statuses and ids survive), then run `setup` and wait a minute. A copy contains personal
data: it is in the same Drive account, do not share the folder.

### Emails stop arriving
Apps Script can send 100 emails a day on a free account. The script bundles the admin notices and sends one decision
email per decision; a burst of more than ~90 decisions in a day is the only way to hit it. The next day it works again.
Open **Executions** to see the quota error.

### The whole site is down
It is static files on Cloudflare: check https://www.cloudflarestatus.com first. Nothing on the site needs the script
to be up (only a build does), so a script outage does not take the site down.

## What watches the system

| What | Tells you |
|---|---|
| Cloudflare notification *Project updates → Deployment failed* | a build failed (email) |
| The admin page's *last publish is not in this page yet* | a publish did not reach the site |
| GitHub CI on every push | the code breaks something |
| Dependabot (weekly) | outdated dependencies; its eslint major is ignored on purpose |
| `…/exec?action=health&key=<build key>` | a read-only look inside the script: tabs, timers, properties, row counts, the last rebuild and the backup folder, as names and counts only. Calling it writes one *health check* line to the Activity tab. |
| The Activity tab of the Sheet | what changed, when and by whom, for every listing and admin (see *A status changed and nobody knows why*) |
| The weekly Drive backup | nothing, until you need it: look at the folder now and then |

## Limits worth knowing

- The Google app stays in *Testing*: at most 100 test users, and admins see Google's "has not verified this app" screen
  once ([ADR-12](../DECISIONS.md)).
- The web address of the script is public (the admin page needs it); the data behind it is only given to the build key.
- A page that was removed before the tombstone change can linger up to 7 days; every listing approved since cannot.
