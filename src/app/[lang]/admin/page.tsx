import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminApp } from "@/components/admin/admin-app";
import { I18nProvider } from "@/components/i18n-provider";
import { adminMessages } from "@/lib/i18n/dict";
import { isLang } from "@/lib/types";

// Not linked from anywhere and kept out of search results. Everything on it needs an admin's Google sign-in.
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  // The public pages are sent only the public strings; this page adds the admin ones.
  return (
    <I18nProvider lang={lang} messages={adminMessages(lang)}>
      <AdminApp />
    </I18nProvider>
  );
}
