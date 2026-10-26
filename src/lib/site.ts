// Settings that differ between this site and another copy of it. All are public values (they end up in the
// pages anyway), read when the site is built: set them in Cloudflare Pages → Settings → Environment variables.
// Leave one empty and the feature that needs it explains itself instead of breaking.

const env = (v: string | undefined) => (v ?? "").trim();

/** The site's address, no trailing slash: links in sitemaps, share previews and the approval emails. */
export const SITE_URL = (env(process.env.NEXT_PUBLIC_SITE_URL) || "https://quest-board-tpk.pages.dev").replace(/\/+$/, "");

/** The two Google Forms GMs fill in (docs/forms.md). */
export const GM_FORM_URL = env(process.env.NEXT_PUBLIC_GM_FORM_URL);
export const GAME_FORM_URL = env(process.env.NEXT_PUBLIC_GAME_FORM_URL);

/** Where a player can report a listing (a form or chat link); the link is hidden when empty. */
export const REPORT_URL = env(process.env.NEXT_PUBLIC_REPORT_URL);

/** The Apps Script web app's address (…/exec) and the Google OAuth client id the admin page signs in with. */
export const ADMIN_API_URL = env(process.env.NEXT_PUBLIC_ADMIN_API_URL);
export const GOOGLE_CLIENT_ID = env(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export const COMMUNITY_NAME = "The Pandemonium Kollektive";
