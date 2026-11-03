# Security audit of 2026-11-03

Made with the Cloudflare security-audit skill (deep profile). The full run (ledger, verified records with traces, validators) is kept outside the repository at `~/security-audit-skill/quest-board-tpk/run-1/`; this page is its report.

**Profile:** deep. **Scope:** worker/, functions/, cron/, apps-script/, src/, scripts/, tests/support/, public/_headers, .github/, package.json. **Source ref:** commit fdfd8d7 (worktree clean). **Budget:** none set; 61 agent invocations (4 reconnaissance, 11 hunters in three waves, 4 coverage critics, 22 candidate verifiers, 20 final-record verifiers). **Execution policy:** sandboxed-source-and-local-only. **No OS sandbox can be enforced on this Windows host, so no target code was executed: every check is a source check.** **Prior runs:** none. No same-source confirmed records were carried.

**This run is complete** (`run_status: complete`): the last two coverage critics (a post-wave one and a separate final-clean one) accepted no further work; every `needs_validation` record was verified twice by fresh agents that did not hunt it (Phase 3, then Phase 5 against the audited commit); the one candidate from the last wave was rejected. It is still bounded by what source reading can show: nothing was executed, so nothing is `confirmed`.

## Security posture

The design is sound where it matters: tokens and sessions are stored hashed, sign-in links work once, SQL is parameterised everywhere, every GM write is tied to the session's own profile, image types are read from bytes, public data excludes emails, and the build key and relay secret fail closed. The findings are lifecycle, role and abuse-limit gaps around admin merges, erase/retention, the rate limiter, and mail quota. **Because nothing could be executed, none is marked `confirmed`; all 20 are `needs_validation`** (and 1 was rejected: build-data-demo-fallback-on-production) with a source-proven trace and the exact in-memory test that settles each (the regression tests written during the fixes are those tests).

## Confirmed findings

None (execution was not permitted; see above).

## Needs validation (20)

No severity is assigned. Each blocker is "target execution not permitted in this run" plus the deployment fact noted in NEEDS-VALIDATION.md.

