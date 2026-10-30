# Anti-Slop audit (2026-10-30)

An audit of this repo against two rule sets: **Anti-Slop** (`miqdadbadjuber/Anti-Slop`: 40 rules R-01 to R-40 in three tiers, plus a
Delivery Gate) and **b4r7x's anti-slop code skill** (`b4r7x/agent-skills`: seven categories of AI-shaped code). Both were read from
their public files on 2026-10-30; only summaries of the rule text were available to the agent, so a rule may have more detail than is
applied here. Run in "After" mode: findings first, then fixes.

Tools: `scripts/audit-frontend.mjs` (rendered pages: both languages, both colour schemes, 390 px and 1280 px, plus axe) and a cross-file scan
for unused exports, single-caller helpers, redundant `else`, dividers, restating comments and hedging words.

## Result in one line

The code and the copy were already close to clean. Real findings were few: dead code, em dashes in emails, tap targets under 44 px,
images lazy-loaded above the fold, and a second timer left behind. All were fixed. Two design calls and one large cleanup are left to the owner.

## Fixed

| Rule | Finding | Fix |
|---|---|---|
| R-02 (Hard) | Em dashes in the sign-in and decision emails (the sign-off and the language separator) and in the admin's reason text | Plain sign-off, `* * *` separator, `. ` between reason and note |
| R-03 / R-26 (Hard) | Brand link 35 to 40 px tall; admin buttons and inputs 40 px | `min-h-11` on the brand link; admin controls 2.75 rem. The `CLAUDE.md` rule was already 44 px |
| R-40 (Hard) | GM photos and the first game cards on `/gms` and a GM page were lazy-loaded while visible at first paint | `priority` on the first four GM cards, the profile photo and the first three cards |
| Code 5a/5d | Dead exports: `WhenLine`, `gamesOf`, `COMMUNITY_NAME`, `AdminRecord`, `isScamSignal` | Removed |
| Code 1e/4d | `scam-signals.ts` header described a `lib/moderation.ts` that does not exist (a Quest Board v1 leftover) | Rewritten to say what `checks.ts` does with it |
| Code 6a | Two `window as unknown as { turnstile }` casts | One `declare global` for `Window.turnstile` |
| System | `.github/workflows/cron.yml` was a second timer next to the Worker (and GitHub pauses scheduled workflows after 60 idle days) | Deleted; one timer |

## Measured clean (no finding)

R-02 in rendered text, R-03 horizontal overflow, R-15 generic CTAs, R-16 buzzwords, R-24 dead links, R-25 contrast (axe, WCAG 2.2 AA),
R-26 controls without names or labels, R-39 landmarks, `lang`, `title`, one `h1`, `alt` on images, pointer cursors, R-17/R-18/R-28
(no invented statistics, testimonials or FAQ), R-36 (no unbacked security or performance claims; "your email is never shown" is true
by construction, since the public data has no email field), R-34 (both themes pass axe). Code: no `as any`, no `@ts-ignore`, no TODO or
hedging comments, no decorative dividers, no `else` after `return`, no filler words in comments. The accepted exception is the skip link,
1 px wide until focused (the standard pattern).

## Left for the owner (design judgement, not rule violations)

1. **Home "How it works" block (R-05).** The home page repeats the numbered steps that already have their own page. It is the "three-step
   how it works" template the rule names. Suggest removing it from the home page and linking the page. Not changed: it is a layout decision.
2. **No direction file (R-37).** The direction lives in the stamp at the top of `src/app/globals.css`. A short `design.md` (audience,
   visual language, the three dials: energy, rhythm, motion) would make it explicit and would let the four lint waivers be retired.
3. **Not reviewed by eye:** R-14 identical cards (they are listings, so identical structure is by design), R-19 motion, R-20 identity,
   R-29 palette. The Halftone theme was chosen with Hallmark and passed its own gates; this audit did not re-judge it.
4. **Not run:** the Playwright suite after these edits (the owner's rule is not to run it unasked; CI runs it on a push). Unit tests,
   typecheck, lint and the build pass.

## System design: what a second look says

What holds up: one rules module shared by the site and the backend (`worker/src/rules.ts` imports from `src/lib`), so the form and the
server cannot drift; everything external injected into `handle()`, so the real code runs in unit and browser tests; one timer; one
mail path; tokens stored only as hashes; free tier throughout.

What to change, in order of value:

1. **Retire the Google stack code (largest win, do it once a real sign-in has worked).** About 2,200 of 6,600 source lines no longer run:
   `apps-script/Code.gs` (1,216 lines, of which only the mail relay is used), `tests/unit/apps-script.test.ts` (491), `tests/support/fake-sheet.ts`,
   `tests/support/admin-stubs.ts`, `docs/forms.md`, `docs/form-options.md`, `scripts/push-apps-script.mjs`'s Sheet parts, the
   `TPK_API_URL` path in `scripts/build-data.mjs`, and the `NEXT_PUBLIC_*_FORM_URL`, `GOOGLE_CLIENT_ID` and `ADMIN_API_URL` settings. The
   Apps Script would shrink to a mail relay of well under 100 lines. It is held back only because `TPK_API_URL` is the rollback path.
2. **Mail is the weakest link.** It rides on one Gmail account and its 90-a-day cap; a failed send is surfaced to the caller but not
   retried or alerted. If sign-ins grow, move the one-file mailer (`worker/src/email.ts`) to a sending service on a domain of the community's own.
3. **No alert when a timer or a backup fails.** The Worker throws and Cloudflare counts the error, but nobody is told. A cheap fix: the
   daily job emails the owner when it fails (the mailer exists).
4. **Retention.** There is self-service erasure but no automatic expiry of inactive accounts. Decide a rule (for example, 24 months) before it matters.

None of these blocks use. Items 1 and 3 are the ones worth doing next. (Losing `.cloudflare.local.json` is recoverable: the setup makes a
new build key and sets it on the project, and `npm run cron:deploy` sets it on the Worker.)
