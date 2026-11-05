import Link from "next/link";
import { makeT } from "@/lib/i18n/dict";
import { Plus_Jakarta_Sans, Ultra } from "next/font/google";
import "./globals.css";

const ultra = Ultra({ variable: "--font-ultra", subsets: ["latin"], weight: "400" });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "700"] });

// The 404 for any address that isn't a page (the site is static, so this becomes 404.html). It ignores the [lang]
// layout, so it speaks both languages and links to both home pages.
export const metadata = { title: "404 · Quest Board" };

/**
 * A listing that went live after the last build has no page yet (the site is static). Its address lands here; if it looks like a game or Game Master address,
 * the visitor is sent to /view/, which loads that listing from the live data and puts the address back (components/listing-view.tsx). The page is hidden while
 * it decides, so nobody sees "404" flash by. Any other address stays a 404.
 */
const TO_VIEW = 'var m=/^\\/(en|id)\\/(games|gm)\\/([a-z0-9][a-z0-9-]{2,80})\\/?$/.exec(location.pathname);if(m){document.documentElement.style.visibility="hidden";location.replace("/"+m[1]+"/view/?"+(m[2]==="gm"?"m":"g")+"="+m[3])}';

export default function GlobalNotFound() {
  const en = makeT("en");
  const id = makeT("id");
  return (
    <html lang="en" className={`${ultra.variable} ${jakarta.variable}`}>
      <body className="items-start justify-center">
        <script dangerouslySetInnerHTML={{ __html: TO_VIEW }} />
        <main className="wrap flex flex-col items-start gap-[var(--space-lg)] py-[var(--space-3xl)]">
          <p className="poster" aria-hidden>{"404"}</p>
          <h1 className="max-w-none text-[length:var(--text-display-s)]">{en("notFound.title")}</h1>
          <p className="lead text-ink-2">{en("notFound.body")}</p>
          <p className="lead text-muted">{id("notFound.body")}</p>
          <p className="mt-[var(--space-md)] flex flex-wrap items-center gap-[var(--space-xl)]">
            <Link href="/en/" className="btn btn-primary">{en("notFound.home")}</Link>
            <Link href="/id/" className="btn btn-secondary">{id("notFound.home")}</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
