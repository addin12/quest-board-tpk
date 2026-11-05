"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { call, type Me } from "@/lib/account-api";
import { formatWhen } from "@/lib/format";
import { paths } from "@/lib/hrefs";
import type { MsgKey } from "@/lib/i18n/core";
import type { GameRecord, GmRecord } from "@/lib/types";
import { useI18n } from "../i18n-provider";
import { Notice } from "../ui";
import { EmailSignIn } from "./email-sign-in";
import { errorText } from "./fields";
import { GameForm } from "./game-form";
import { ProfileForm } from "./profile-form";

type View = { kind: "loading" } | { kind: "out"; badLink: boolean } | { kind: "confirm"; token: string; email: string } | { kind: "in"; me: Me };

/** A game's time, or a dash if it has none we can read (a broken old row must not take the whole page down). */
function when(iso: string, lang: Parameters<typeof formatWhen>[1], zone: GameRecord["zone"]): string {
  try {
    return formatWhen(iso, lang, zone);
  } catch {
    return "-";
  }
}

const STATUS_CLASS = { pending: "", approved: "bg-success-soft! text-ink!", rejected: "bg-danger-soft! text-ink!" } as const;

function Status({ status }: { status: GmRecord["status"] }) {
  const { t } = useI18n();
  return <span className={`chip ${STATUS_CLASS[status]}`} data-testid="status">{t(`acct.status.${status}` as MsgKey)}</span>;
}

