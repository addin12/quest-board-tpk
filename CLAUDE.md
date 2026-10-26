# Quest Board TPK: agent guide

A free, static noticeboard for tabletop RPG games, run by **The Pandemonium Kollektive** (TPK), Indonesia. Game Masters
submit games through Google Forms; admins review them on a page of this site; players browse and contact the GM directly
(WhatsApp, optionally Discord). **No bookings, no payments, no accounts, no server, no database.** English by default,
Bahasa Indonesia at `/id/`.

This is the successor of Quest Board v1 (accounts, booking, payment tracking: repo `addin12/Quest-Board`, tag
`v1.0-booking`). Don't bring v1's server features back.

## Read before you work on…
| Task | Read |
|---|---|
| How the parts fit | [docs/architecture.md](docs/architecture.md), then [DECISIONS.md](DECISIONS.md) for why |
| The Sheet's script | `apps-script/Code.gs` (and its tests: `tests/unit/apps-script.test.ts`) |
| The forms, their exact question titles | [docs/forms.md](docs/forms.md); options are generated: `npm run form-options` |
| Setting it up, hosting, limits | [docs/setup.md](docs/setup.md) |
| What admins do | [docs/curation.md](docs/curation.md) |
| Next.js APIs | `node_modules/next/dist/docs/` (this Next.js version has breaking changes; check before using an API from memory) |

## Commands
```bash
npm run dev            # builds the data (demo data without TPK_API_URL), then next dev on :3000
npm run build          # data -> next build (static export to out/) -> fix-export
npm run preview        # serves out/ like Cloudflare Pages on :4173 ("/" -> "/en/", 404 page)
npm run typecheck && npm run lint && npm test
npm run test:e2e       # Playwright against a build with demo data and a fake admin backend (tests/support)
npm run form-options   # rewrite docs/form-options.md and the GENERATED labels in Code.gs after changing genres/styles/systems
npm run icons          # after editing src/lib/icons.ts
```

## Definition of done
1. `npm run typecheck && npm run lint && npm test` pass.
2. `npm run build` passes (it typechecks the tests and builds every page).
3. UI changes look right in **both languages** and **both themes**, on a phone (390 px) and a desktop.
4. Every new string is in **both** `src/lib/i18n/en.ts` and `id.ts`.
5. If the data contract changed, all three agree: `src/lib/types.ts`, `apps-script/Code.gs`, `src/lib/public-data.ts`.
6. Docs are updated when behaviour changes; a key decision gets an entry in DECISIONS.md.

## How the owner wants work done
- **Commit locally after each piece of work** (typecheck, lint, unit tests, build green). **Do not push, run the
  Playwright suite, or touch CI/deploys until the owner says so.** End commit messages with the Co-Authored-By line given by the session.
- Never force-push or rewrite pushed history. Never commit `.env*`, `src/generated/`, `public/media/`, `out/`.
- Ask the owner about Indonesian wording (native speaker); the glossary is the v1 one (GM, one-shot, safety tools stay English).
- UI rules for real users are mandatory: body text 17 px (nothing under 14 px), controls at least 44 px, labels above fields,
  one accent, words next to colours, visible focus, both themes. Keep the medieval-tavern palette and art.

## Hard rules
- **Public data is a fixed list of fields** (`buildPublic_` in Code.gs). Never add an email, an admin note, a status or a rejected/pending row to it.
- **Everything the site shows from the Sheet is untrusted text**: render it as text (React escapes), never as HTML; links only if validated
  (`isGoogleMapsUrl`, `cleanDiscord`, `isPhone`); re-validate at the build (`parsePublicData`), whatever the script promised.
- **The admin API trusts only the verified Google ID token** plus the Admins tab. No action without `handle_`'s checks; no admin power from anything the page sends.
- **Apps Script is not Node**: no `URL`, no `fetch`, no `import`. Keep Google calls out of the pure helpers (names ending `_`) so the tests can load them in a sandbox.
- **Don't write words in JSX**: use `t("key")` (the lint rule enforces it).
- **Keep the footer credit "Uicons by Flaticon"** (icon licence).
- **A build that can't get good data must fail**, not publish an empty site (`scripts/build-data.mjs`).

## Engineering rules (the owner's rule files, adapted to a static site)
- Smallest change that works; match the surrounding code; no TODO or placeholder logic in `src/` or `scripts/`; comments say why.
- All external input is untrusted: validate shape, type and range at the boundary (the form's validation is a convenience, not a guarantee).
- Server Components by default; `"use client"` only for interaction (filters, contact buttons, theme/language switches, the admin page). Never lazy-load anything a first tap depends on.
- Filters and sort live in the URL (`?q=…&where=online`) so a view can be shared.
- Structured data (JSON-LD) on every public content page (`src/lib/seo.ts`); canonical + hreflang on each; sitemap and robots.
- Performance: pictures are cropped and converted to WebP at build; cards use the small size; below-the-fold work stays out of the first paint. Measure before optimising.
- Security: Content Security Policy in `public/_headers` (review it when adding a script or host); `npm audit` in CI; no secrets in the repo (every `NEXT_PUBLIC_*` value is public by design).
- Tests: unit tests for pure logic and for `Code.gs`; Playwright for the player and admin journeys with Google and the Sheet replaced; a flaky test is a P1 bug; a bug fix gets a regression test.
- Documentation: README, setup and curation guides, architecture with Mermaid diagrams, DECISIONS.md; examples (`@example`) on helpers whose use isn't obvious.

Not applicable here (no database, accounts, mail server or container): connection pooling, indexes, sessions, rate limits, Docker, off-site backups.
(The Sheet is the data; Google keeps its version history.)
