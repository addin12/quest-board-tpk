import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
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
      <a href={url} target="_blank" rel="noopener noreferrer" className={primary ? "btn-primary" : "btn-secondary"}>
        <Icon name="paper-plane" /> {label} <span className="sr-only">{t("a11y.opensNewTab")}</span>
      </a>
    ) : (
      <span className="btn-secondary pointer-events-none opacity-60" aria-disabled="true">{label}</span>
    );

  const steps = [
    { title: t("post.step1Title"), body: t("post.step1Body"), action: button(GM_FORM_URL, t("post.step1Button"), true) },
    { title: t("post.step2Title"), body: t("post.step2Body"), action: button(GAME_FORM_URL, t("post.step2Button"), true) },
    { title: t("post.step3Title"), body: t("post.step3Body"), action: null },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-bold">{t("post.title")}</h1>
      <p className="mt-3 text-lg text-muted">{t("post.lead")}</p>
      {(!GM_FORM_URL || !GAME_FORM_URL) && <div className="mt-6"><Notice tone="warn">{t("post.notConnected")}</Notice></div>}

      <ol className="mt-8 space-y-4">
        {steps.map((s) => (
          <li key={s.title} className="card p-6">
            <h2 className="text-xl font-bold">{s.title}</h2>
            <p className="mt-1 text-muted">{s.body}</p>
            {s.action && <p className="mt-4">{s.action}</p>}
          </li>
        ))}
      </ol>

      <section className="mt-10" aria-labelledby="public-h">
        <h2 id="public-h" className="text-xl font-bold">{t("post.public")}</h2>
        <ul className="mt-3 space-y-2">
          {[t("post.public1"), t("post.public2"), t("post.public3")].map((s) => <li key={s} className="flex gap-3"><Icon name="eye" className="mt-1.5 shrink-0 text-muted" /><span>{s}</span></li>)}
          <li className="flex gap-3 font-semibold"><Icon name="lock" className="mt-1.5 shrink-0 text-success" /><span>{t("post.private")}</span></li>
        </ul>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="card p-6"><h2 className="text-lg font-bold">{t("post.changeTitle")}</h2><p className="mt-1 text-sm text-muted">{t("post.changeBody")}</p></div>
        <div className="card p-6"><h2 className="text-lg font-bold">{t("post.removeTitle")}</h2><p className="mt-1 text-sm text-muted">{t("post.removeBody")}</p></div>
      </section>
    </div>
  );
}
