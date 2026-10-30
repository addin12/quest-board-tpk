# Contributing

Thank you for helping. This is a small community project; small, tested changes are the easiest to review.

## Run it

You need Node 22.13 or newer.

```bash
npm ci
npm run dev        # http://localhost:3000, with demo data: no accounts needed
```

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript, with no emit |
| `npm run lint` | ESLint |
| `npm test` | the unit tests (the real backend runs through its HTTP handler on an in-memory SQLite database and bucket; `Code.gs` runs in a sandbox) |
| `npm run test:e2e` | the browser tests in Chromium, Firefox and WebKit (they build the site first) |
| `npm run build` | the production build (add `TPK_DATA_FILE=data/empty.json` to build the empty day-one state) |

## Before you open a pull request

1. `typecheck`, `lint` and `test` pass, and `test:e2e` if you touched a page. CI runs all of them.
2. Behaviour that matters has a test: a bug fix gets a regression test, new logic gets a unit test.
3. Keep the change small and in the style around it. The project's conventions are in [CLAUDE.md](CLAUDE.md); the reasons
   behind big choices are in [DECISIONS.md](DECISIONS.md).
4. Texts: every string is in `src/lib/i18n/en.ts` **and** `id.ts` under the same key (a test checks). Keep the pages
   readable for real people: labels above fields, large tap targets, one accent colour.
5. Nothing secret and no real person's data in the repository, tests or screenshots.

## Changing the backend

The backend is `worker/` (one handler, `handle()`, with the database, bucket, mailer, clock and fetch injected) behind one Pages Function in
`functions/`. A push to `main` deploys it with the site; the database and bucket are bindings of the Pages project (see [docs/backend.md](docs/backend.md)).

- A schema change is a new file in `worker/migrations/`, applied by the owner (see [docs/cutover.md](docs/cutover.md)); say so in the pull request.
- Rules that both the form and the server need (areas, genres, phone and link checks) live in `src/lib/` and are imported by `worker/src/rules.ts`:
  change them once.
- Test through `handle()` (`tests/support/worker-env.ts` gives a world with a database, bucket, mailbox and clock); do not mock the handler's internals.
- `apps-script/Code.gs` is only the mail relay. `npm run script:deploy` pushes it (the owner does this). Keep Google calls out of the helpers whose
  names end in `_`: those are unit-tested in a sandbox without Google.

## Reporting a problem

A bug or an idea: open an issue. A security problem: see [SECURITY.md](SECURITY.md) and report it privately.
