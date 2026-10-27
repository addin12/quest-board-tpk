# Contributing

Thank you for helping. This is a small community project; small, tested changes are the easiest to review.

## Run it

You need Node 22.13 or newer.

```bash
npm ci
npm run dev        # http://localhost:3000, with demo data: no Google account needed
```

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript, with no emit |
| `npm run lint` | ESLint |
| `npm test` | the unit tests (the real `Code.gs` runs in a sandbox over an in-memory Sheet) |
| `npm run test:e2e` | the browser tests in Chromium, Firefox and WebKit (they build the site first) |
| `npm run build` | the production build (add `TPK_DATA_FILE=data/empty.json` to build the empty-Sheet state) |
| `npm run form-options` | regenerates the option lists in `Code.gs`, `CreateForms.gs` and `docs/form-options.md` |

## Before you open a pull request

1. `typecheck`, `lint` and `test` pass, and `test:e2e` if you touched a page. CI runs all of them.
2. Behaviour that matters has a test: a bug fix gets a regression test, new logic gets a unit test.
3. Keep the change small and in the style around it. The project's conventions are in [CLAUDE.md](CLAUDE.md); the reasons
   behind big choices are in [DECISIONS.md](DECISIONS.md).
4. Texts: every string is in `src/lib/i18n/en.ts` **and** `id.ts` under the same key (a test checks). Keep the pages
   readable for real people: labels above fields, large tap targets, one accent colour.
5. Nothing secret and no real person's data in the repository, tests or screenshots.

## Changing the Google script

`apps-script/Code.gs` is pasted into the Sheet's script by hand; a merge does not deploy it. So:

- Keep Google calls out of the helpers whose names end in `_`: those are unit-tested in a sandbox without Google.
- If you add a Sheet column, add it to `ADMIN_COLUMNS` and to [docs/forms.md](docs/forms.md) (a test checks), and say in
  the pull request that the owner must paste the file, run `setup()` and deploy a new version.
- Changing a form question? `CreateForms.gs` and the docs must change with it (a test compares them with `Code.gs`).

## Reporting a problem

A bug or an idea: open an issue. A security problem: see [SECURITY.md](SECURITY.md) and report it privately.
