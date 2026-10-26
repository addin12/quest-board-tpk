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
