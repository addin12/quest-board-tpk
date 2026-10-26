<div align="center">

# ⚔ Quest Board TPK

**Find your table. Message your Game Master.**

A free, static noticeboard for tabletop RPG games run by **The Pandemonium Kollektive** (TPK), in English and Bahasa Indonesia.
Game Masters list their games through Google Forms, admins review them on a page of the site, and players
message the GM directly on WhatsApp or Discord.

[![CI](https://github.com/addin12/quest-board-tpk/actions/workflows/ci.yml/badge.svg)](https://github.com/addin12/quest-board-tpk/actions/workflows/ci.yml)
![Node 22.13+](https://img.shields.io/badge/node-%E2%89%A522.13-3c873a)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black)
![License MIT](https://img.shields.io/badge/license-MIT-blue)

</div>

> This is the community edition: **no bookings, no payments, no accounts, no server.** The earlier version with
> accounts and seat booking is [Quest Board v1](https://github.com/addin12/Quest-Board) (tag `v1.0-booking`).

## How it works

```
GM fills a Google Form (signs in with Google)  →  Google Sheet  →  an admin approves it on /en/admin/
        →  the site rebuilds (1–3 minutes)  →  players browse, filter and tap “Message on WhatsApp”
```

- **For players:** browse and filter games (system, genre, online or in person, city, language, level, free), open a game,
  and tap the WhatsApp button: the chat opens with a message ready to send. Some GMs also share a Discord.
- **For Game Masters:** two short forms (a profile once, then one per game), an email when an admin decides, and an edit link.
- **For admins:** a review page with a queue, a preview of the card, automatic checks (scam wording, missing date or
  number…), one-click approve or reject with reasons, undo, bulk approve and keyboard shortcuts. Adding another admin is one email address.
- **Cost:** nothing. Google Forms/Sheets/Apps Script, Cloudflare Pages and GitHub, all on free plans.

More: [architecture](docs/architecture.md) · [setup](docs/setup.md) · [the forms](docs/forms.md) · [for admins](docs/curation.md) · [decisions](DECISIONS.md)

## Quick start (demo data, no Google needed)

You need **Node.js 22.13 or later**.

```bash
npm install
npm run dev          # http://localhost:3000/en/  (10 demo games, 4 demo GMs)
```

```bash
npm run build        # the static site, in out/
npm run preview      # http://localhost:4173, served like Cloudflare Pages
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Builds the data, then the development server |
| `npm run build` | The data → `next build` (static export to `out/`) → `fix-export` |
| `npm run preview` | Serves `out/` the way Cloudflare Pages does (`/` → `/en/`, a 404 page) |
| `npm run typecheck` · `npm run lint` | TypeScript (also checks that both languages have every string) · ESLint (also refuses words typed straight into JSX) |
| `npm test` | Unit tests (`node:test`), including the Sheet's script `Code.gs` run in a sandbox |
| `npm run test:e2e` | Builds with demo data and a fake admin backend, then Playwright (Chromium, Firefox, WebKit) |
| `npm run form-options` | Rewrites `docs/form-options.md` and the generated labels in `Code.gs` |
| `npm run icons` | Rebuilds the icon font after editing `src/lib/icons.ts` |

## Configuration

Everything is read when the site is built. Without any of them the site builds with demo data.

| Variable | Used for |
|---|---|
| `TPK_API_URL` | The Apps Script web app (`…/exec`): where the build gets the real data. Unset = demo data. |
| `NEXT_PUBLIC_SITE_URL` | The site's address (sitemap, canonical links, emails). |
| `NEXT_PUBLIC_GM_FORM_URL`, `NEXT_PUBLIC_GAME_FORM_URL` | The two forms' public links, for the "List your game" page. |
| `NEXT_PUBLIC_REPORT_URL` | Optional: where players can report a listing. |
| `NEXT_PUBLIC_ADMIN_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The admin page's API and Google sign-in. |

A full walk-through, with the Google and Cloudflare steps: [docs/setup.md](docs/setup.md).

## Project layout

```
apps-script/   the Sheet's script (the whole backend) · docs/   guides · scripts/   build and tooling
src/app/[lang]/   the pages (en, id) · src/components/   UI, admin/ is the review page · src/lib/   logic and strings
tests/   unit, e2e, and support (an in-memory sheet) · data/sample.json   demo data
```

## Contributing

Start with [CLAUDE.md](CLAUDE.md). A change is done when `npm run typecheck`, `npm run lint`, `npm test` and
`npm run build` pass, new interface text exists in English and Indonesian, and both themes and a phone width look right.

---

<sub>Icons: [Uicons by Flaticon](https://www.flaticon.com/uicons). Illustrations are original and drawn in code. Quest Board TPK is a community project and takes no payments: players and Game Masters arrange everything between themselves. Code under the [MIT License](LICENSE); the Flaticon icons keep their own license (attribution required).</sub>
