import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { makeT } from "@/lib/i18n/dict";
import { paths } from "@/lib/hrefs";
import { languageAlternates } from "@/lib/seo";
import { isLang } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/list-your-game">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = makeT(lang);
  return { title: t("post.title"), description: t("post.lead"), alternates: languageAlternates(lang, "/list-your-game/") };
}

export default async function ListYourGamePage({ params }: PageProps<"/[lang]/list-your-game">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);

  const button = (label: string, primary: boolean) => (
    <Link href={paths.account(lang)} className={primary ? "btn btn-primary" : "btn btn-secondary"}>{label}</Link>
  );

  const steps = [
    { title: t("post.step1Title"), body: t("post.step1Body"), action: button(t("post.step1Button"), true) },
    { title: t("post.step2Title"), body: t("post.step2Body"), action: button(t("post.step2Button"), true) },
    { title: t("post.step3Title"), body: t("post.step3Body"), action: null },
  ];

  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{t("post.title")}</h1>
      <p className="lead mt-[var(--space-sm)] text-ink-2">{t("post.lead")}</p>

      <div className="mt-[var(--space-2xl)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-2xl)] lg:grid-cols-12">
      <ol className="ruled lg:col-span-7">
        {steps.map((st) => (
          <li key={st.title} className="py-[var(--space-xl)]">
            <h2 className="max-w-none text-[length:var(--text-section)]">{st.title}</h2>
            <p className="mt-[var(--space-xs)] max-w-[60ch] text-ink-2">{st.body}</p>
            {st.action && <p className="mt-[var(--space-md)]">{st.action}</p>}
          </li>
        ))}
      </ol>

      <section className="lg:col-span-5" aria-labelledby="public-h">
        <h2 id="public-h" className="text-[length:var(--text-2xl)]">{t("post.public")}</h2>
        <ul className="ruled mt-[var(--space-lg)]">
          {[t("post.public1"), t("post.public2"), t("post.public3")].map((x) => <li key={x} className="py-[var(--space-md)]">{x}</li>)}
          <li className="py-[var(--space-md)] font-bold">{t("post.private")}</li>
        </ul>
      </section>
      </div>

      <section className="mt-[var(--section-gap-s)] grid gap-[var(--gap-columns)] sm:grid-cols-2">
        <div className="well"><h2 className="max-w-none text-[length:var(--text-title)]">{t("post.changeTitle")}</h2><p className="mt-[var(--space-sm)] text-ink-2">{t("post.changeBody")}</p></div>
        <div className="well"><h2 className="max-w-none text-[length:var(--text-title)]">{t("post.removeTitle")}</h2><p className="mt-[var(--space-sm)] text-ink-2">{t("post.removeBody")}</p></div>
      </section>
    </div>
  );
}
