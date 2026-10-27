# Security policy

Quest Board TPK is run by volunteers for a community, so help is best effort, but a vulnerability report is welcome and
will be read.

## Reporting a vulnerability

Please report it **privately**: on GitHub open the repository's **Security** tab → **Report a vulnerability**
(https://github.com/addin12/quest-board-tpk/security/advisories/new). Please do not open a public issue or post it
anywhere else until it is fixed. Say what you found, how to reproduce it, and what it lets someone do. We aim to
acknowledge a report within about a week.

**In scope:** the website, the admin page, the Google Apps Script in `apps-script/`, and the way they are configured
(for example a secret that ends up in a page or in the repository).

**Out of scope:** problems in Google, Cloudflare or GitHub themselves (report those to them), and a listing that looks
like a scam: use the *Report this listing* link on the game's page instead.

## What data this project holds

- A Game Master's profile: display name, short bio, city, optional photo, WhatsApp number, optional Discord, and the
  email of their Google account (the email is never shown on the site).
- A game's details: the description, place, date, price information and an optional cover picture.
- Where it lives: a Google Sheet and Google Drive of the community's admin account. The public site shows only what a
  Game Master agreed to show when they ticked the consent box. There are no player accounts and no payments, and no cookies. If the owner turns on Cloudflare's visit counter it counts page views only, with no personal data.

## How it is protected

- There is no server and no database of our own: the site is static files.
- The admin API accepts a request only with a Google sign-in token that Google confirms, from an email on the Admins
  list. The script's public data is only given to a request carrying a secret build key.
- The site sends a strict Content-Security-Policy and the usual security headers (see `public/_headers`).
- Secrets live only in Cloudflare's variables and the script's properties, never in the repository. CI audits the
  dependencies on every push and Dependabot watches them weekly.
- Procedures for a leaked key, a damaged Sheet or a listing that must come down are in [docs/runbook.md](docs/runbook.md).

## Please never commit

Secrets (deploy hooks, build keys, tokens), or real people's data. The sample data in `data/` is made up.
