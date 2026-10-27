import Image from "next/image";
import Link from "next/link";
import { paths } from "@/lib/hrefs";
import { makeT } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/types";

/** The page at the address of a listing that was live and is not now: a notice only, no details and no way to contact. */
export function Gone({ kind, lang }: { kind: "game" | "gm"; lang: Lang }) {
  const t = makeT(lang);
  const game = kind === "game";
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-testid="gone">
      <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Image src="/images/tavern/empty-tankard.svg" alt="" width={120} height={90} priority />
        <h1 className="text-2xl font-bold">{t(game ? "gone.gameTitle" : "gone.gmTitle")}</h1>
        <p className="max-w-prose text-muted">{t(game ? "gone.gameBody" : "gone.gmBody")}</p>
        <Link href={game ? paths.games(lang) : paths.gms(lang)} className="btn-primary">{t(game ? "gone.gamesLink" : "gone.gmsLink")}</Link>
      </div>
    </div>
  );
}

/** Metadata of that page: it says nothing about the listing and stays out of search results. */
export function goneMetadata(kind: "game" | "gm", lang: Lang) {
  return { title: makeT(lang)(kind === "game" ? "gone.gameTitle" : "gone.gmTitle"), robots: { index: false, follow: false } };
}
