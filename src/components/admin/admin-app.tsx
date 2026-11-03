"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, signOutSession, whoami } from "@/lib/admin-api";
import { buildItems, pollDelay, publishState, siteBehind, titleOf, whenLabel, type Item, type PublishState } from "@/lib/admin-view";
import type { MsgKey } from "@/lib/i18n/core";
import type { AdminEntry, AdminFields, DeployInfo, QueueResponse, Status } from "@/lib/types";
import { Icon } from "../icon";
import { useI18n } from "../i18n-provider";
import { Notice } from "../ui";
import { AdminsPane } from "./admins-pane";
import { ReviewPane } from "./review-pane";
import { EmailSignIn } from "../account/email-sign-in";

type Phase = "init" | "signedOut" | "loading" | "forbidden" | "ready" | "error";
type Toast = { id: number; text: string; undo?: () => void };
type Tab = "games" | "gms" | "admins";

/**
 * The curation page. Admins sign in with an emailed link like everyone else; this loads the queue from the backend and sends each
 * decision back (the change shows at once and is undone if the backend refuses).
 */
export function AdminApp({ builtAt }: { builtAt: string }) {
  const { t, lang } = useI18n();
  const [phase, setPhase] = useState<Phase>("init");
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [expired, setExpired] = useState(false);
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("games");
  const [toast, setToast] = useState<Toast | null>(null);
  const toastId = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  const say = useCallback((text: string, undo?: () => void) => {
    const id = ++toastId.current;
    setToast({ id, text, undo });
    window.setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 9000);
  }, []);

  const signOut = useCallback((wasExpired = false) => {
    void signOutSession();
    setSignedIn(false);
    setQueue(null);
    setExpired(wasExpired);
    setPhase("signedOut");
  }, []);

  const call = useCallback(async <T,>(action: string, body: Record<string, unknown> = {}): Promise<T> => {
    try {
      return await api<T>(action, body);
    } catch (e) {
      if (e instanceof ApiError && e.code === "unauthorized") signOut(true);
      throw e;
    }
  }, [signOut]);

  const load = useCallback(async () => {
    try {
      const q = await call<QueueResponse>("queue");
      setQueue(q);
      setNow(Date.now());
      setPhase("ready");
    } catch (e) {
      if (e instanceof ApiError && e.code === "forbidden") {
        setEmail(String(e.detail.email ?? email));
        setPhase("forbidden");
      } else if (!(e instanceof ApiError && e.code === "unauthorized")) {
        setError(e instanceof ApiError ? e.code : "error");
        setPhase("error");
      }
    }
  }, [call, email]);

  // First load: is there a session (the cookie is HttpOnly, so ask the backend)?
  useEffect(() => {
    void whoami().then((w) => {
      if (w.state === "admin") { setEmail(w.email); setSignedIn(true); setPhase("loading"); }
      else if (w.state === "notAdmin") { setEmail(w.email); setSignedIn(true); setPhase("forbidden"); }
      else setPhase(w.state === "out" ? "signedOut" : "error");
    });
  }, []);

  useEffect(() => {
    if (signedIn && phase === "loading") void load(); // eslint-disable-line react-hooks/set-state-in-effect -- loads the queue once signed in
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the phase becomes loading
  }, [signedIn, phase === "loading"]);

  // Fresh data while the tab is on screen (a GM may have submitted, another admin may have decided): every few seconds while the
  // site is catching up, so "live" shows by itself; calmly otherwise; and at once when the tab comes back into view.
  const state = queue ? publishState(queue.deploy, now) : "live";
  useEffect(() => {
    if (phase !== "ready") return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, pollDelay(state));
    const onShow = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onShow); };
  }, [phase, load, state]);

  const items = useMemo(() => (queue ? buildItems(queue.games, queue.gms, now) : { games: [], gms: [] }), [queue, now]);

  function patchLocal(kind: "game" | "gm", ids: string[], patch: Partial<AdminFields>) {
    const apply = <R extends AdminFields>(rows: R[]): R[] => rows.map((r) => (ids.includes(r.id) ? { ...r, ...patch } : r));
    setQueue((q) => (q ? (kind === "game" ? { ...q, games: apply(q.games) } : { ...q, gms: apply(q.gms) }) : q));
  }

  async function review(list: Item[], status: Status, opts: { reason?: string; notify: boolean }) {
    if (list.length === 0) return;
    const kind = list[0].kind;
    const ids = list.map((i) => i.id);
    const before = list.map((i) => ({ id: i.id, status: i.rec.status, reviewedBy: i.rec.reviewedBy, reviewedAt: i.rec.reviewedAt, rejectReason: i.rec.rejectReason }));
    patchLocal(kind, ids, { status, reviewedBy: email, reviewedAt: new Date().toISOString(), rejectReason: status === "rejected" ? opts.reason ?? "" : "" });
    try {
      // `seen` tells the backend which version of each record this decision is about: one the GM changed meanwhile is refused.
      const seen = Object.fromEntries(list.map((i) => [i.id, i.rec.updatedAt ?? ""]));
      const r = await call<{ publishing: boolean; stale?: string[] }>("review", { kind, ids, status, reason: opts.reason ?? "", notify: opts.notify, seen });
      if (r.publishing) setQueue((q) => (q ? { ...q, deploy: { ...q.deploy, pending: true } } : q));
      const stale = new Set(r.stale ?? []);
      if (stale.size) {
        for (const b of before) if (stale.has(b.id)) patchLocal(kind, [b.id], { status: b.status, reviewedBy: b.reviewedBy, reviewedAt: b.reviewedAt, rejectReason: b.rejectReason });
        void load();
        say(t("admin.toast.stale"));
        if (stale.size === list.length) return;
      }
      const title = titleOf(list[0]) || t("admin.unnamed");
      const text = list.length > 1 ? t("admin.toast.bulk", { n: list.length }) : t(`admin.toast.${status}` as MsgKey, { title });
      say(text, async () => {
        for (const b of before) patchLocal(kind, [b.id], { status: b.status, reviewedBy: b.reviewedBy, reviewedAt: b.reviewedAt, rejectReason: b.rejectReason });
        try {
          for (const status of new Set(before.map((x) => x.status))) await call("review", { kind, ids: before.filter((x) => x.status === status).map((x) => x.id), status, notify: false });
        } catch (e) {
          say(t("admin.toast.error", { error: e instanceof ApiError ? e.code : "error" }));
        }
        setToast(null);
      });
    } catch (e) {
      for (const b of before) patchLocal(kind, [b.id], { status: b.status, reviewedBy: b.reviewedBy, reviewedAt: b.reviewedAt, rejectReason: b.rejectReason });
      say(t("admin.toast.error", { error: e instanceof ApiError ? e.code : "error" }));
    }
  }

  async function markFull(item: Item, full: boolean) {
    patchLocal(item.kind, [item.id], { full });
    try {
      const r = await call<{ publishing: boolean }>("patch", { kind: item.kind, id: item.id, full });
      if (r.publishing) setQueue((q) => (q ? { ...q, deploy: { ...q.deploy, pending: true } } : q));
    } catch (e) {
      patchLocal(item.kind, [item.id], { full: !full });
      say(t("admin.toast.error", { error: e instanceof ApiError ? e.code : "error" }));
    }
  }

  async function saveNote(item: Item, adminNote: string): Promise<boolean> {
    try {
      await call("patch", { kind: item.kind, id: item.id, adminNote });
      patchLocal(item.kind, [item.id], { adminNote });
      return true;
    } catch (e) {
      say(t("admin.toast.error", { error: e instanceof ApiError ? e.code : "error" }));
      return false;
    }
  }

  async function merge(fromId: string, intoId: string): Promise<boolean> {
    try {
      await call("merge", { fromId, intoId });
      await load();
      return true;
    } catch (e) {
      say(t("admin.toast.error", { error: e instanceof ApiError ? e.code : "error" }));
      return false;
    }
  }

  async function addAdmin(address: string): Promise<string | null> {
    try {
      const r = await call<{ admins: AdminEntry[] }>("admin.add", { email: address });
      setQueue((q) => (q ? { ...q, admins: r.admins } : q));
      say(t("admin.admins.added", { email: address.toLowerCase() }));
      return null;
    } catch (e) {
      return e instanceof ApiError && e.code === "bad_request" ? t("admin.admins.invalid") : t("admin.toast.error", { error: e instanceof ApiError ? e.code : "error" });
    }
  }

  async function removeAdmin(address: string): Promise<string | null> {
    try {
      const r = await call<{ admins: AdminEntry[] }>("admin.remove", { email: address });
      setQueue((q) => (q ? { ...q, admins: r.admins } : q));
      say(t("admin.admins.removed", { email: address }));
      return null;
    } catch (e) {
      if (e instanceof ApiError && e.code === "forbidden") return t(e.detail.message === "owner" ? "admin.admins.cannotOwner" : e.detail.message === "owner_only" ? "admin.admins.ownerOnly" : "admin.admins.cannotSelf");
      return t("admin.toast.error", { error: e instanceof ApiError ? e.code : "error" });
    }
  }

  async function publishNow() {
    try {
      await call("deploy");
      setQueue((q) => (q ? { ...q, deploy: { ...q.deploy, pending: false, lastAt: Date.now() } } : q));
      say(t("admin.publish.started"));
    } catch {
      say(t("admin.publish.failed"));
    }
  }

  const waiting = queue ? { games: queue.games.filter((g) => g.status === "pending").length, gms: queue.gms.filter((g) => g.status === "pending").length } : { games: 0, gms: 0 };

  return (
    <div className="app-screen mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("admin.lead")}</p>
        </div>
        {signedIn && phase !== "signedOut" && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{t("admin.signedInAs", { email })}</span>
            <button type="button" className="btn-secondary" onClick={() => signOut()}><Icon name="sign-out-alt" /> {t("admin.signOut")}</button>
          </p>
        )}
      </div>

      {phase === "signedOut" && (
        <div className="mt-10">
          {expired && <div className="mb-6 max-w-xl"><Notice tone="warn">{t("admin.sessionExpired")}</Notice></div>}
          <EmailSignIn heading={t("admin.signInTitle")} lead={t("admin.signInBody")} />
        </div>
      )}
      {phase === "loading" && <p className="mt-10 text-center text-muted" role="status">{t("common.loading")}</p>}
      {phase === "forbidden" && (
        <div className="card mx-auto mt-10 max-w-lg p-8">
          <h2 className="text-xl font-bold">{t("admin.notAdminTitle")}</h2>
          <p className="mt-2 text-muted">{t("admin.notAdminBody", { email })}</p>
        </div>
      )}
      {phase === "error" && (
        <div className="mt-8 max-w-lg space-y-3">
          <Notice tone="danger">{t("admin.loadError", { error })}</Notice>
          <button type="button" className="btn-secondary" onClick={() => { setPhase("loading"); void load(); }}><Icon name="refresh" /> {t("admin.retry")}</button>
        </div>
      )}

      {phase === "ready" && queue && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border pb-3">
            <div role="tablist" aria-label={t("admin.title")} className="flex flex-wrap gap-2">
              {(["games", "gms", "admins"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={tab === k ? "btn-primary" : "btn-ghost"} data-testid={`tab-${k}`}>
                  {t(`admin.tab.${k}` as MsgKey)}
                  {k !== "admins" && waiting[k] > 0 && <span className="rounded-full bg-black/20 px-2 text-sm">{waiting[k]}</span>}
                </button>
              ))}
            </div>
            <PublishStatus deploy={queue.deploy} state={state} lang={lang} now={now} behind={siteBehind(builtAt, queue.deploy.lastAt, now)} onPublish={publishNow} onRefresh={() => void load()} />
          </div>
          {tab === "games" && <ReviewPane key="games" items={items.games} nowIso={queue.now} onReview={review} onFull={markFull} onNote={saveNote} onMerge={merge} />}
          {tab === "gms" && <ReviewPane key="gms" items={items.gms} nowIso={queue.now} onReview={review} onFull={markFull} onNote={saveNote} onMerge={merge} />}
          {tab === "admins" && <AdminsPane admins={queue.admins} owner={queue.owner} me={email} onAdd={addAdmin} onRemove={removeAdmin} />}
        </>
      )}

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6">
        {toast && (
          <div className="pointer-events-auto card flex items-center gap-3 px-4 py-3 shadow-xl" data-testid="toast">
            <span>{toast.text}</span>
            {toast.undo && <button type="button" className="btn-ghost" onClick={toast.undo}>{t("admin.undo")}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

/** One quiet line: where the public site is. Publishing is automatic; the button is only for an impatient admin. */
function PublishStatus({ deploy, state, lang, now, behind, onPublish, onRefresh }: { deploy: DeployInfo; state: PublishState; lang: "en" | "id"; now: number; behind: boolean; onPublish: () => void; onRefresh: () => void }) {
  const { t } = useI18n();
  const label = state === "waiting" ? t("admin.publish.pending") : state === "building" ? t("admin.publish.building") : t("admin.publish.live");
  const tone = state === "live" ? "text-success" : "text-gold";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:ml-auto" data-testid="publish-bar">
      <span className={`flex items-center gap-1.5 font-semibold ${tone}`} role="status"><Icon name={state === "live" ? "check-circle" : "refresh"} /> {label}</span>
      <span className="text-muted">{deploy.lastAt ? t("admin.publish.updated", { when: whenLabel(deploy.lastAt, lang, now) }) : t("admin.publish.never")}</span>
      {!deploy.configured && <span className="text-danger">{t("admin.publish.notConfigured")}</span>}
      {behind && deploy.lastAt && <span className="w-full font-semibold text-danger" role="status">{t("admin.publish.behind", { when: whenLabel(deploy.lastAt, lang, now) })}</span>}
      <button type="button" className="btn-ghost" disabled={!deploy.configured} onClick={onPublish} data-testid="publish-now"><Icon name="rocket-lunch" /> {t("admin.publish.now")}</button>
      <button type="button" className="btn-ghost" onClick={onRefresh}><Icon name="refresh" /> {t("admin.refresh")}</button>
    </div>
  );
}
