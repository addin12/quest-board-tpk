// Settings that differ between this site and another copy of it. All are public values (they end up in the
// pages anyway), read when the site is built: set them in Cloudflare Pages → Settings → Environment variables.
// Leave one empty and the feature that needs it explains itself instead of breaking.

const env = (v: string | undefined) => (v ?? "").trim();

/** The site's address, no trailing slash: links in sitemaps, share previews and the approval emails. */
export const SITE_URL = (env(process.env.NEXT_PUBLIC_SITE_URL) || "https://quest-board-tpk.pages.dev").replace(/\/+$/, "");

/** Cloudflare Turnstile's public site key (the robot check on the sign-in form); empty means no check, as in development. */
export const TURNSTILE_SITE_KEY = env(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

/** Where a player can report a listing (a form or chat link); the link is hidden when empty. */
export const REPORT_URL = env(process.env.NEXT_PUBLIC_REPORT_URL);

/**
 * The WhatsApp number (digits with the country code, no plus) a Game Master sends their code to, to have their own number verified (docs/handoff.md); empty hides the
 * "Verify my number" button, so nothing promises a check nobody will do.
 */
export const VERIFY_WHATSAPP = env(process.env.NEXT_PUBLIC_VERIFY_WHATSAPP).replace(/\D/g, "");

/** The picture a shared link shows when the page has none of its own (public/og.png, 1200 x 630). */
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "Quest Board" };
