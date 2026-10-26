import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState, GmCard } from "@/components/ui";
import { loadSiteData } from "@/lib/data";
import { makeT } from "@/lib/i18n/dict";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/gms">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return { title: makeT(lang)("gm.title"), alternates: languageAlternates(lang, "/gms/") };
}

export default async function GmsPage({ params }: PageProps<"/[lang]/gms">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  const { gms, games } = loadSiteData();
  const open = (id: string) => games.filter((g) => g.gmId === id).length;
  const sorted = [...gms].sort((a, b) => open(b.id) - open(a.id) || a.name.localeCompare(b.name));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("gm.title")}</h1>
      <p className="mt-1 mb-6 text-muted">{t("gm.lead")}</p>
      {sorted.length === 0 ? (
        <EmptyState title={t("gm.empty")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {sorted.map((gm) => <li key={gm.id} className="flex"><div className="flex w-full flex-col [&>a]:flex-1"><GmCard gm={gm} openGames={open(gm.id)} t={t} lang={lang} /></div></li>)}
        </ul>
      )}
    </div>
  );
}
