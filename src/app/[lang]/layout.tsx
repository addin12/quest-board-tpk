import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alegreya, Alegreya_Sans, Cinzel } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { Icon } from "@/components/icon";
import { LanguageSwitcher, NavLinks } from "@/components/nav";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { makeT, publicMessages } from "@/lib/i18n/dict";
import { paths } from "@/lib/hrefs";
import { SITE_URL } from "@/lib/site";
import { LANGS, isLang } from "@/lib/types";
import "../globals.css";
import "../icons/icons.css";

// Tavern typography: Cinzel for headings, Alegreya for small titles, Alegreya Sans for text. Self-hosted at build time.
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"] });
const alegreya = Alegreya({ variable: "--font-alegreya", subsets: ["latin"], weight: ["700"] });
const alegreyaSans = Alegreya_Sans({ variable: "--font-alegreya-sans", subsets: ["latin"], weight: ["400", "700"] });

export const dynamicParams = false;
export const viewport: Viewport = { themeColor: "#2a1a0e" };

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = makeT(lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("meta.title"), template: "%s · Quest Board TPK" },
    description: t("meta.description"),
    openGraph: { siteName: "Quest Board TPK", type: "website", title: t("meta.title"), description: t("meta.description"), locale: lang === "id" ? "id_ID" : "en_US" },
    twitter: { card: "summary" },
  };
}

// Applies a remembered light/dark choice before the first paint, so the page never flashes the other theme.
const THEME_INIT = `try{var t=localStorage.getItem("tpk-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = makeT(lang);
  return (
    <html lang={lang} suppressHydrationWarning className={`${cinzel.variable} ${alegreya.variable} ${alegreyaSans.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans max-lg:pb-16">
        <I18nProvider lang={lang} messages={publicMessages(lang)}>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 btn-primary">{t("nav.skip")}</a>
          <header className="on-wood wood-plank sticky top-0 z-40 border-b border-[#8a6a3a]">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
              <Link href={paths.home(lang)} className="mr-2 flex min-h-11 items-center gap-2 text-lg font-extrabold tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>
                <Icon name="dice-d20" solid className="text-xl text-accent" />
                <span>Quest Board <span className="text-accent">TPK</span></span>
              </Link>
              <NavLinks variant="header" />
              <div className="ml-auto flex items-center gap-2"><LanguageSwitcher /></div>
            </div>
          </header>
          <main id="main" className="flex-1">{children}</main>
          <footer className="on-wood wood-plank mt-16 border-t-2 border-[#8a6a3a]">
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:grid-cols-3">
              <div>
                <p className="flex items-center gap-2 text-base font-extrabold tracking-wide text-text" style={{ fontFamily: "var(--font-heading)" }}><Icon name="dice-d20" solid className="text-accent" /> {"Quest Board TPK"}</p>
                <p className="mt-2">{t("footer.tagline")}</p>
                <p className="mt-2">{t("footer.noBooking")}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-text">{t("footer.explore")}</p>
                <Link href={paths.games(lang)} className="inline-flex min-h-11 items-center hover:text-text">{t("nav.games")}</Link>
                <Link href={paths.gms(lang)} className="inline-flex min-h-11 items-center hover:text-text">{t("nav.gms")}</Link>
                <Link href={paths.how(lang)} className="inline-flex min-h-11 items-center hover:text-text">{t("nav.how")}</Link>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-text">{t("footer.gms")}</p>
                <Link href={paths.list(lang)} className="inline-flex min-h-11 items-center hover:text-text">{t("nav.list")}</Link>
                <Link href={`${paths.how(lang)}#safety`} className="inline-flex min-h-11 items-center hover:text-text">{t("footer.safety")}</Link>
              </div>
            </div>
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 text-xs text-muted">
              <ThemeSwitcher />
              <span>
                {/* Required attribution for free use of Flaticon UIcons. */}
                {t("footer.iconsBy")}{" "}
                <a href="https://www.flaticon.com/uicons" target="_blank" rel="noopener noreferrer" className="underline hover:text-text">Uicons by Flaticon</a>
              </span>
            </div>
          </footer>
          <nav aria-label={t("nav.main")} className="on-wood wood-plank fixed inset-x-0 bottom-0 z-40 border-t border-[#8a6a3a] pb-[env(safe-area-inset-bottom)] lg:hidden">
            <NavLinks variant="tabs" />
          </nav>
        </I18nProvider>
      </body>
    </html>
  );
}
