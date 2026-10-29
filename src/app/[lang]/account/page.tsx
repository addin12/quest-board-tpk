import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountApp } from "@/components/account/account-app";
import { makeT } from "@/lib/i18n/dict";
import { isLang } from "@/lib/types";

// Everything here is private to the signed-in person: kept out of search results.
export async function generateMetadata({ params }: PageProps<"/[lang]/account">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLang(lang) ? makeT(lang)("acct.title") : "Account", robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{t("acct.title")}</h1>
      <div className="mt-[var(--space-xl)]"><AccountApp /></div>
    </div>
  );
}
