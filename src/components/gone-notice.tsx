import Link from "next/link";
import { paths } from "@/lib/hrefs";
import type { T } from "@/lib/i18n/core";
import type { Lang } from "@/lib/types";

/** The notice for a listing that is not live (any more): no details and no way to contact. Takes its translator, so a client component can use it. */
export function GoneNotice({ kind, lang, t }: { kind: "game" | "gm"; lang: Lang; t: T }) {
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