| Title | Fingerprint | Fix status |
|---|---|---|
| Live Apps Script script id and deployment id (the mail relay URL) are committed in a unit-test fixture of a repository the docs call public | `apps-script.relay-ids-committed-in-test-fixture` | Fixed |
| E2E test server binds all interfaces and exposes unauthenticated arbitrary-SQL endpoints (/__test/sql, /__test/exec) that may create files on the developer machine | `tests.test-server.unauthenticated-sql-on-all-interfaces` | Fixed |
| Merging profiles lets an ordinary admin keep owner-level access after removal, or lock the owner out | `worker.admin.merge-ignores-owner-and-admin-roles` | Fixed |
| Profile merge redirects one email's sign-in into another account without proof of control, so a GM-typed WhatsApp number can lead to takeover of another GM's (or an admin's) account | `worker.admin.merge-redirects-signin-without-proof` | Mitigated |
| Admin queue response and memory grow quadratically with the number of profiles that share one WhatsApp number | `worker.admin.queue-shared-phone-quadratic-fanout` | Fixed |
| Any admin can remove any other non-owner admin although the code comment and runbook say only the owner can | `worker.admin.remove-admin-not-owner-only` | Fixed |
| Admin approval is a status flip by id, so it applies to whatever the Game Master saved after the admin's view loaded | `worker.admin.review-approval-not-bound-to-reviewed-version` | Fixed |
| Anonymous sign-in requests can spend the 90 mails/day relay budget that sign-in, decision mails, expiry warnings and owner alerts all share | `worker.auth.login-mail-shared-quota-exhaustion` | Mitigated |
| Sign-in request limits count against the target address, so an anonymous caller can use up a chosen address's 5-per-hour link budget (also when their own IP window is full and nothing is sent) | `worker.auth.login-rate-limit-email-slot-burn` | Fixed |
| Emailed sign-in token is not bound to the browser that requested it (login CSRF / session replacement through a pre-made link) | `worker.auth.magic-link-not-bound-to-requesting-browser` | Fixed |
| Sign-in follows merged_into one hop only, so after a chained merge the first mailbox lands on a dead, merged-away account | `worker.auth.merge-chain-single-hop-login` | Fixed |
| Uploaded pictures that no row references survive account erasure and are never reclaimed | `worker.images.unreferenced-uploads-outlive-erase-and-accumulate` | Fixed |
| Anonymous GET /api/img/<any key> runs an unindexed scan of profiles and approved games each time | `worker.img.anonymous-lookup-full-table-scan` | Fixed (migration) |
| list() de-duplicates the whole submitted array/CSV with indexOf (O(n^2)) before applying its max, and runs before the submit rate limit | `worker.rules.list-quadratic-dedupe-before-cap` | Fixed |
| Account erase (self-service and two-year expiry) fails half-way for any account that an admin merged a duplicate into | `worker.store.erase-blocked-by-merged-into-fk` | Fixed |
| Erase and expiry leave the person's email and name in the never-pruned activity log (and its daily backups) and leave replaced pictures in R2 | `worker.store.erase-leaves-activity-pii-and-superseded-pictures` | Fixed (live data) |
| GET /me returns the private admin note and the reviewing admin's email to the Game Master | `worker.store.me-exposes-admin-note-and-reviewer` | Fixed |
| POST /games/<id>/full has no rate limit, so one Game Master can force a site rebuild every 30 s and grow the activity table without bound | `worker.store.setfull-unthrottled-build-and-log-amplification` | Fixed |
| No per-account game cap and no admin delete: one account can grow games/activity until buildPublic, the admin queue and the daily backup (whole-table reads) exhaust Worker memory or time | `worker.store.unbounded-game-rows-feed-whole-table-reads` | Partly fixed |
| The D1 sliding-window limiter checks and inserts in separate statements, so concurrent requests can all pass | `worker.util.allow-nonatomic-check-then-insert` | Fixed |

## Implementation status (added after the audit; it changes no verdict)

- **apps-script.relay-ids-committed-in-test-fixture** (Fixed): The fixture uses made-up ids and a test fails if a tracked file holds an Apps Script id. Because the old ids stay in git history, on 2026-11-03 the web app was moved to a NEW deployment with a NEW mail secret, Pages was switched to it (MAIL_RELAY_URL and MAIL_SECRET) and rebuilt, and the old deployment was retired (its address now answers 404). Checked without sending mail: the new address answers bad_request to a bad recipient with the new secret and unauthorized with the old one.
- **tests.test-server.unauthenticated-sql-on-all-interfaces** (Fixed): tests/support/test-server.ts listens on 127.0.0.1 only.
- **worker.admin.merge-ignores-owner-and-admin-roles** (Fixed): mergeProfiles refuses when either account is the owner or an admin (error admin_account).
- **worker.admin.merge-redirects-signin-without-proof** (Mitigated): Admin accounts are excluded, the chain is followed correctly, and the account that absorbed an address now gets an email naming it. Residual: the admin's judgement is still the control. Owner decision: require the target account to confirm by link.
- **worker.admin.queue-shared-phone-quadratic-fanout** (Fixed): Each profile lists at most 5 others that share its number.
- **worker.admin.remove-admin-not-owner-only** (Fixed): Only the owner can remove an admin (the runbook already said so); the address is normalized like on add; the Remove button shows for the owner only.
- **worker.admin.review-approval-not-bound-to-reviewed-version** (Fixed): The admin page sends the updatedAt it saw; a record changed since is refused (stale) and the list refreshes.
- **worker.auth.login-mail-shared-quota-exhaustion** (Mitigated): Sign-in mails are capped at 60 a day across everyone, keeping 30 of the relay's 90 for decisions, warnings and alerts. Residual: a flood can still block sign-ins for a day; keep Turnstile on (check /api/health and the Pages variables).
- **worker.auth.login-rate-limit-email-slot-burn** (Fixed): The caller's IP is checked before the address, so a refused request no longer spends the named address's slots. Residual: five direct requests an hour for one address still fill its slots (inherent to a per-address cap).
- **worker.auth.magic-link-not-bound-to-requesting-browser** (Fixed): The link no longer signs a browser in by itself: the account page asks the backend whose link it is (POST /login/peek, which does not use the link up), shows 'Sign in as <address>?' and waits for a click. It still works on another device.
- **worker.auth.merge-chain-single-hop-login** (Fixed): Sign-in follows merged_into to the end of the chain, and a merge repoints accounts merged earlier.
- **worker.images.unreferenced-uploads-outlive-erase-and-accumulate** (Fixed): A replaced picture is deleted when the new one is saved; the daily job deletes unreferenced files older than 2 days.
- **worker.img.anonymous-lookup-full-table-scan** (Fixed (migration)): Migration 0005 indexes profiles.photo_key and games.cover_key. It must be applied to the live D1 (npm run cloudflare:setup).
- **worker.rules.list-quadratic-dedupe-before-cap** (Fixed): Lists look at at most 4x the cap and de-duplicate with a Set.
- **worker.scripts.build-data-demo-fallback-on-production** (Rejected (guard added anyway)): No lower-trust principal can trigger it (it takes access to the Pages project); the build now refuses demo data on Cloudflare.
- **worker.store.erase-blocked-by-merged-into-fk** (Fixed): Erasing an account also erases the addresses merged into it, first.
- **worker.store.erase-leaves-activity-pii-and-superseded-pictures** (Fixed (live data)): Erase blanks names, titles, notes and addresses in the activity log and deletes replaced pictures. Daily backups already written keep their copy until they expire (14 days).
- **worker.store.me-exposes-admin-note-and-reviewer** (Fixed): GET /me blanks adminNote and reviewedBy; admins still see them in the queue.
- **worker.store.setfull-unthrottled-build-and-log-amplification** (Fixed): Marking a game full shares the 30-an-hour write limit.
- **worker.store.unbounded-game-rows-feed-whole-table-reads** (Partly fixed): A profile may have 30 open games. Whole-table reads (public build, admin queue, backup) remain; fine at this scale, revisit past a few thousand games.
- **worker.util.allow-nonatomic-check-then-insert** (Fixed): The limiter counts and inserts in one statement.

Regression tests: tests/unit/security-audit.test.ts (14 tests; the full unit suite is 78 passing). Playwright: 213 tests on Chromium, Firefox and WebKit; two were updated for the new behaviour (owner-only admin removal, sign-in confirmation) and re-run green.

## Hardening notes and positive source patterns

Done alongside: CI token limited to `contents: read`; preview server no longer crashes on a broken % escape and its root check has a separator; /img/ with a broken escape is a 404; OWNER_EMAIL is normalized like session emails; SECURITY.md no longer claims uploads are behind Turnstile; the build refuses demo data on Cloudflare. Done after the first round (ADR-42): the build key moves to an Authorization header (the URL form is removed in the next release), Turnstile fails closed on https, GitHub Actions are pinned by SHA and wrangler by version. Accepted, with reasons in ADR-42: the CSP keeps inline scripts (a Next static export cannot use hashes or nonces). The hunters' full hardening lists are in coverage-ledger.json (`hardening` on each unit).

## Coverage summary

- covered: 5
- candidate: 14
- Units: 14 from reconnaissance, 4 added by the first critic, 1 added by the second critic (hunted; its candidate was rejected). Excluded blocks and their reasons are listed per unit in coverage-ledger.json. Validators: coverage ledger and findings both pass (Windows copies of the validators were used: Node on Windows has no O_NOFOLLOW/O_NONBLOCK, so they check for symlinks with lstat instead).
- Methodology deviations: hunters and verifiers read their selected blocks from an assignment file instead of receiving them pasted in the prompt; hunters wrote their result JSON to their own scratch folder; no artifact promotion was needed (no local checks); one verifier result (13) was malformed JSON and was re-run with a fresh verifier, per the skill; Phase 5 verifiers read the audited commit with read-only git because the working tree had been fixed by then; two records got wording-only corrections in Phase 5.
