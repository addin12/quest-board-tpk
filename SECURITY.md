# Security policy

Quest Board TPK is run by volunteers for a community, so help is best effort, but a vulnerability report is welcome and
will be read.

## Reporting a vulnerability

Please report it **privately**: on GitHub open the repository's **Security** tab → **Report a vulnerability**
(https://github.com/addin12/quest-board-tpk/security/advisories/new). Please do not open a public issue or post it
anywhere else until it is fixed. Say what you found, how to reproduce it, and what it lets someone do. We aim to
acknowledge a report within about a week.

**In scope:** the website, the admin page, the backend in `worker/` and `functions/`, the mail relay in `apps-script/`, and the way they are configured
(for example a secret that ends up in a page or in the repository).

**Out of scope:** problems in Google, Cloudflare or GitHub themselves (report those to them), and a listing that looks
like a scam: use the *Report this listing* link on the game's page instead.

## What data this project holds

- A Game Master's profile: display name, short bio, city, optional photo, WhatsApp number, optional Discord, and the
  email address, which is also their sign-in (the email is never shown on the site).
- A game's details: the description, place, date, price information and an optional cover picture.
- Where it lives: a Cloudflare D1 database and an R2 bucket (pictures and daily backups) in the owner's Cloudflare account. The public site shows only what a
  Game Master agreed to show when they ticked the consent box. There are no player accounts and no payments. The only cookie is the signed-in Game Master's session. A Game Master can erase their account and pictures themselves, and an account unused for 24 months is erased after a warning email. If the owner turns on Cloudflare's visit counter it counts page views only, with no personal data.

## How it is protected

- The site is static files; the only server code is the backend in `worker/`. Sign-in is an emailed one-time link (15 minutes, used once), and
  only hashes of links and sessions are stored. Every write checks the site's own `Origin`; sign-ins and uploads are rate-limited and
  protected by Cloudflare Turnstile. The admin API accepts a signed-in session whose email is on the Admins list. Pictures are
  identified by their bytes, and only approved ones are public. The public data is given only to a request carrying the secret build key.
- The site sends a strict Content-Security-Policy and the usual security headers (see `public/_headers`).
- Secrets live only in the Pages project's encrypted variables and the Workers' secrets, never in the repository. CI audits the
  dependencies on every push and Dependabot watches them weekly.
- Procedures for a leaked key, a restore from backup or a listing that must come down are in [docs/runbook.md](docs/runbook.md).

## Please never commit

Secrets (deploy hooks, build keys, tokens), or real people's data. The sample data in `data/` is made up.
