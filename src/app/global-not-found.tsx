import Link from "next/link";
import { makeT } from "@/lib/i18n/dict";
import "./globals.css";

// The 404 for any address that isn't a page (the site is static, so this becomes 404.html). It ignores the [lang]
// layout, so it speaks both languages and links to both home pages.
export const metadata = { title: "404 · Quest Board TPK" };

export default function GlobalNotFound() {
  const en = makeT("en");
  const id = makeT("id");
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-4xl font-bold">{en("notFound.title")}</h1>
        <p className="max-w-md">{en("notFound.body")}</p>
        <p className="max-w-md text-muted">{id("notFound.body")}</p>
        <p className="flex flex-wrap justify-center gap-3">
          <Link href="/en/" className="btn-primary">{en("notFound.home")}</Link>
          <Link href="/id/" className="btn-secondary">{id("notFound.home")}</Link>
        </p>
      </body>
    </html>
  );
}
