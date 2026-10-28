# DECISIONS: why Quest Board TPK is built this way

Context, decision, consequences. Add one when a choice affects the whole project or would surprise a newcomer.

## ADR-1: No bookings, no payments, no accounts (2026-10-26)
**Context.** v1 let players book seats and tracked payments. For a volunteer community that is a lot to run and to be
trusted with (accounts, passwords, refunds, scams), and players and GMs already talk on WhatsApp.
**Decision.** The site is a noticeboard: listings and a "message the GM" button. Everything after the first message is between people.
**Consequences.** Nothing to breach except public listings and the GMs' public contact details. No booking conflicts, no payment disputes in our hands.
The cost: we can't tell whether a game is full.

## ADR-2: Static site, with a Google Sheet as the database (2026-10-26)
**Context.** It must be free for a community, with no credit card and no server to keep alive.
**Decision.** Next.js static export on Cloudflare Pages. Data: two Google Forms → one Sheet. A Google Apps Script bound to the Sheet is the only
backend: it serves the public JSON and the admin API.
**Consequences.** Free, and nothing to patch or back up (Google keeps the Sheet's history). The data is rebuilt into the site, so an approval is
live after a build (about 1–3 minutes), not instantly. Apps Script has quotas (see docs/setup.md) that are far above what a community needs.

## ADR-3: Admins review on our own page, not in the Sheet (2026-10-26)
**Context.** Curating in a spreadsheet means reading many columns, no preview, no checks, no email to the GM, no audit trail you can trust.
**Decision.** A review page (`/en/admin/`): a queue, a preview of the card, automatic checks, one-click approve and reject with reasons, undo, bulk
approve, keyboard shortcuts, and admin management. It signs in with Google; the script verifies the ID token and checks the Admins tab.
**Consequences.** Needs a Google OAuth client id (free, no billing, no verification for basic sign-in). Adding an admin is one email address on the page.
The owner is always an admin, so nobody can lock themselves out.

## ADR-4: The script serves only a fixed list of public fields (2026-10-26)
**Context.** The Sheet holds emails, notes and unapproved content. The public endpoint has no login.
**Decision.** `buildPublic_` copies named fields of approved, unexpired records. The build validates the result again.
**Consequences.** A new public field needs a change in three places (types, script, data check): deliberate friction.

## ADR-5: Editing a response sends it back to review (2026-10-26)
**Context.** Google Forms lets a GM edit their response through the edit link. An approved listing could be changed to anything.
**Decision.** The script hashes each response's content; a changed hash sets the status back to pending (and removes it from the site).
It does not depend on a form-submit trigger firing for edits.
**Consequences.** A typo fix takes a listing off the site until an admin approves again. Safe, if sometimes slow.

## ADR-6: One language per URL prefix, English by default (2026-10-26)
**Context.** No server to negotiate languages; search engines want one address per language.
**Decision.** `/en/…` and `/id/…` are separate static pages; `/` redirects to `/en/` (`public/_redirects`). The toggle keeps the page and filters.
GM-written content is shown as written.
**Consequences.** Each page is built twice. An unknown address gets one bilingual 404 (`global-not-found`, an experimental Next flag).

## ADR-7: The browser never talks to Google except on the admin page (2026-10-26)
**Context.** Visitors on slow phones, and privacy.
**Decision.** Pictures are downloaded at build time, cropped and converted to WebP; the site is self-contained. Only the admin page loads Google's sign-in script.
**Consequences.** A cover appears on the site after the next build. The CSP can be strict (`public/_headers`).

## ADR-8: The build fails rather than publish bad data (2026-10-26)
**Context.** If the script is unreachable or answers nonsense, an empty site would replace a good one.
**Decision.** `scripts/build-data.mjs` exits with an error; Cloudflare keeps the live deployment. Individual bad records are dropped with a warning.
**Consequences.** A broken Sheet never empties the site; the cost is a failed build to look at.

## ADR-9: Prefetch files are copied to the names the browser asks for (2026-10-26)
**Context.** Next 16 (static export) writes prefetch data into nested folders but requests dotted file names: every link logged 404s and left the page title empty after following a link.
**Decision.** `scripts/fix-export.mjs` copies each nested file to its dotted name after the build.
**Consequences.** A few more files in `out/`. If a later Next version fixes this, the script finds nothing to copy.

## ADR-10: Form option text is generated from the site's words (2026-10-26)
**Context.** The script turns the form's option text ("Urban fantasy") back into the site's key (`urban`). Slugifying the label failed for 4 of 57 categories, and a mismatch silently drops a category.
**Decision.** `npm run form-options` writes the label→key table into `Code.gs` and the options list into `docs/form-options.md`; a test fails when either is stale.
**Consequences.** Changing a genre's English name means running one command and updating the form.

## ADR-11: An address that was live is never dropped: it shows "no longer listed" (2026-10-27)

**Context.** Tested with probe pages: when a page disappears from a deployment, Cloudflare Pages keeps answering at its
address with the last copy (`CF-Cache-Status: HIT`, `Cache-Control: public, s-maxage=604800`) for up to 7 days. Pages
that merely change are refreshed at once (probed again: a cached page replaced by a changed one showed the new version straight away). Four header variants on the probes (`no-store`, `Cloudflare-CDN-Cache-Control:
no-store`, `CDN-Cache-Control: no-store`, `s-maxage=0`) made no difference, so it is the platform, not our headers.

**Problem.** Rejecting (or the nightly expiry of) a listing removes it from the lists, the sitemap and the data at the
next build, but its own address can still show the old page for days. Nothing can purge it from here: the `pages.dev`
zone is Cloudflare's, and a purge needs a zone of our own.

**Decision.** A tombstone. The script records `WasLive = yes` in the Sheet when a listing is approved. The public data
carries two lists of addresses, `goneGames` and `goneGms`: listings that were live and are not now (rejected, sent back
to review by an edit, expired, or a replaced profile), dropped 180 days after they went offline (a game: after it ended).
The site builds a page at each of them that says so: no title, no details, no contact, `noindex`, not in the sitemap.
Because the page changes instead of vanishing, Cloudflare replaces its cached copy at the next build. Only listings
that were once public get one, so a pending title never appears. Not chosen: accepting the delay, or a domain of our own
with a purge after each build (costs money).

**Consequences.** One more Sheet column (`setup()` adds it and `sync_` fills it for anything already approved), a few
hundred more tiny pages at most, and new texts (`gone.*`). Pages removed before this existed, and cover images of
removed games, can still linger up to 7 days; the images can only be found through a page that no longer shows them.

## ADR-12: The Google app stays in "Testing" (2026-10-27)
**Context.** Admin sign-in uses a Google OAuth client. Moving the app to "In production" needs the app's home page, privacy policy and terms to sit on a domain registered under Authorized domains, and `pages.dev` is a shared domain that cannot be registered. The Publish button stays disabled without it. A domain costs money; the community edition must stay free.
**Decision.** Keep the app in Testing and list every admin under Audience → Test users (up to 100). The page only signs people in, so the 7-day limit on Testing tokens does not matter.
**Consequences.** Adding an admin is two steps (Test users and the Admins tab; the Admins tab says so). Admins see Google's "has not verified this app" screen once. If the community gets its own domain, publishing is a Google Cloud change plus a privacy and a terms page; nothing else changes.

## ADR-13: The public data needs a secret build key (2026-10-27)
**Context.** The script's web address must be public (the admin page calls it from the browser), and `?action=public` returns the GMs' WhatsApp numbers as plain data, so anyone who found the address could read all of them in one request.
**Decision.** `?action=public` answers only a request carrying `key=<BUILD_KEY>` (a script property that `setup()` creates). The key lives in Cloudflare's `TPK_API_URL`, never in a `NEXT_PUBLIC_` variable. No key set means closed, not open. The comparison does not stop at the first difference. `rotateBuildKey()` replaces it.
**Consequences.** One more value to keep right in `TPK_API_URL`: a wrong one fails the build (the live site stays up). The numbers are still in the built pages in a hidden form, as before; the key only closes the bulk-read route.

## ADR-14: Sheet columns and tabs are matched loosely (2026-10-27)
**Context.** The owner edited the generated forms (capitals, "Session Date", "Schedule Notes", a retitled cover question); exact matching would have reported most columns as missing.
**Decision.** Capitals, spaces and punctuation do not matter, for column titles and tab names; three renames are aliases in `COLUMN_ALIASES`. A test uses the owner's real headers.
**Consequences.** Forms can be reworded freely within that rule. A genuinely new wording needs an alias, and `setup()` still reports a column it cannot find.

## ADR-15: A site with no listings still has one page per route (2026-10-27)
**Context.** `output: "export"` refuses a dynamic route with no pages. The first deploy failed against the empty Sheet.
**Decision.** `slugParams` builds one placeholder page when there are no items; it shows "not found", is `noindex` and is in no list or sitemap. CI builds the empty-Sheet state (`TPK_DATA_FILE=data/empty.json`) and checks it.
**Consequences.** `/en/games/none/` exists. A real slug always ends in `-` and four characters, so it never clashes.

## ADR-16: The forms are created by a script (2026-10-27)
**Context.** Building two forms of ~30 questions by hand from a document is slow and error-prone.
**Decision.** `apps-script/CreateForms.gs` creates the forms, the Sheet and the report form from the same option lists as the site (`npm run form-options`). A test keeps its question titles equal to the columns `Code.gs` reads.
**Consequences.** Google's scripting service cannot add file-upload questions or choose "Verified" email collection, so those are two documented manual steps per form. The script is not part of the backend and is run once.

## ADR-17: The Sheet is backed up weekly to Drive (2026-10-27)
**Context.** The Sheet is the whole database; one deleted row or tab loses listings.
**Decision.** `backup()` (a Monday timer) copies the Sheet into the Drive folder *Quest Board TPK backups* and keeps the newest 8. Restoring is pasting rows back ([runbook](docs/runbook.md)).
**Consequences.** Copies hold personal data in the owner's own Drive. Forms still keep their own response history, a second source.

## ADR-18: Stay on Cloudflare Pages for now (2026-10-27)
**Context.** The dashboard calls the Pages flow "legacy" and steers new projects to Workers. Workers needs a config file in the repo, and the script's rebuild relies on a Pages deploy hook.
**Decision.** Stay on Pages. Revisit when Cloudflare announces an end date for Pages, or if the deploy hook has no Workers equivalent we can use.
**Consequences.** A later move is one config file and a new hook address in the script property `DEPLOY_HOOK`.

## ADR-19: Visit counts, if wanted, come from Cloudflare Web Analytics (2026-10-27)
**Context.** The community may want to know whether the board is used. A script of our own, or a cookie, would need a privacy page and a consent banner.
**Decision.** Allow Cloudflare Web Analytics (cookieless, no personal data, free) in the Content-Security-Policy (`script-src` and `connect-src`, one host each). It is switched on in the Cloudflare dashboard, not in code, and does nothing while it is off.
**Consequences.** Two more allowed hosts in the policy. Counts are page views and countries, not people.

## ADR-20: The Sheet keeps its own audit trail, the Activity tab (2026-10-27)
**Context.** Two decided test rows went back to "pending" with their review cells empty after a script update, and nothing recorded why. The Sheet is the whole database and has no history of its own except Google's version history.
**Decision.** `logEvent_` appends a line to an *Activity* tab for every status change the script makes (new submission, an edit sent back to review, a row approved by hand, a profile replaced), every admin decision and change, every admin added or removed, every rebuild request, backup, key replacement and `setup` run: time, what, kind, id, title, detail, who. Titles and details are stored as plain text so that a title starting with `=` cannot run as a formula. A failing log never breaks the work. The tab keeps the latest 5,000 lines.
**Consequences.** A status change with no line is a hand edit in the Sheet, which is itself a finding. The tab holds listing titles and admin emails: it is private, like the rest of the Sheet, and is copied by the weekly backup. Sign-in refusals are not logged (they could flood it).

## ADR-21: The script is deployed with clasp, by one command (2026-10-27)
**Context.** Updating the script meant pasting `Code.gs` into the editor and clicking through a new version by hand, every time, by the one person with the Google account.
**Decision.** `npm run script:deploy` stages `Code.gs` and the manifest (never `CreateForms.gs`), pushes them with Google's `clasp` (pinned, `@google/clasp@3.4.1`) and moves the existing deployment to a new version, so the web address stays the same. The Script ID and the deployment id live in a git-ignored `.apps-script.local.json`. The staging folder is inside the repo, because clasp refuses a folder reached through a link (Windows temp folders). Before the first push the live project was downloaded and compared with the repo: identical.
**Consequences.** clasp keeps a Google login token in the user's folder, which the person who turns it on accepts and can end (`clasp logout`, revoke at Google). A run of `setup` is not possible from here (it needs an executable API deployment), so a change that needs one still ends with one click in the editor.

## ADR-22: The site is redesigned with Hallmark's Halftone theme (2026-10-28)
**Context.** The medieval-tavern look (wood planks, parchment, Cinzel capitals, a gold accent word, a fireplace hero) read as a themed template, and Hallmark's linter counted 90 Floor failures and 24 reflexes on it.
**Decision.** A full redesign with [Hallmark](https://github.com/Nutlope/hallmark): the Halftone theme (butter-cream stock, brown-black ink, one vermilion, Ultra over Chivo, square wells, a dot screen), a derived dark stock, a masthead nav, a statement footer, games shown as playbills (cover over a ruled label panel), the home page as Corridor hero, Rail, Index, Rows and a closing band. Content, links, forms, handlers and test hooks are unchanged. The admin keeps its layout and takes the palette and one family (an app screen). Decisions are stamped at the top of `src/app/globals.css`; `tokens.css` and `base.css` came from `theme.mjs scaffold`.
**Consequences.** 0 Floor failures and 0 reflexes (three waived, on the record in the stamp). Icons beside labels and the tavern hero picture are gone (the stamp lists them); `public/images/tavern/` and `public/textures/` are now unused. The icon stylesheet is generated with a Hallmark check stamp. Tavern wording that tests pin (the theme names, "Back to the tavern") is unchanged.

## ADR-24: Jabodetabek and online only; a short description of at most 80 characters (2026-10-28)
**Context.** The community plays mostly in Jabodetabek. A city filter and a "across Indonesia" promise suggested a wider reach than it has, and long one-line summaries were cut mid-sentence on the cards.
**Decision.** The forms offer the six Jabodetabek areas (and *Online only* for a GM's profile); the site's city filter is removed; the home copy says Jabodetabek. The short description (`One-line summary`) is limited to 80 characters and the card shows all of it; the long one is `Full description`. The admin page warns about a city outside Jabodetabek and about a long short description, and blocks nothing.
**Consequences.** The live forms are changed by hand (steps in [forms](docs/forms.md#scope-jabodetabek-and-online)); the script needs no redeploy. Older listings keep their longer text until their GM edits it.
