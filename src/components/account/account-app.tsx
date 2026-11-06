"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { call, type Me } from "@/lib/account-api";
import { formatPhone } from "@/lib/format";
import { paths } from "@/lib/hrefs";
import { writeSignedIn } from "@/lib/signed-in";
import { adminPictureUrl } from "@/lib/pictures";
import type { GameRecord, GmRecord, SiteGm } from "@/lib/types";
import { useI18n } from "../i18n-provider";
import { GmCard, Notice } from "../ui";
import { EmailSignIn } from "./email-sign-in";
import { errorText } from "./fields";
import { GameForm } from "./game-form";
import { MyGames, StatusText } from "./my-games";
import { ProfileForm } from "./profile-form";

type View = { kind: "loading" } | { kind: "out"; badLink: boolean } | { kind: "confirm"; token: string; email: string } | { kind: "in"; me: Me };
/** What the signed-in page shows: the Game Master's games and profile, or one form in their place. */
type Mode = { kind: "home" } | { kind: "profile" } | { kind: "game"; game: GameRecord | null };

/**
 * The signed-in Game Master's page (ADR-54): their games as the main column, with Add a game at its head; beside them their profile as the Game
 * Masters list shows it; erasing the account at the foot. Editing the profile or a game puts that one form in place of the page. Signed out, it asks
 * for an email address.
 */
export function AccountApp() {
  const { t, lang } = useI18n();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "home" });
  const [moved, setMoved] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const load = useCallback(async (badLink = false) => {
    const r = await call<Me>("GET", "/me");
    // The top bar of every page shows who is signed in from a note kept in this browser (src/lib/signed-in.ts); this is where it is written.
    if (r.ok) writeSignedIn(r.data.profile?.name || r.data.email);
    else if (r.status === 401 || r.status === 403) writeSignedIn(null);
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

  // A form opening in place of the page, or the page coming back with its message, starts at the top of the account (not on the first paint).
  useEffect(() => { if (moved) top.current?.scrollIntoView({ block: "start" }); }, [mode, moved]);

  function open(next: Mode) {
    setMessage("");
    setMoved(true);
    setMode(next);
  }

  async function after(note: string) {
    setMessage(note);
    setMoved(true);
    setMode({ kind: "home" });
    setConfirmErase(false);
    await load();
  }

  const [now] = useState(() => Date.now()); // the page's idea of "now" for when a listing runs out
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
  const openGames = me.games.filter((g) => g.status === "approved" && Date.parse(g.expiresAt) > now).length;
  const home = mode.kind === "home";

  return (
    <div ref={top} className="grid scroll-mt-24 gap-[var(--space-2xl)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-md)] border-b border-rule pb-[var(--space-md)]">
        <p className="text-ink-2" data-testid="signed-in-as">{t("acct.signedInAs", { email: me.email })}</p>
        <div className="flex flex-wrap items-center gap-[var(--space-lg)]">
          {me.admin && <Link href={paths.admin(lang)} className="btn btn-secondary">{t("acct.admin")}</Link>}
          <button type="button" className="btn btn-secondary" onClick={() => act(async () => { await call("POST", "/logout"); return { ok: true }; }, "")}>{t("acct.signOut")}</button>
        </div>
      </div>

      {message && <div role="status" data-testid="message"><Notice tone="success">{message}</Notice></div>}

      {home && me.mergeOffers.length > 0 && (
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

      {!profile ? (
        <ProfileForm profile={null} heading={t("acct.profileTitle")} lead={t("acct.profileLead")} openGames={0} onSaved={after} />
      ) : mode.kind === "profile" ? (
        <ProfileForm profile={profile} heading={t("acct.profileEditTitle")} lead={t("acct.reviewNote")} openGames={openGames} onSaved={after} onCancel={() => open({ kind: "home" })} />
      ) : mode.kind === "game" ? (
        <GameForm game={mode.game} gmName={profile.name} heading={mode.game ? mode.game.title : t("acct.gameTitleNew")} onSaved={after} onCancel={() => open({ kind: "home" })} />
      ) : (
        <div className="grid gap-[var(--space-2xl)] lg:grid-cols-[minmax(0,1fr)_17rem]">
          <MyGames games={me.games} now={now} onAdd={() => open({ kind: "game", game: null })} onEdit={(game) => open({ kind: "game", game })} act={act} />
          <ProfileSummary profile={profile} openGames={openGames} onEdit={() => open({ kind: "profile" })} />
        </div>
      )}

      {(home || !profile) && (
        <section aria-labelledby="erase-h" className="border-t border-rule pt-[var(--space-xl)]">
          <h2 id="erase-h" className="text-[length:var(--text-lg)]">{t("acct.eraseTitle")}</h2>
          <p className="mt-[var(--space-xs)] max-w-[60ch] text-ink-2">{t("acct.eraseBody")}</p>
          {confirmErase ? (
            <p className="mt-[var(--space-md)] flex flex-wrap items-center gap-[var(--space-lg)]">
              <button type="button" className="btn btn-danger" onClick={async () => { const r = await call("DELETE", "/account"); if (r.ok) { writeSignedIn(null); setMessage(t("acct.erased")); setView({ kind: "out", badLink: false }); } else setMessage(errorText(t, r.error)); }}>{t("acct.eraseYes")}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmErase(false)}>{t("acct.cancel")}</button>
            </p>
          ) : (
            <p className="mt-[var(--space-md)]"><button type="button" className="btn btn-secondary" onClick={() => setConfirmErase(true)}>{t("acct.erase")}</button></p>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * The profile beside the games: the row the Game Masters list shows (a link to the live page once it is live), where it stands, and the ways players
 * reach the Game Master, the WhatsApp number written the way its owner types it.
 */
function ProfileSummary({ profile, openGames, onEdit }: { profile: GmRecord; openGames: number; onEdit: () => void }) {
  const { t, lang } = useI18n();
  const live = profile.status === "approved";
  const gm: SiteGm = {
    id: profile.id, slug: profile.slug, name: profile.name, bio: profile.bio, city: profile.city, systems: profile.systems,
    discord: profile.discord, instagram: profile.instagram, photo: live && profile.photoId ? adminPictureUrl(profile.photoId) : null, joinedAt: profile.submittedAt,
  };
  const reach: [string, string][] = [["WhatsApp", formatPhone(profile.whatsapp)]];
  if (profile.discord) reach.push(["Discord", profile.discord]);
  if (profile.instagram) reach.push(["Instagram", `@${profile.instagram}`]);
  return (
    <section aria-labelledby="profile-h" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--space-md)]">
        <h2 id="profile-h" className="text-[length:var(--text-lg)]">{t("acct.profileTitle")}</h2>
        <StatusText status={profile.status} />
      </div>
      <div className="mt-[var(--space-sm)] border-t-3 border-ink">
        <GmCard gm={gm} openGames={openGames} t={t} lang={lang} preview={!live} />
      </div>
      {profile.status === "rejected" && profile.rejectReason && <p className="mb-[var(--space-sm)] font-medium text-danger">{t("acct.reason", { reason: profile.rejectReason })}</p>}
      <dl className="grid gap-[var(--space-2xs)] border-t border-rule pt-[var(--space-sm)] text-sm" aria-label={t("acct.profilePart.contact")}>
        {reach.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-[var(--space-md)]">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 truncate tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-[var(--space-md)]"><button type="button" className="btn btn-secondary" onClick={onEdit}>{t("acct.editProfile")}</button></p>
    </section>
  );
}
