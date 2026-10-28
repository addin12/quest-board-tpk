import Link from "next/link";
import { makeT } from "@/lib/i18n/dict";
import { Chivo, Ultra } from "next/font/google";
import "./globals.css";

const ultra = Ultra({ variable: "--font-ultra", subsets: ["latin"], weight: "400" });
const chivo = Chivo({ variable: "--font-chivo", subsets: ["latin"], weight: ["400", "700"] });

// The 404 for any address that isn't a page (the site is static, so this becomes 404.html). It ignores the [lang]
// layout, so it speaks both languages and links to both home pages.
export const metadata = { title: "404 · Quest Board TPK" };

export default function GlobalNotFound() {
  const en = makeT("en");
  const id = makeT("id");
  return (
    <html lang="en" className={`${ultra.variable} ${chivo.variable}`}>
      <body className="items-start justify-center">
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