/** The signed-in GM's page: profile, games, self-service. Signed out, it asks for an email address. */
export function AccountApp() {
  const { t, lang } = useI18n();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [message, setMessage] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editing, setEditing] = useState<GameRecord | "new" | null>(null);
  const [confirm, setConfirm] = useState<string>("");

  const load = useCallback(async (badLink = false) => {
    const r = await call<Me>("GET", "/me");
    setView(r.ok ? { kind: "in", me: r.data } : { kind: "out", badLink });
  }, []);

  useEffect(() => {
    // A sign-in link arrives as /account/#t=<token>; the token is removed from the address at once. The page asks whose account the
    // link opens and waits for a click before using it (a link sent by someone else would otherwise sign this browser in silently).
    const m = /^#t=([A-Za-z0-9_-]+)$/.exec(window.location.hash);
    if (!m) { void load(); return; } // eslint-disable-line react-hooks/set-state-in-effect -- asks the backend who is signed in
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    void call<{ email: string }>("POST", "/login/peek", { token: m[1] }).then((r) => (r.ok ? setView({ kind: "confirm", token: m[1]!, email: r.data.email }) : load(true)));
  }, [load]);

  async function after(note: string) {
    setMessage(note);
    setEditingProfile(false);
    setEditing(null);
    setConfirm("");
    await load();
  }

  const [now] = useState(() => Date.now()); // the page's idea of "now" for next sessions and for when a listing runs out
  async function act(run: () => Promise<{ ok: boolean; error?: string }>, note: string) {
    const r = await run();
    if (r.ok) await after(note);
    else setMessage(errorText(t, r.error ?? "server"));
  }

  if (view.kind === "loading") return <p role="status" className="lead">{t("acct.verifying")}</p>;

  if (view.kind === "confirm") {
    const { token } = view;
    return (
      <div className="max-w-xl" data-testid="signin-confirm">
        <h2 className="text-[length:var(--text-section)]">{t("acct.confirmTitle", { email: view.email })}</h2>
        <p className="lead mt-[var(--space-md)]">{t("acct.confirmBody")}</p>
        <p className="mt-[var(--space-lg)] flex flex-wrap gap-[var(--space-md)]">
          <button type="button" className="btn btn-primary" data-testid="signin-continue" onClick={() => { setView({ kind: "loading" }); void call("POST", "/login/verify", { token }).then((r) => load(!r.ok)); }}>{t("acct.confirmYes")}</button>
          <button type="button" className="btn btn-secondary" onClick={() => setView({ kind: "out", badLink: false })}>{t("acct.confirmNo")}</button>
        </p>
      </div>
    );
  }

  if (view.kind === "out") {
    return (
      <div>
        {view.badLink && <div className="mb-[var(--space-lg)] max-w-xl"><Notice tone="danger">{t("acct.linkBad")}</Notice></div>}
        <EmailSignIn heading={t("acct.signIn")} lead={t("acct.lead")} />
      </div>
    );
  }

  const { me } = view;
  const profile = me.profile;

  return (
    <div className="grid gap-[var(--space-2xl)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-md)]">
        <p className="font-medium" data-testid="signed-in-as">{t("acct.signedInAs", { email: me.email })}</p>
        <div className="flex flex-wrap items-center gap-[var(--space-lg)]">
          {me.admin && <Link href={paths.admin(lang)} className="btn btn-secondary">{t("acct.admin")}</Link>}
          <button type="button" className="btn btn-secondary" onClick={() => act(async () => { await call("POST", "/logout"); return { ok: true }; }, "")}>{t("acct.signOut")}</button>
        </div>
      </div>

      {message && <div role="status" data-testid="message"><Notice tone="success">{message}</Notice></div>}

      {me.mergeOffers.length > 0 && (
        <section aria-labelledby="merge-h" className="well max-w-2xl" data-testid="merge-offers">
          <h2 id="merge-h" className="max-w-none text-[length:var(--text-title)]">{t("acct.mergeTitle")}</h2>
          {me.mergeOffers.map((o) => (
            <div key={o.id} className="mt-[var(--space-md)]" data-testid="merge-offer">
              <p className="text-ink-2">{t("acct.mergeBody", { email: o.email, name: o.name })}</p>
              <p className="mt-[var(--space-lg)] flex flex-wrap items-center gap-[var(--space-md)]">
                <button type="button" className="btn btn-primary" onClick={() => act(() => call("POST", "/merge/respond", { id: o.id, accept: true }), t("acct.mergeDone", { email: o.email }))}>{t("acct.mergeAccept")}</button>
                <button type="button" className="btn btn-secondary" onClick={() => act(() => call("POST", "/merge/respond", { id: o.id, accept: false }), t("acct.mergeDeclined"))}>{t("acct.mergeDecline")}</button>
              </p>
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="profile-h">
        <h2 id="profile-h">{t("acct.profileTitle")}</h2>
        {!profile || editingProfile ? (
          <div className="mt-[var(--space-lg)] max-w-2xl">
            <p className="lead mb-[var(--space-lg)]">{profile ? t("acct.reviewNote") : t("acct.profileLead")}</p>
            <ProfileForm profile={profile} onSaved={after} onCancel={profile ? () => setEditingProfile(false) : undefined} />
          </div>
        ) : (
          <div className="mt-[var(--space-lg)] grid gap-[var(--space-sm)]">
            <p className="flex flex-wrap items-center gap-[var(--space-md)]"><span className="font-display text-[length:var(--text-title)]">{profile.name}</span><Status status={profile.status} /></p>
            <p className="text-ink-2">{profile.city}</p>
            {profile.status === "rejected" && profile.rejectReason && <p className="font-medium text-danger">{t("acct.reason", { reason: profile.rejectReason })}</p>}
            <p><button type="button" className="btn btn-secondary" onClick={() => setEditingProfile(true)}>{t("acct.editProfile")}</button></p>
          </div>
        )}
      </section>

      <section aria-labelledby="games-h">
        <h2 id="games-h">{t("acct.gamesTitle")}</h2>
        {!profile ? (
          <p className="lead mt-[var(--space-md)]">{t("acct.profileFirst")}</p>
        ) : editing ? (
          <div className="mx-auto mt-[var(--space-lg)] w-full max-w-5xl">
            <GameForm game={editing === "new" ? null : editing} gmName={profile?.name ?? ""} heading={editing === "new" ? t("acct.gameTitleNew") : editing.title} onSaved={after} onCancel={() => setEditing(null)} />
          </div>
        ) : (
          <>
            <p className="mt-[var(--space-md)] max-w-[60ch] text-ink-2">{t("acct.fullNote")}</p>
            {me.games.length === 0 ? (
              <p className="lead mt-[var(--space-lg)]">{t("acct.noGames")}</p>
            ) : (
              <ul className="ruled mt-[var(--space-lg)]" data-testid="my-games">
                {me.games.map((g) => (
                  <li key={g.id} className="grid gap-[var(--space-sm)] py-[var(--space-lg)]" data-testid="my-game">
                    <p className="flex flex-wrap items-center gap-[var(--space-md)]">
                      <span className="font-display text-[length:var(--text-title)]">{g.title}</span>
                      <Status status={g.status} />
                      {g.full && <span className="chip chip-spot">{t("game.full")}</span>}
                    </p>
                    <p className="text-ink-2">{`${g.system}, ${g.onDemand ? t("game.onRequest") : when(g.startsAt, lang, g.zone)}`}</p>
                    {g.onDemand && <p className="text-sm text-muted">{t("game.listedUntil", { date: when(g.expiresAt, lang, g.zone).replace(/, \d{2}\.\d{2} \w+$/, "") })}</p>}
                    {g.status === "rejected" && g.rejectReason && <p className="font-medium text-danger">{t("acct.reason", { reason: g.rejectReason })}</p>}
                    {confirm === g.id ? (
                      <div className="flex flex-wrap items-center gap-[var(--space-lg)]" role="alert">
                        <span className="font-medium">{t("acct.removeConfirm", { title: g.title })}</span>
                        <button type="button" className="btn btn-danger" onClick={() => act(() => call("DELETE", `/games/${g.id}`), "")}>{t("acct.removeYes")}</button>
                        <button type="button" className="btn btn-secondary" onClick={() => setConfirm("")}>{t("acct.cancel")}</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-[var(--space-lg)]">
                        <button type="button" className="btn btn-secondary" onClick={() => { setMessage(""); setEditing(g); }}>{t("acct.editGame")}</button>
                        {g.onDemand && Date.parse(g.expiresAt) - now < 14 * 86_400_000 && (
                          <button type="button" className="btn btn-secondary" onClick={() => act(() => call("POST", `/games/${g.id}/extend`), t("acct.extended"))} data-testid="extend">{t("acct.extend")}</button>
                        )}
                        <button type="button" className="btn btn-secondary" onClick={() => act(() => call("POST", `/games/${g.id}/full`, { full: !g.full }), t("acct.savedFull"))}>{g.full ? t("acct.reopen") : t("acct.markFull")}</button>
                        <button type="button" className="btn btn-ghost" onClick={() => setConfirm(g.id)}>{t("acct.remove")}</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-[var(--space-lg)]"><button type="button" className="btn btn-primary" onClick={() => { setMessage(""); setEditing("new"); }}>{t("acct.addGame")}</button></p>
          </>
        )}
      </section>

      <section aria-labelledby="erase-h" className="well max-w-2xl">
        <h2 id="erase-h" className="max-w-none text-[length:var(--text-title)]">{t("acct.eraseTitle")}</h2>
        <p className="mt-[var(--space-sm)] text-ink-2">{t("acct.eraseBody")}</p>
        {confirm === "erase" ? (
          <p className="mt-[var(--space-lg)] flex flex-wrap items-center gap-[var(--space-lg)]">
            <button type="button" className="btn btn-danger" onClick={async () => { const r = await call("DELETE", "/account"); if (r.ok) { setMessage(t("acct.erased")); setView({ kind: "out", badLink: false }); } else setMessage(errorText(t, r.error)); }}>{t("acct.eraseYes")}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirm("")}>{t("acct.cancel")}</button>
          </p>
        ) : (
          <p className="mt-[var(--space-lg)]"><button type="button" className="btn btn-secondary" onClick={() => setConfirm("erase")}>{t("acct.erase")}</button></p>
        )}
      </section>
    </div>
  );
}
