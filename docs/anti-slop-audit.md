# Anti-Slop audit (2026-10-30)

An audit of this repo against two rule sets: **Anti-Slop** (`miqdadbadjuber/Anti-Slop`: 40 rules R-01 to R-40 in three tiers, plus a
Delivery Gate) and **b4r7x's anti-slop code skill** (`b4r7x/agent-skills`: seven categories of AI-shaped code). Both were read from
their public files on 2026-10-30; only summaries of the rule text were available to the agent, so a rule may have more detail than is
applied here. Run in "After" mode: findings first, then fixes.

Tools: `scripts/audit-frontend.mjs` (rendered pages: both languages, both colour schemes, 390 px and 1280 px, plus axe) and a cross-file scan
for unused exports, single-caller helpers, redundant `else`, dividers, restating comments and hedging words.

## Result in one line

The code and the copy were already close to clean. Real findings were few: dead code, em dashes in emails, tap targets under 44 px,
images lazy-loaded above the fold, and a second timer left behind. All were fixed. Two design calls were left to the owner; the large cleanup and the three smaller system points were done afterwards (see the end).

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

## The tavern look (ADR-28, same day)

Checked against the rules while it was built; reasons per part are in [design.md](../design.md). Measured: R-03 (no overflow at 390 px after the sign was shrunk on phones), R-25 contrast (axe, both stocks, both languages: none), R-26 targets (only the skip link), R-40 (the rail's covers were lazy above the fold, now eager). R-07 (texture) and R-22 (illustration) are allowed with a written purpose: the planks are the board the notices hang on, and nothing was drawn beyond one chain link. R-29: two core colours plus one accent. R-23: no logo, mascot or avatar was created. Not run: the Playwright suite, the Hallmark linter, a review by the owner's eye in a real browser.

## The minimal-tavern direction (ADR-30, same day)

The owner tried three directions in a day and asked for a minimal one. Reasons per part are in [design.md](../design.md). Measured again with the audit script (both languages, both stocks, 390 and 1280 px, axe): no overflow, no contrast failure, only the skip link under 44 px. R-05/R-14: one rhythm break per section instead of a repeated template; cards are listings, so identical structure is by design. R-06: facts never use Fell (old-style figures). R-07/R-22: nothing is textured or drawn; the nail is one CSS dot. R-11: tags are rectangles, not pills. R-29: paper and ink, one accent. Not run: the Playwright suite, the Hallmark linter, a review in a real browser.

## Left for the owner (design judgement, not rule violations)

1. **Home "How it works" block (R-05).** The home page repeats the numbered steps that already have their own page. It is the "three-step
   how it works" template the rule names. Removed from the home page on 2026-10-30 (the page `/how-it-works/` stays and is in the nav).
2. **No direction file (R-37).** The direction lives in the stamp at the top of `src/app/globals.css`. [`design.md`](../design.md) now holds the audience,
   visual language, the three dials (energy, rhythm, motion) and the reasons for the four waivers. The waivers themselves are still stamped in the CSS.
3. **Not reviewed by eye:** R-14 identical cards (they are listings, so identical structure is by design), R-19 motion, R-20 identity,
   R-29 palette. The Halftone theme this audit saw was later dropped (ADR-29); the tavern-at-night direction is in [design.md](../design.md).
4. **Not run:** the Playwright suite after these edits (the owner's rule is not to run it unasked; CI runs it on a push). Unit tests,
   typecheck, lint and the build pass.

## System design: what a second look says

What holds up: one rules module shared by the site and the backend (`worker/src/rules.ts` imports from `src/lib`), so the form and the
server cannot drift; everything external injected into `handle()`, so the real code runs in unit and browser tests; one timer; one
mail path; tokens stored only as hashes; free tier throughout.

What was recommended, and what happened (same day, after the owner asked for it):

1. **Retire the Google stack code: done** (ADR-27). About 2,200 of 6,600 source lines went: `Code.gs` is a mail relay of about 100 lines,
   the Forms builder, the generator, the fake Sheet, their tests and two guides are deleted, the `TPK_API_URL` and Drive-picture paths are
   gone from the build. The last commit with the Sheet stack is tagged `legacy-google-sheet`.
2. **Mail is the weakest link: made visible, not fixed.** Every send now records its last success and last error (shown in `/api/health`).
   It still rides on one Gmail account with a 90-a-day cap and no retry (a retry could send a decision twice). The real fix is a sending
   service on a domain of the community's own, which does not exist yet; `worker/src/email.ts` is one file.
3. **Alerts: done.** A failed daily backup emails the owner and fails the timer; the 10-minute tick emails the owner, at most daily, when no
   backup has succeeded for 36 hours. If the mail relay is what broke, the email cannot be sent: `/api/health` is then the only place that shows it.
4. **Retention: done.** An account with no sign-in for 24 months is warned and erased 30 days later; admins and the owner never expire.
   The numbers are two constants in `worker/src/retention.ts`.

(Losing `.cloudflare.local.json` is recoverable: the setup makes a new build key and sets it on the project, and `npm run cron:deploy`
sets it on the Worker.)
