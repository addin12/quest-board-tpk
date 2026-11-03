# Unslop audit (2026-11-03)

The method is the [unslop](https://github.com/heydamir/unslop) skill by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0: find the signs of AI-looking UI, decide how much to change, set a direction, fix in passes. Credit and link kept as its licence asks. It complements the Anti-Slop audit of 2026-11-02 ([anti-slop-audit.md](anti-slop-audit.md)).

## Verdict: light slop (polish mode)

Checked by grepping the source and measuring the rendered pages (home, games, a game, systems, Game Masters, how it works, list your game; light and dark; 1440 px and 390 px). **Not found:** gradients or gradient text, glows, coloured shadows, emoji, exclamation marks, hype words, unverifiable claims, uppercase tracked labels, italics, negative tracking on small text, looping or bouncy motion, `transition-all`, hover-scale, shadows of any kind. The template check passes: "Find your table. Message your Game Master." fits no other product. The 3 to 4 px corners are the notice-board look, kept on purpose.

## Direction

- **Product:** a free board where players in Jabodetabek find tabletop RPG games and message the Game Master.
- **Character:** warm, plain-spoken, a little theatrical.
- **World:** a tavern notice board (paper, an oak strip, ink, wax-seal red).
- **Moments:** the cover art on cards and system tiles; the chrome stays quiet.
- **Signature:** the pinned dot on every card, used nowhere else.

## What was found and what was done

| Sign | Where | Result |
|---|---|---|
| Weight 700 on 215 text nodes | card and spec values, prices, buttons, nav, footer headings (`.btn`, `.label`, `.panel dd` and `.bill dd` at 700, `font-bold` in 50 places) | **Fixed.** 400 text, 500 for facts and buttons, 600 only for the filled primary button, the "full" tag and the app screens' headings. Plus Jakarta Sans is now a variable font: it was loaded in 400 and 700 only, so a 500 would have rendered as 400. |
| Digits not tabular | prices, dates, counts | **Fixed** with `font-variant-numeric: tabular-nums` on `body`. |
| "11 font sizes" | seven fluid tokens that grow with the screen (the 20/21 px and 27/31 px pairs are different roles) | **Not a problem; nothing merged.** |
| "Empty beige slot for a game with no cover" | screenshot of the demo build | **My mistake.** Those were lazy-loaded images a full-page screenshot had not waited for. A game with no cover shows a solid ink or oxblood poster with its title, a designed state, so no fallback to publisher art was added. |
| Home hero text only, right half empty | `src/app/[lang]/page.tsx` | **Changed** (the owner chose it): the soonest listing sits beside the headline as a real playbill, built from live data; it leaves the "Starting soon" and "New to tabletop RPGs?" lists so nothing shows twice. With no listing yet the hero stays full width. |

Borderline, left alone: the large ghost rank numerals on the system tiles (they carry information: the order of popularity).

## Checks

Typecheck, lint, 81 unit tests and the full Playwright suite (213 tests on Chromium, Firefox and WebKit) pass, with the public and accessibility specs re-run on Chromium after the last CSS change. Computed styles re-measured on the rebuilt pages: text at weight 700 went from 215 nodes to 0 (400: 467, 500: 414, 600: 12); the only digits without tabular figures are the ghost rank numerals in the display face.
