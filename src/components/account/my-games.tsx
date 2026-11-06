"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { call } from "@/lib/account-api";
import { formatShortDay, formatWhen } from "@/lib/format";
import { paths } from "@/lib/hrefs";
import type { MsgKey } from "@/lib/i18n/core";
import { adminPictureUrl } from "@/lib/pictures";
import type { GameRecord, Status } from "@/lib/types";
import { useI18n } from "../i18n-provider";
import { Cover, placesLabel } from "../ui";

/** An on-request listing can be extended once this little of it is left (the button stays away until then). */
const EXTEND_WITHIN_MS = 14 * 86_400_000;

/** A date we cannot read (a broken old row) shows as a dash rather than taking the page down. */
function safely(format: () => string): string {
  try {
    return format();
  } catch {
    return "–";
  }
}

/** Where a thing stands, said quietly: "Live" in grey, a held one plainly, a hidden one in the danger colour. */
const STATUS_TEXT: Record<Status, string> = { approved: "text-sm text-muted", pending: "text-sm font-medium text-ink", rejected: "text-sm font-medium text-danger" };

export function StatusText({ status, ended = false }: { status: Status; ended?: boolean }) {
  const { t } = useI18n();
  return <span className={`shrink-0 ${STATUS_TEXT[ended ? "pending" : status]}`} data-testid="status">{t(ended ? "acct.status.ended" : (`acct.status.${status}` as MsgKey))}</span>;
}

type Act = (run: () => Promise<{ ok: boolean; error?: string }>, note: string) => Promise<void>;

/**
 * The Game Master's games (ADR-54): the main column of the account page. Adding one is the heading's button; each game is a row like the board's own
 * index rows (a small cover, the title, its facts) with its status said quietly and its actions under it. A live game's title opens its page.
 */
export function MyGames({ games, now, onAdd, onEdit, act }: { games: GameRecord[]; now: number; onAdd: () => void; onEdit: (g: GameRecord) => void; act: Act }) {
  const { t, lang } = useI18n();
  const [confirm, setConfirm] = useState("");
  // The remove question: focus goes to its safe answer (Cancel) when it opens; Cancel gives focus back to the Remove button it came from.
  useEffect(() => { if (confirm) document.getElementById(`remove-cancel-${confirm}`)?.focus(); }, [confirm]);
  const cancelRemove = (id: string) => { setConfirm(""); requestAnimationFrame(() => document.getElementById(`remove-${id}`)?.focus()); };
  // A removed game's row is gone with the button that was pressed: focus goes to the list's heading, and the page says so.
  const remove = (id: string) => act(() => call("DELETE", `/games/${id}`), t("acct.removedGame")).then(() => document.getElementById("games-h")?.focus());

  return (
    <section aria-labelledby="games-h" className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-[var(--space-md)]">
        <h2 id="games-h" tabIndex={-1} className="text-[length:var(--text-title)] outline-none">{t("acct.gamesTitle")}</h2>
        <button type="button" className="btn btn-primary" onClick={onAdd}>{t("acct.addGame")}</button>
      </div>
      {games.length === 0 ? (
        <p className="mt-[var(--space-md)] max-w-[52ch] border-t-3 border-ink pt-[var(--space-lg)] text-ink-2">{t("acct.noGames")}</p>
      ) : (
        <>
          <ul className="ruled mt-[var(--space-md)]" data-testid="my-games">
            {games.map((g) => {
              const ended = g.status === "approved" && Date.parse(g.expiresAt) <= now; // approved, but past its end: no longer on the board
              const live = g.status === "approved" && !ended;
              const when = g.onDemand ? t("game.onRequest") : safely(() => formatWhen(g.startsAt, lang, g.zone));
              const where = g.locationType === "online" ? t("loc.online") : placesLabel(g);
              return (
                <li key={g.id} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-[var(--space-md)] py-[var(--space-lg)] sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-x-[var(--space-lg)]" data-testid="my-game">
                  {/* The cover, with the board's own "Full" label on its corner. A game without one says so (a picture helps players); a stored one is
                      private until the game is live, so a held or hidden game shows an empty frame. */}
                  <div className="relative self-start">
                    {g.coverId
                      ? <Cover src={g.status === "approved" ? adminPictureUrl(g.coverId) : null} seed={g.title} quiet className="aspect-[4/5] w-full" sizes="80px" />
                      : <div className="plate grid aspect-[4/5] w-full place-items-center p-[var(--space-2xs)] text-center text-xs leading-tight text-muted">{t("acct.noPicture")}</div>}
                    {g.full && <span className="absolute bottom-0 right-0 bg-ink px-1.5 text-sm font-medium text-paper">{t("game.full")}</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--space-md)] gap-y-[var(--space-2xs)]">
                      <h3 className="min-w-0 font-display text-[length:var(--text-lg)] leading-tight">
                        {live ? <Link href={paths.game(lang, g.slug)} className="underline-offset-4 hover:underline">{g.title}</Link> : g.title}
                      </h3>
                      <StatusText status={g.status} ended={ended} />
                    </div>
                    <p className="mt-[var(--space-2xs)] text-ink-2">{[g.system, when, where].filter(Boolean).join(" · ")}</p>
                    {g.onDemand && <p className="mt-[var(--space-2xs)] text-sm text-muted">{t("game.listedUntil", { date: safely(() => formatShortDay(g.expiresAt, lang, g.zone)) })}</p>}
                    {g.status === "rejected" && g.rejectReason && <p className="mt-[var(--space-2xs)] font-medium text-danger">{t("acct.reason", { reason: g.rejectReason })}</p>}
                    {confirm === g.id ? (
                      <div className="mt-[var(--space-sm)] flex flex-wrap items-center gap-x-[var(--space-lg)] gap-y-[var(--space-xs)]" role="alert">
                        <span className="font-medium">{t("acct.removeConfirm", { title: g.title })}</span>
                        <button type="button" className="btn btn-danger" onClick={() => remove(g.id)}>{t("acct.removeYes")}</button>
                        <button type="button" id={`remove-cancel-${g.id}`} className="btn btn-secondary" onClick={() => cancelRemove(g.id)}>{t("acct.cancel")}</button>
                      </div>
                    ) : (
                      <div className="mt-[var(--space-sm)] flex flex-wrap items-center gap-x-[var(--space-lg)] gap-y-[var(--space-xs)]">
                        <button type="button" className="btn btn-secondary min-w-11" onClick={() => onEdit(g)}>{t("acct.editGame")}</button>
                        {g.onDemand && Date.parse(g.expiresAt) - now < EXTEND_WITHIN_MS && (
                          <button type="button" className="btn btn-secondary" onClick={() => act(() => call("POST", `/games/${g.id}/extend`), t("acct.extended"))} data-testid="extend">{t("acct.extend")}</button>
                        )}
                        <button type="button" className="btn btn-secondary" onClick={() => act(() => call("POST", `/games/${g.id}/full`, { full: !g.full }), t("acct.savedFull"))}>{g.full ? t("acct.reopen") : t("acct.markFull")}</button>
                        <button type="button" id={`remove-${g.id}`} className="btn btn-ghost" onClick={() => setConfirm(g.id)}>{t("acct.remove")}</button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-[var(--space-md)] max-w-[60ch] text-sm text-muted">{t("acct.fullNote")}</p>
        </>
      )}
    </section>
  );
}
