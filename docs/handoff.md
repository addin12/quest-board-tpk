# Handoff: where the project stands (2026-11-06)

For the next agent or person. Read this first, then [CLAUDE.md](../CLAUDE.md). Facts here are the ones the code and git history
don't tell you.

## State at the end of 2026-11-06 (newest; the sections below are older and kept for the record)

**Everything is pushed and CI is green; the live site is built from it.** The live site still has **0 games and 0 Game Masters**, so the pages that depend on listings
(browse blocks, the landing pages for a system or an area, the quiz's matches) are empty or absent there and show only in the local demo. Live D1 has migrations
**0001 to 0010** (0009 `repeat_days`/`nudged_at` is unused since ADR-52). The decisions are **ADR-40 to ADR-57** in [DECISIONS.md](../DECISIONS.md); the visual rules are in
[design.md](../design.md). Read those two and [indonesian-review.md](indonesian-review.md) first.

What changed since 2026-11-02, in the order a new reader needs it:
- **Publishing (ADR-40, 46, 48):** a Game Master's save is live at once (status `approved`); only wording the scam check dislikes is held for an admin's look. The public data carries no
  phone number: `POST /api/contact` gives one on a tap. Pages that list games follow `/api/live` (edge-cached 20 s); an address the build does not know yet is handed from the 404 page to
  `/view/`. Builds: an ordinary change waits up to 2 h, a listing that just went live 10 min (12 a day).
- **Mail (ADR-44, 45, 47):** reviewers get a digest, not a mail per save; each kind of mail has its own share of the 90 a day; a merge of two accounts needs the answer of the person it merges into.
- **Game form (ADR-49, 52, 53):** five steps beside the board's own card as a live preview; games "on request" (no fixed date, listed 90 days, Extend +30); several places per game (ten areas, `src/lib/areas.ts`); up to five genres; safety tools and content warnings required.
- **Account page (ADR-54):** one centred column; games first, the profile beside them as the Game Masters list shows it; the profile form follows the game form (`src/components/account/`).
- **Backups (ADR-55):** the nightly JSON now holds every table that matters (`TABLES` in `worker/src/backup.ts`, a test fails if a migration adds one that is in neither list); `npm run restore:sql -- <backup.json>` writes the restore SQL; the runbook puts D1 Time Travel first for the last 7 days.
- **Discovery (ADR-56):** `/systems/<slug>/` and `/areas/<slug>/` exist only for curated systems and the ten areas that have a game at build time (placeholders when none; CI's empty-data build checks that); `/find-a-game/` is a five-question quiz; the phone list rows use a 240 x 300 `-xs` cover. The games list has an Area filter (ADR-58, `?place=Depok`); the system tiles still lead to the filtered list, not to the landing pages.
- **Signed-in bar (ADR-57):** a thin line above the masthead, "Signed in as <name>" and "Your account", driven by a note in browser storage that the account page writes (`src/lib/signed-in.ts`).

**Open, none blocks use (all wait for the owner):** a first real Game Master end to end on live (real sign-in email, the Turnstile checkbox the owner must click, a picture, the phone-number tap; `tests`-style checks are no substitute); the Indonesian wording of every string listed in [indonesian-review.md](indonesian-review.md); whether the places list should go beyond Jabodetabek; the merge email to the address that has a real account; Reply-To (`npm run script:deploy` and `mailReplyTo`); Outlook and Yahoo test inboxes; the GM invitation (still names The Pandemonium Kollektive); a backup copy outside Cloudflare; an outside uptime monitor (GitHub's scheduled check ran 5 times in 15 hours).

**Running the site by hand:** `node scripts/e2e-build.mjs` builds the demo-data site into `out/`; then `PORT=4174 node --conditions=react-server --import ./tests/loader.mjs tests/support/test-server.ts` serves it with the real backend on an in-memory database
(`tests/support/test-server.ts`; its header lists the helper calls). `/__test/enter?email=<address>&to=<path>` signs a browser in without mail (`owner@example.com` is the admin). Data lives in memory: a restart empties it. Playwright needs port 4174 free, so stop this server before `npx playwright test`.

**Lessons from 2026-11-06:** stopping a background `npx playwright test` leaves its test server on port 4174 (kill it by port before the next run); a progress watcher reading the log of a killed run reports the old failures; Git Bash heredocs lose backslashes in regexes (use the Edit tool); a bar or note that repeats a line a page already shows breaks `getByText` strict mode in the tests; CI's browser install can stall (the second try now follows an apt repair step, untested because the stall did not recur).

## State at the end of 2026-11-02 (read this before the older sections below)

**Everything is pushed (`9b1bc29`) and CI is green; the live site is built from it.** Nothing is local-only. Live D1 has migrations 0001 to 0004
(0004 adds `profiles.instagram`, applied 2026-11-02 before the push). The live site still has 0 games and 0 GMs, so the browse blocks, the GM search box
and the demo-only features show only in the local demo build (`npm run build && npm run preview`, port 4173).

What the day added, with the decisions in DECISIONS.md (ADR-34 to ADR-39) and design.md: 143 game systems, each with its own cover picture
(publisher art, owner's explicit choice, credits and removal steps in [art-credits.md](art-credits.md); `npm run tiles` makes the small copies);
40 genre pictures from StartPlaying; pager of nine games a page; search everywhere with synonyms (`src/lib/search.ts`: dnd, d&d, science fiction,
coc, vtm ...); `SearchPicker` for the system, genre, play style and mechanic filters and the GM form's system field; a phone filter sheet; a sliding
sticky header; five written motions (MOTION dial is 2); Plus Jakarta Sans for reading text; Instagram on the GM profile; Discord as one copy button;
game page and GM page re-laid out; search box on `/systems/` and `/gms/`; default share image; Anti-Slop audit of 2026-11-02 in
[anti-slop-audit.md](anti-slop-audit.md).

**Open, none blocks use:** the Indonesian wording of everything new is mine (the owner is a native speaker and should review: browse blocks, pager, search
strings, "Cari Game Master", "Pilihan untuk"); some editions were written without a primary source (Nimble was checked against Nimble Co. on 2026-11-03: its own names are
"Nimble 5e" for the first book and "Nimble v2" or "Nimble 2" for the second, so the list now says "Nimble v2" (renamed 2026-11-04); search still accepts "nimble 2e", "2.0" and "2";
rename it in `systems.ts`, the cover map, the demo data and the tests if the owner prefers the publisher's wording); Shadowrun 3e and L5R 4e pictures are small scans
(no larger copy in the sources tried; Knave 1e now has its real cover); no real Game Master has listed a game yet, so the retention
timers, the first approval and rebuild on live, and the first Instagram save are unproven on live data; (a visitor on a slow phone tapping "Filters" before the page's scripts have run is handled since 2026-11-03: the search, Filters and the pager are `pending`, read-only and ignore taps, and dim after 0.8 s); ask Game Masters to list their games (an invitation message was offered, not written).

Ways of working that matter: the owner says "push" when ready; apply a database migration to the live D1 **before** pushing code that needs it
(`npm run cloudflare:setup`; the owner added the permission rule for it on 2026-11-02); run the full Playwright suite on all three browsers before a push
(workers are 2 and the test timeout is 60 s because Firefox and WebKit are slow on this laptop); edit source with the editor's edit tool, not with replacement scripts (R-33).

## State in one paragraph (2026-10-30, older)

The site is a Next 16 static export on Cloudflare Pages (EN/ID) at <https://quest-board-tpk.pages.dev>. The Cloudflare backend (D1 + R2, email-link
accounts, ADR-25, [backend.md](backend.md)) went live on 2026-10-30 and the Google Forms + Sheet stack was retired in code (ADR-27); the Apps Script
is only the mail relay. **Everything up to `edb7fb4` is pushed and live, CI green including the full Playwright suite** (the first e2e run on the minimal-tavern
design, the header toggle, the systems pages and the removal of featured games). The live site has 0 games and 0 GMs, so the home "Browse by system" block
is hidden there until a game is listed; `/systems/` shows all 143 systems with 0 games.

## Update 2026-11-01 (newer than the paragraph above)

Pushed and CI green up to `31c0a34`; later commits are local until the owner says "push". Since the paragraph above: browse blocks and pages for systems,
genres, play styles and mechanics (ADR-30..33; migration `0003_mechanics.sql` is applied to the live D1); `/systems/` splits the systems without games
into compact cards; Nimble 5e and Nimble v2 added (named after Nimble Co.); the **demo data is 18 games** (`data/sample.json`,
placeholder covers in `public/images/covers/`; the e2e counts depend on it) and the games list shows **nine a page** with a numbered pager
(`PAGE_SIZE`, `pageList` in `src/lib/games.ts`; the page is `?page=N`, moving to a page is a history step; the built HTML holds page 1 only, the other
games are reachable through the sitemap and their own pages). The product is called **Quest Board** on the site, in emails and in the share text;
"The Pandemonium Kollektive (TPK)" stays as the community's name. The Apps Script sender name in `apps-script/Code.gs` changed too and only goes live with
`npm run script:deploy`.

Also 2026-11-02 (ADR-37): the audit batch, with MOTION raised to 2, a phone filter sheet, a sliding header, a system picker in the GM form, view-transition cover morphs, small tile pictures (`npm run tiles`), and the paired styles and mechanics block. Earlier the same day (local, not pushed until the owner says so): ADR-36, the refinements drawn from style.ai.id (search on /systems/, sideways rows on phones, sticky header, counts on the buttons, a Game Master line in the hero, a note for missing systems, rank numerals, Plus Jakarta Sans), and system pictures for all 143 systems (ADR-34, [art-credits.md](art-credits.md)).

## What was done on 2026-10-30 evening (all pushed)

Design: Halftone, the oak-board tavern and the tavern at night were each dropped; the direction is the **minimal tavern** (ADR-30, [design.md](../design.md))
with EB Garamond headings. Also: header light/dark toggle and EN/ID in capitals; featured games removed (ADR-31); Phosphor inline icons and no footer credit
(ADR-32, [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)); the "Browse by system" home block and the `/systems/` page; a 143-entry systems list with every edition
its own entry; system tiles kept to one line. Nothing needs a database migration; the unused `featured` column stays in D1.

Still for the owner to check: the editions in `src/lib/systems.ts` were written from memory (Cairn 2e, the Traveller names, the Hunter and Changeling splits).
The audit script (`scripts/audit-frontend.mjs`, with `npm run preview` running) was clean after every step except the skip link.

## Done before the first push of 2026-10-30 (kept for the record)

1. **Done on 2026-10-30:** migration `0002_retention.sql` is applied to the live D1 (`npm run cloudflare:setup`; verified: the `accounts` table has
   `last_seen_at` and `expiry_warned_at`). The new sign-in code writes `last_seen_at`, so this had to come first; it only adds columns, so the code
   that is live keeps working with it. For a later migration, do the same: apply it, then push.
2. **Done on 2026-10-30:** `npm run script:deploy` put the reduced relay live as Apps Script version 11 (ping answers, an old Sheet action is
   refused, a wrong secret is refused, a real mail was sent), and the setup removed the retired Pages variables. Still to check by eye: the
   Apps Script **Triggers** page should be empty within a minute of the deploy (the stubs that did this were removed on 2026-11-02).
3. The Playwright suite has **not** been run since the audit fixes and the retirement (the owner's rule is not to run it unasked); CI runs it on the push.
   Watch CI after pushing (public Actions API, times in UTC).

## What was done on 2026-10-30

- **Browse by system** (2026-10-30): a home block of up to 10 tiles, one per game system that has listings (most listed first); each links to `/games/?system=<name>` and uses a cover from one of its own listings, so no publisher art or invented descriptions. `SystemTile` in `src/components/ui.tsx`, the ranking in `systemTiles` (`src/lib/games.ts`: most listed first, ties A to Z). A "Browse all game systems" link under the block opens `/{lang}/systems/`, a page with every system (in the sitemap).
- **Mechanics, Browse by style and by mechanic** (2026-10-31, ADR-33): a new `mechanics` field on a game (ten keys in `src/lib/categories.ts`, twelve more added 2026-11-04 from startplaying.games/play/mechanics, a form group, server validation, tags, a `?mechanic=` filter and a `?style=` filter), migration `worker/migrations/0003_mechanics.sql` (**apply it to the live D1 before pushing**: `npm run cloudflare:setup`), four tile blocks on the home page through `BrowseSection`, pages `/styles/` and `/mechanics/`.
- **Browse by genre** (2026-10-31): built like Browse by system, with the shared `BrowseTile`, `genreTiles`/`allGenreTiles` (`src/lib/games.ts`), a button and a `/{lang}/genres/` page listing all 40 genres (those without games at 0). The menu-leader touch was removed with the old genre list, so the tavern touches are now an oak strip, a double rule, a nail per card and the Garamond.
- **Header controls** (2026-10-30): a light/dark toggle in the masthead (`src/components/theme-toggle.tsx`, shared state in `theme-state.ts`, also read by the footer switch) and the language labels set in capitals with CSS (`uppercase`; the text in the page stays `en` and `id`). Checked in Edge at 320 to 1280 px in both languages; the Playwright suite was not run.
- **Minimal tavern** (ADR-30, [design.md](../design.md)): after Halftone, an oak-board tavern and a tavern at night were each tried and disliked, the owner asked for "more minimalist but still a tavern touch". Warm paper, ink, one oxblood accent, EB Garamond heads over Chivo (the owner chose it from a seven-face specimen; Fell was dropped); the tavern is an oak strip, a double rule, a nail per card, menu leaders and the book face. Measured with the audit script; the Playwright suite and the Hallmark linter were not run on it.

- **Cutover** (log in [cutover.md](cutover.md)): `wrangler login`, R2 enabled by the owner (no API for that), `npm run cloudflare:setup` (D1, R2,
  schema, deploy hook, bindings and variables by Pages API, never a committed `wrangler.toml`), mail relay deployed, Turnstile widget made,
  timers Worker `quest-board-cron` deployed (`npm run cron:deploy`; a scheduled firing was seen), first backup written and read back.
- **Anti-Slop audit** ([anti-slop-audit.md](anti-slop-audit.md)): em dashes out of emails, 44 px targets, priority images, dead code, the duplicate GitHub timer.
- **Retirement of the Google stack** (ADR-27): `Code.gs` 1,216 lines to about 100 (mail relay; the self-cleaning trigger stubs that were here are gone since 2026-11-02), `CreateForms.gs`,
  the form-options generator, `docs/forms.md`, `form-options.md`, `setup.md`, the fake Sheet and its tests, the `TPK_API_URL` and Drive-picture paths.
  The last commit that has the Sheet stack is tagged `legacy-google-sheet` (local tag; push it with `git push origin legacy-google-sheet` if wanted).
- **Monitoring and retention** (ADR-27, [backend.md](backend.md)): `/api/health` shows last mail success and error and the last backup; a failed backup
  emails the owner; the tick emails the owner once a day if no backup for 36 hours; accounts unused for 24 months are warned and erased 30 days later.

## Still open

- **Never confirmed by anyone:** that the sign-in mail arrives in the inbox, and one full sign-in by clicking the link (the agent cannot read the
  mailbox). Do this first: sign in at `/en/account/`, then open `/en/admin/`.
- **Turnstile is enabled but not confirmed in a real browser.** In automated Edge the widget stayed on "Verifying…" and the button, which waits for
  the token, stayed disabled; probably bot detection, unproven. Open `/en/account/` in a normal browser: the button must turn solid. If it never
  does, sign-in is blocked for everyone: remove `TURNSTILE_SECRET` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` from the Pages project (and both keys from
  `.cloudflare.local.json`), rebuild.
- **Billing** is unverified: the agent's token has no billing scope. The owner should check Cloudflare → Billing shows $0 and may add a usage notification.
- **Old triggers in the Apps Script**: done 2026-11-02. The owner confirmed the Triggers page was empty and the four stubs were deleted from `Code.gs` (deployed as the next relay version).
- **The old Google Forms and Sheet** still exist in the owner's Google account; nothing reads them. Delete when ready (the agent has no access).
- `wrangler` is not a dependency: the scripts run it with `npx wrangler@4.156.2` (pinned; bump it on purpose), and its login lives in the user profile, not the repo.
- The agent was refused by the permission classifier for reading the stored Git credential and for creating the Worker before explicit approval:
  do not retry such steps, ask the owner.

## Never run against real services (status)

| Part | Status |
|---|---|
| D1 (schema, health, public data) | exercised live; the write paths (sign-up, profile, review) have not been used by a real person yet |
| R2 (images, backups) | a backup was written and read back; no picture uploaded yet |
| Mail relay | answered `{"ok":true}` to a test and a live sign-in request; delivery to an inbox unconfirmed |
| Retention and the backup watch | tested on SQLite only; they run for real on the first daily job after the next deploy |
| Turnstile | enabled; widget renders and the server enforces the token; completion in a real browser unconfirmed |
| Indonesian pages | written by the agent, not looked at by eye on every page |

## Map of the backend

- `worker/migrations/*.sql`: schema (0001 init, 0002 retention). `worker/src/handler.ts`: the one router (`handle(req, env)`) with everything injected
  (db, bucket, mailer, clock, fetcher), which is why it is testable without mocks.
- `worker/src/{auth,store,admin,public,deploy,images,backup,retention,watch,rules,email,util,db}.ts`: one concern each; see backend.md.
- Site side: `src/app/[lang]/account/`, `src/components/account/*`, `src/lib/account-api.ts`, admin in `src/lib/admin-api.ts` + `admin-app.tsx` + `review-pane.tsx`.
- Build: `scripts/build-data.mjs` reads `TPK_API_BASE` + `TPK_BUILD_KEY`, or `TPK_DATA_FILE`, or the demo data when none is set.
- Timers: `cron/worker.ts` (a Worker with cron triggers) calls `POST /api/cron?job=tick|daily` with the build key.
- Test harness: `tests/support/worker-env.ts` (unit world: applies every migration), `tests/support/test-server.ts` (real backend for Playwright, one
  world per test via the `tpk_world` cookie, `/__test/*` helpers for seeding, clock, mail and SQL).

## Gotchas that cost time (don't relearn them)

- **Git Bash eats backslashes.** Write edit scripts with the Write tool (`.cjs`), use Edit for lines with backslashes, and quote heredocs (`<<'EOF'`).
- **A `| tail` hides the exit code** of the command before it: use `${PIPESTATUS[0]}` or run without the pipe when a `&&` chain depends on it.
- **`npm run build` typechecks the tests** more strictly than `npm run typecheck` appears to: run the build before committing.
- **Hash-only navigation** (`#anchor` links) tripped an e2e test once; prefer asserting on real URLs and visible content.
- **`getByLabel` strict mode**: labels that prefix-match two fields break it; use exact names or roles.
- **Mailbox pollution in e2e**: the test server's mailbox is per world; read the *latest* mail, not the first.
- **Cover/photo limits are enforced from the bytes** (sniffed). **The public image route serves only approved images**; admins and the build key see all. Don't loosen either.
- **Build coalescing**: a "dirty" flag, at most one deploy per 2 h for an ordinary change and per 10 min (12 a day) when a listing has just gone live (ADR-48); the tick timer sends the waiting one. Tests move the clock instead of sleeping.
- **A secret variable in Pages cannot be read back** through the API: values the setup needs again are kept in `.cloudflare.local.json`.
- **Turnstile never finishes in automated browsers**, and `networkidle` never settles on a page with it: wait for `load`.
- **Apps Script is not Node**: no `fetch`/`URL` in pure helpers (names ending `_`).
- **Stale servers and ports** break e2e on Windows: kill leftover `node` processes (PowerShell) before re-running. The bundled Playwright Chromium may be missing: `npx playwright install`, or use Edge (`AUDIT_BROWSER=msedge`).
- **Check CI after a push**: GitHub CI was once silently red for rounds. Poll the public Actions API; times are UTC.

## Performance, measured again (2026-11-06, Lighthouse 12, Edge, mobile profile: slow 4G and 4x CPU)

Live site (no games listed yet, so the shell only): home 69, games list 70, quiz 88, account 69 (SEO 63 there is the page's deliberate noindex). Accessibility 100 and best practices 96 to 100 everywhere; SEO 100 on the public pages.
FCP 1.1 to 1.7 s, LCP 2.2 to 3.6 s, CLS 0 (the account page's 0.30 was the footer jumping when Cloudflare's robot-check widget appeared; its space is now reserved), TBT 340 to 1080 ms.
Demo build served with Brotli (the games they show): home 70, games list 65, a game page 77, a system landing page 73, quiz 83; LCP 3.4 to 4.3 s, an image on the pages that have covers.
**What the time is:** about 360 KB transferred per page (JS 180 to 200 KB, fonts 85 KB, CSS 13 KB, HTML 25 KB). Two chunks, React/Next's runtime (71 KB and 46 KB compressed), take about 800 ms each of scripting under the 4x CPU slowdown; the site's own code is
under 100 ms on the games list. Nothing cheap is left in the JavaScript: the dictionary chunk (both languages, 40 KB) loads only on the admin page, and unused JavaScript is 26 KB. The account page transfers 2 MB on the live site, 1.5 MB of it Cloudflare's Turnstile challenge on the sign-in form (not ours).
Real covers use the 480 x 600 `-sm` copy in cards and the 240 x 300 `-xs` copy in phone rows. Method: `node lh.mjs`-style loop over `npx lighthouse@12 <url> --output=json` with `CHROME_PATH` set to Edge; a Brotli wrapper around `scripts/preview.mjs` (the plain preview does not compress, which Lighthouse counts as 3 s).

## Open items (none blocks use)

1. Done 2026-10-30: the home page's "How it works" block is gone (R-05; the page `/how-it-works/` stays) and [design.md](../design.md) is written. The four Hallmark waivers stay stamped in `src/app/globals.css`; `design.md` records why. Whether the external Hallmark linter accepts `design.md` in place of the stamps has not been run.
2. Visual leftovers: the home rail has no scroll cue beyond the next card peeking in (a fade mask would clip the focus ring), and the home hero fold was not reviewed.
3. `public/images/tavern` and `public/textures` were unused and are deleted (still in git history before 2026-10-30). The Figma review file is outdated.
4. Product decisions still open: a second Cloudflare account owner. (Featured games were removed on 2026-10-30, ADR-31; the unused `featured` column is still in the D1 `games` table.)
5. Mail is the weakest link (one Gmail, 90 a day, no retry). A sending service needs a domain of the community's own; `worker/src/email.ts` is one file.

## How the owner works (applies to every session)

Reply in English. Commit locally after typecheck, lint and unit tests; run e2e, push, CI and deploys only when told. Never force-push.
Show text progress bars on long runs. UI changes follow the mandatory real-user rules in CLAUDE.md. Never print secrets
(`.cloudflare.local.json` and `.apps-script.local.json` are git-ignored on purpose).

**Flaky browser tests, found and fixed on 2026-11-02:** the games list and the systems search are drawn on the server, so a button tapped (or text typed) before the page's scripts run does nothing. The tests did exactly that on a slow machine, which was the cause of the "filters narrow the list" timeouts in Firefox and WebKit. Both components now set `data-ready` once their scripts have run, and the tests wait for it. A real visitor on a slow phone can still tap too early; the `data-late` rule already hides a list that an address filters, and a fuller fix (making the Filters button work without scripts) is not done.

**Instagram (ADR-38), done:** a Game Master can give an Instagram username; migration `0004_instagram.sql` was applied to the live D1 on 2026-11-02 before the push (the lesson: apply the migration first).

**Prepared 2026-11-03 for the owner:** [indonesian-review.md](indonesian-review.md) (the 63 Indonesian strings written since 2026-10-29, English beside Indonesian, a column for corrections) and [gm-invitation.md](gm-invitation.md) (a short and a longer invitation to Game Masters, English and Indonesian). Also fixed the same day: the "what the public sees" text and the profile consent now name Instagram next to Discord.

## Security audit (2026-11-03)

See [docs/security-audit.md](security-audit.md) and ADR-41. Open: nothing from the audit. Re-run it after big backend changes (the skill is in the Cloudflare security-audit-skill repo; the run folder is outside this repo).
