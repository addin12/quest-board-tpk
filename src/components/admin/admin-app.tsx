"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, adminConfigured, api, readToken, signOutGoogle, storeToken, storedToken } from "@/lib/admin-api";
import { buildItems, siteBehind, titleOf, whenLabel, type Item } from "@/lib/admin-view";
import type { MsgKey } from "@/lib/i18n/core";
import type { AdminEntry, AdminFields, DeployInfo, QueueResponse, Status } from "@/lib/types";
import { Icon } from "../icon";
import { useI18n } from "../i18n-provider";
import { Notice } from "../ui";
import { AdminsPane } from "./admins-pane";
import { ReviewPane } from "./review-pane";
import { SignIn } from "./sign-in";

type Phase = "init" | "signedOut" | "loading" | "forbidden" | "ready" | "error";
type Toast = { id: number; text: string; undo?: () => void };
type Tab = "games" | "gms" | "admins";

/**
 * The curation page. It signs in with Google, loads the queue from the Sheet's script, and sends each decision back
 * (the change shows at once and is undone if the script refuses). Nothing is stored in this browser except the
 * sign-in token, for as long as the tab is open.
 */
export function AdminApp({ builtAt }: { builtAt: string }) {
  const { t, lang } = useI18n();
  const [phase, setPhase] = useState<Phase>("init");
  const [token, setToken] = useState<string | null>(null);
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
    storeToken(null);
    signOutGoogle();
    setToken(null);
    setQueue(null);
    setExpired(wasExpired);
    setPhase("signedOut");
  }, []);

  const call = useCallback(async <T,>(action: string, body: Record<string, unknown> = {}): Promise<T> => {
    try {
      return await api<T>(token ?? "", action, body);
    } catch (e) {
      if (e instanceof ApiError && e.code === "unauthorized") signOut(true);
      throw e;
    }
  }, [token, signOut]);

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

  // First load: a token from this tab's earlier sign-in, if it is still valid.
  useEffect(() => {
    const stored = storedToken();
    if (stored && adminConfigured()) {
      setToken(stored); // eslint-disable-line react-hooks/set-state-in-effect -- sessionStorage is only readable in the browser
      setEmail(readToken(stored)?.email ?? "");
      setPhase("loading");
    } else setPhase("signedOut");
  }, []);

  useEffect(() => {
    if (token) void load(); // eslint-disable-line react-hooks/set-state-in-effect -- loads the queue once signed in
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the token changes
  }, [token]);

  // Fresh data every minute while the tab is on screen (a GM may have submitted, another admin may have decided).
  useEffect(() => {
    if (phase !== "ready") return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    return () => window.clearInterval(id);
  }, [phase, load]);

  const onToken = useCallback((credential: string) => {
    storeToken(credential);
    setEmail(readToken(credential)?.email ?? "");
    setExpired(false);
    setPhase("loading");
    setToken(credential);
  }, []);

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
      const r = await call<{ publishing: boolean }>("review", { kind, ids, status, reason: opts.reason ?? "", notify: opts.notify });
      if (r.publishing) setQueue((q) => (q ? { ...q, deploy: { ...q.deploy, pending: true } } : q));
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

  async function feature(item: Item, featured: boolean) {
    patchLocal(item.kind, [item.id], { featured });
    try {
      const r = await call<{ publishing: boolean }>("patch", { kind: item.kind, id: item.id, featured });
      if (r.publishing) setQueue((q) => (q ? { ...q, deploy: { ...q.deploy, pending: true } } : q));
    } catch (e) {
      patchLocal(item.kind, [item.id], { featured: !featured });
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
      if (e instanceof ApiError && e.code === "forbidden") return t(e.detail.message === "owner" ? "admin.admins.cannotOwner" : "admin.admins.cannotSelf");
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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("admin.lead")}</p>
        </div>
        {token && phase !== "signedOut" && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{t("admin.signedInAs", { email })}</span>
            <button type="button" className="btn-secondary" onClick={() => signOut()}><Icon name="sign-out-alt" /> {t("admin.signOut")}</button>
          </p>
        )}
      </div>

      {!adminConfigured() && <div className="mt-6"><Notice tone="warn">{t("admin.notConfigured")}</Notice></div>}
      {adminConfigured() && phase === "signedOut" && <SignIn expired={expired} onToken={onToken} />}
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
          <PublishBar deploy={queue.deploy} lang={lang} now={now} behind={siteBehind(builtAt, queue.deploy.lastAt, now)} onPublish={publishNow} />
          <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <div role="tablist" aria-label={t("admin.title")} className="flex flex-wrap gap-2">
              {(["games", "gms", "admins"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={tab === k ? "btn-primary" : "btn-ghost"} data-testid={`tab-${k}`}>
                  {t(`admin.tab.${k}` as MsgKey)}
                  {k !== "admins" && waiting[k] > 0 && <span className="rounded-full bg-black/20 px-2 text-sm">{waiting[k]}</span>}
                </button>
              ))}
            </div>
            <button type="button" className="btn-ghost ml-auto" onClick={() => void load()}><Icon name="refresh" /> {t("admin.refresh")}</button>
          </div>
          {tab === "games" && <ReviewPane key="games" items={items.games} nowIso={queue.now} onReview={review} onFeature={feature} onFull={markFull} onNote={saveNote} />}
          {tab === "gms" && <ReviewPane key="gms" items={items.gms} nowIso={queue.now} onReview={review} onFeature={feature} onFull={markFull} onNote={saveNote} />}
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

function PublishBar({ deploy, lang, now, behind, onPublish }: { deploy: DeployInfo; lang: "en" | "id"; now: number; behind: boolean; onPublish: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-testid="publish-bar">
      <span className="font-semibold"><Icon name="globe" /> {t("admin.publish.title")}</span>
      <span className="text-sm text-muted">{deploy.lastAt ? t("admin.publish.updated", { when: whenLabel(deploy.lastAt, lang, now) }) : t("admin.publish.never")}</span>
      {deploy.pending && <span className="text-sm font-semibold text-gold">{t("admin.publish.pending")}</span>}
      {!deploy.configured && <span className="text-sm text-danger">{t("admin.publish.notConfigured")}</span>}
      {behind && deploy.lastAt && <span className="w-full text-sm font-semibold text-danger" role="status">{t("admin.publish.behind", { when: whenLabel(deploy.lastAt, lang, now) })}</span>}
      <button type="button" className="btn-secondary ml-auto" disabled={!deploy.configured} onClick={onPublish} data-testid="publish-now"><Icon name="rocket-lunch" /> {t("admin.publish.now")}</button>
    </div>
  );
}
