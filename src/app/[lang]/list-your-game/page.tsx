import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui";
import { makeT } from "@/lib/i18n/dict";
import { GAME_FORM_URL, GM_FORM_URL } from "@/lib/site";
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

  const button = (url: string, label: string, primary: boolean) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className={primary ? "btn btn-primary" : "btn btn-secondary"}>
        {label} <span className="sr-only">{t("a11y.opensNewTab")}</span>
      </a>
    ) : (
      <span className="btn btn-secondary pointer-events-none opacity-60" aria-disabled="true">{label}</span>
    );

  const steps = [
    { title: t("post.step1Title"), body: t("post.step1Body"), action: button(GM_FORM_URL, t("post.step1Button"), true) },
    { title: t("post.step2Title"), body: t("post.step2Body"), action: button(GAME_FORM_URL, t("post.step2Button"), true) },
    { title: t("post.step3Title"), body: t("post.step3Body"), action: null },
  ];

  return (
    <div className="wrap pb-[var(--section-gap-s)] pt-[var(--space-2xl)]">
      <h1 className="max-w-none text-[length:var(--text-display-s)]">{t("post.title")}</h1>
      <p className="lead mt-[var(--space-sm)] text-ink-2">{t("post.lead")}</p>
      {(!GM_FORM_URL || !GAME_FORM_URL) && <div className="mt-[var(--space-lg)] max-w-2xl"><Notice tone="warn">{t("post.notConnected")}</Notice></div>}

      <ol className="ruled mt-[var(--space-2xl)] lg:max-w-4xl">
        {steps.map((st) => (
          <li key={st.title} className="py-[var(--space-xl)]">
            <h2 className="max-w-none text-[length:var(--text-section)]">{st.title}</h2>
            <p className="mt-[var(--space-xs)] max-w-[60ch] text-ink-2">{st.body}</p>
            {st.action && <p className="mt-[var(--space-md)]">{st.action}</p>}
          </li>
        ))}
      </ol>

      <section className="mt-[var(--section-gap-s)] grid gap-x-[var(--gap-columns)] gap-y-[var(--space-xl)] lg:grid-cols-12" aria-labelledby="public-h">
        <h2 id="public-h" className="lg:col-span-5">{t("post.public")}</h2>
        <ul className="ruled lg:col-span-7">
          {[t("post.public1"), t("post.public2"), t("post.public3")].map((x) => <li key={x} className="py-[var(--space-md)]">{x}</li>)}
          <li className="py-[var(--space-md)] font-bold">{t("post.private")}</li>
        </ul>
      </section>

      <section className="mt-[var(--section-gap-s)] grid gap-[var(--gap-columns)] sm:grid-cols-2">
        <div className="well"><h2 className="max-w-none text-[length:var(--text-title)]">{t("post.changeTitle")}</h2><p className="mt-[var(--space-sm)] text-ink-2">{t("post.changeBody")}</p></div>
        <div className="well"><h2 className="max-w-none text-[length:var(--text-title)]">{t("post.removeTitle")}</h2><p className="mt-[var(--space-sm)] text-ink-2">{t("post.removeBody")}</p></div>
      </section>
    </div>
  );
}
