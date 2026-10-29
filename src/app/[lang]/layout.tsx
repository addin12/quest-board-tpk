import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chivo, Ultra } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { LanguageSwitcher, NavLinks } from "@/components/nav";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { makeT, publicMessages } from "@/lib/i18n/dict";
import { paths } from "@/lib/hrefs";
import { SITE_URL } from "@/lib/site";
import { LANGS, isLang } from "@/lib/types";
import "../globals.css";
import "../icons/icons.css";

// Halftone typography: Ultra for heads and the wordmark, Chivo for everything else. Self-hosted at build time.
const ultra = Ultra({ variable: "--font-ultra", subsets: ["latin"], weight: "400" });
const chivo = Chivo({ variable: "--font-chivo", subsets: ["latin"], weight: ["400", "700"] });

export const dynamicParams = false;
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#faf4de" }, { media: "(prefers-color-scheme: dark)", color: "#1b1613" }] };

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
    <html lang={lang} suppressHydrationWarning className={`${ultra.variable} ${chivo.variable} h-full overflow-x-clip antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="overflow-x-clip max-lg:pb-16">
        <I18nProvider lang={lang} messages={publicMessages(lang)}>
          <a href="#main" className="btn btn-primary sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">{t("nav.skip")}</a>
          <header className="border-b-3 border-ink">
            <div className="wrap flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:py-6">
              <Link href={paths.home(lang)} className="wordmark text-xl lg:order-2 lg:text-4xl">{"Quest Board TPK"}</Link>
              <div className="justify-self-end lg:order-1 lg:justify-self-start"><LanguageSwitcher /></div>
              <div className="hidden lg:order-3 lg:block" />
            </div>
            <div className="hidden border-t border-rule lg:block">
              <div className="wrap"><NavLinks variant="header" /></div>
            </div>
          </header>
          <main id="main" className="flex-1">{children}</main>
          <footer className="band-tint border-t-3 border-ink">
            <div className="wrap grid gap-[var(--space-xl)] py-[var(--space-3xl)] lg:grid-cols-12">
              <div className="lg:col-span-6">
                <p className="font-display text-[length:var(--text-2xl)] leading-tight">{t("footer.tagline")}</p>
                <p className="mt-[var(--space-md)] max-w-[44ch] text-muted">{t("footer.noBooking")}</p>
              </div>
              <div className="flex flex-col lg:col-span-3 lg:col-start-7">
                <p className="font-bold">{t("footer.explore")}</p>
                <Link href={paths.games(lang)} className="inline-flex min-h-11 items-center text-muted hover:text-ink">{t("nav.games")}</Link>
                <Link href={paths.gms(lang)} className="inline-flex min-h-11 items-center text-muted hover:text-ink">{t("nav.gms")}</Link>
                <Link href={paths.how(lang)} className="inline-flex min-h-11 items-center text-muted hover:text-ink">{t("nav.how")}</Link>
              </div>
              <div className="flex flex-col lg:col-span-3">
                <p className="font-bold">{t("footer.gms")}</p>
                <Link href={paths.list(lang)} className="inline-flex min-h-11 items-center text-muted hover:text-ink">{t("nav.list")}</Link>
                <Link href={paths.account(lang)} className="inline-flex min-h-11 items-center text-muted hover:text-ink">{t("footer.account")}</Link>
                <Link href={`${paths.how(lang)}#safety`} className="inline-flex min-h-11 items-center text-muted hover:text-ink">{t("footer.safety")}</Link>
              </div>
            </div>
            <div className="wrap flex flex-wrap items-center justify-between gap-[var(--space-md)] border-t border-rule py-[var(--space-md)] text-sm text-muted">
              <ThemeSwitcher />
              <span>
                {/* Required attribution for free use of Flaticon UIcons. */}
                {t("footer.iconsBy")}{" "}
                <a href="https://www.flaticon.com/uicons" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">Uicons by Flaticon</a>
              </span>
            </div>
          </footer>
          <nav aria-label={t("nav.main")} className="fixed inset-x-0 bottom-0 z-40 border-t-3 border-ink bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
            <NavLinks variant="tabs" />
          </nav>
        </I18nProvider>
      </body>
    </html>
  );
}
