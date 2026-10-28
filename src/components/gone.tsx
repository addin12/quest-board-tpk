import Link from "next/link";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/types";

/** The page at the address of a listing that was live and is not now: a notice only, no details and no way to contact. */
export function Gone({ kind, lang }: { kind: "game" | "gm"; lang: Lang }) {
  const t = makeT(lang);
  const game = kind === "game";
  return (
    <div className="wrap py-[var(--section-gap-s)]" data-testid="gone">
      <div className="ruled flex flex-col items-start gap-[var(--space-md)] pt-[var(--space-xl)]">
        <h1 className="max-w-[18ch] text-[length:var(--text-display-s)]">{t(game ? "gone.gameTitle" : "gone.gmTitle")}</h1>
        <p className="lead max-w-[52ch] text-ink-2">{t(game ? "gone.gameBody" : "gone.gmBody")}</p>
        <Link href={game ? paths.games(lang) : paths.gms(lang)} className="btn btn-primary mt-[var(--space-md)]">{t(game ? "gone.gamesLink" : "gone.gmsLink")}</Link>
      </div>
    </div>
  );
}

/** Metadata of that page: it says nothing about the listing and stays out of search results. */
export function goneMetadata(kind: "game" | "gm", lang: Lang) {
  return { title: makeT(lang)(kind === "game" ? "gone.gameTitle" : "gone.gmTitle"), robots: { index: false, follow: false } };
}
