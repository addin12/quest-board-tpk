"use client";

import { useEffect, useMemo, useState } from "react";
import { REASONS, canApprove, countByStatus, filterItems, previewGame, reasonText, titleOf, type Item, type Reason } from "@/lib/admin-view";
import { contactMessage, waLink } from "@/lib/contact";
import { makeT } from "@/lib/i18n/dict";
import { formatWhen } from "@/lib/format";
import { adminPictureUrl } from "@/lib/pictures";
import { STATUSES, type GameRecord, type GmRecord, type Lang, type Status } from "@/lib/types";
import type { MsgKey, T } from "@/lib/i18n/core";
import { genreIcon, genreLabelKey, isGenre, isStyle, styleIcon, styleLabelKey } from "@/lib/categories";
import { Icon } from "../icon";
import { useI18n } from "../i18n-provider";
import { Avatar, Cover, GameCard, languageLabel, priceLabel, whereLabel } from "../ui";
import type { Check } from "@/lib/checks";


type Opts = { reason?: string; notify: boolean };
type Props = {
  items: Item[];
  nowIso: string;
  onReview: (items: Item[], status: Status, opts: Opts) => void;
  onFeature: (item: Item, featured: boolean) => void;
  onFull: (item: Item, full: boolean) => void;
  onNote: (item: Item, note: string) => Promise<boolean>;
  onMerge: (fromId: string, intoId: string) => Promise<boolean>;
};

const levelIcon = { error: "cross-circle", warn: "triangle-warning", info: "info" } as const;
const levelClass = { error: "text-danger", warn: "text-gold", info: "text-muted" } as const;

/** The list of submissions (by status, searchable) beside the one being reviewed. */
export function ReviewPane({ items, nowIso, onReview, onFeature, onFull, onNote, onMerge }: Props) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<Status>("pending");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [rejecting, setRejecting] = useState(false);

  const counts = useMemo(() => countByStatus(items), [items]);
  const list = useMemo(() => filterItems(items, status, q), [items, status, q]);
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const picked = list.filter((i) => checked.includes(i.id) && canApprove(i));

  function select(id: string | null) {
    setSelectedId(id);
    setRejecting(false);
  }

  /** After a decision on the open item, open the next one in the list. */
  function advance() {
    const at = list.findIndex((i) => i.id === selectedId);
    select((list[at + 1] ?? list[at - 1])?.id ?? null);
  }

  function decide(item: Item, next: Status, reason?: string) {
    onReview([item], next, { reason, notify: notify && (next === "approved" || next === "rejected") });
    advance();
  }

  // Keyboard: J and K move through the list, A approves, R opens the reject form. Never while typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return;
      const at = list.findIndex((i) => i.id === selectedId);
      if (e.key === "j") select((list[at + 1] ?? list[0])?.id ?? null);
      else if (e.key === "k") select((list[at - 1] ?? list[list.length - 1])?.id ?? null);
      else if (e.key === "a" && selected && selected.rec.status !== "approved" && canApprove(selected)) decide(selected, "approved");
      else if (e.key === "r" && selected && selected.rec.status !== "rejected") setRejecting(true);
      else if (e.key === "Escape") setRejecting(false);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mt-5">
      <div role="tablist" aria-label={t("admin.title")} className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => { setStatus(s); setChecked([]); }} className={status === s ? "btn-primary" : "btn-secondary"} data-testid={`status-${s}`}>
            {t(`admin.status.${s}` as MsgKey)} <span className="rounded-full bg-black/15 px-2 text-sm">{counts[s]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className={selected ? "max-lg:hidden" : ""}>
          <label htmlFor="admin-q" className="label">{t("admin.search")}</label>
          <input id="admin-q" type="search" className="input" value={q} placeholder={t("admin.searchPlaceholder")} onChange={(e) => setQ(e.target.value)} />

          {picked.length > 0 && (
            <div className="card mt-3 flex flex-wrap items-center gap-2 p-3">
              <button type="button" className="btn-primary" onClick={() => { onReview(picked, "approved", { notify }); setChecked([]); }} data-testid="bulk-approve"><Icon name="check" /> {t("admin.bulkApprove", { n: picked.length })}</button>
              <button type="button" className="btn-ghost" onClick={() => setChecked([])}>{t("admin.bulkClear")}</button>
            </div>
          )}

          {list.length === 0 ? (
            <p className="card mt-3 p-6 text-center text-muted">{t(status === "pending" ? "admin.emptyPending" : "admin.emptyList")}</p>
          ) : (
            <ul className="mt-3 space-y-2" data-testid="admin-list">
              {list.map((i) => <Row key={i.id} item={i} selected={i.id === selectedId} checkbox={status === "pending"} checked={checked.includes(i.id)} lang={lang} onSelect={() => select(i.id)} onCheck={(on) => setChecked(on ? [...checked, i.id] : checked.filter((x) => x !== i.id))} />)}
            </ul>
          )}
          <p className="mt-4 hidden text-xs text-muted lg:block">{t("admin.shortcuts")}</p>
        </div>

        <div className={!selected ? "max-lg:hidden" : ""}>
          {selected ? (
            <Detail key={selected.id} item={selected} nowIso={nowIso} lang={lang} notify={notify} setNotify={setNotify} rejecting={rejecting} setRejecting={setRejecting}
              onBack={() => select(null)} onDecide={(next, reason) => decide(selected, next, reason)} onFeature={(f) => onFeature(selected, f)} onFull={(v) => onFull(selected, v)} onNote={(n) => onNote(selected, n)} onMerge={(from, into) => onMerge(from, into)} />
          ) : (
            <p className="card hidden p-10 text-center text-muted lg:block">{t("admin.pick")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ item, selected, checkbox, checked, lang, onSelect, onCheck }: { item: Item; selected: boolean; checkbox: boolean; checked: boolean; lang: Lang; onSelect: () => void; onCheck: (on: boolean) => void }) {
  const { t } = useI18n();
  const errors = item.checks.filter((c) => c.level === "error").length;
  const warns = item.checks.filter((c) => c.level === "warn").length;
  const title = titleOf(item) || t("admin.unnamed");
  const sub = item.kind === "game" ? [item.rec.system, item.gm?.name ?? t("admin.noGm")].filter(Boolean).join(" · ") : [item.rec.city, item.rec.email].filter(Boolean).join(" · ");
  return (
    <li className="flex items-stretch gap-2">
      {checkbox && (
        <label className="flex w-11 shrink-0 items-center justify-center">
          <input type="checkbox" className="size-5 accent-accent" checked={checked} disabled={!canApprove(item)} onChange={(e) => onCheck(e.target.checked)} aria-label={t("admin.select", { title })} />
        </label>
      )}
      <button type="button" onClick={onSelect} aria-current={selected ? "true" : undefined} className={`card flex min-w-0 flex-1 items-center gap-3 p-3 text-left transition-colors hover:border-accent/50 ${selected ? "border-accent! bg-accent-soft" : ""}`} data-testid="admin-row">
        {item.kind === "game" ? (
          <Cover src={item.rec.coverId ? adminPictureUrl(item.rec.coverId) : null} seed={title} className="aspect-[4/5] w-11 shrink-0 rounded-md" sizes="44px" />
        ) : (
          <Avatar name={title} photo={item.rec.photoId ? adminPictureUrl(item.rec.photoId) : null} size={44} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block truncate text-sm text-muted">{sub}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted">{formatWhen(item.rec.submittedAt || new Date().toISOString(), lang, "WIB")}</span>
            {errors > 0 && <span className="rounded bg-danger-soft px-1.5 py-0.5 font-semibold text-danger">{t("admin.level.error")}: {errors}</span>}
            {warns > 0 && <span className="rounded bg-accent-soft px-1.5 py-0.5 font-semibold text-text">{t("admin.level.warn")}: {warns}</span>}
            {item.rec.featured && <Icon name="star" solid className="text-gold" label={t("game.featured")} />}
          </span>
        </span>
      </button>
    </li>
  );
}

function checkText(c: Check, t: T): string {
  const vars = { ...(c.vars ?? {}) };
  if (typeof vars.signals === "string") vars.signals = vars.signals.split(",").map((s) => t(`check.signal.${s}` as MsgKey)).join(", ");
  return t(c.key, vars);
}

function Detail({ item, nowIso, lang, notify, setNotify, rejecting, setRejecting, onBack, onDecide, onFeature, onFull, onNote, onMerge }: {
  item: Item; nowIso: string; lang: Lang; notify: boolean; setNotify: (v: boolean) => void; rejecting: boolean; setRejecting: (v: boolean) => void;
  onBack: () => void; onDecide: (status: Status, reason?: string) => void; onFeature: (featured: boolean) => void; onFull: (full: boolean) => void; onNote: (note: string) => Promise<boolean>; onMerge: (fromId: string, intoId: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const rec = item.rec;
  const title = titleOf(item) || t("admin.unnamed");
  const blocked = !canApprove(item);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [reasonNote, setReasonNote] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [note, setNote] = useState(rec.adminNote);
  const [noteSaved, setNoteSaved] = useState(false);
  const gm = item.kind === "game" ? item.gm : item.rec;

  const reject = () => onDecide("rejected", reasonText(reasons, reasonNote, makeT("en"), makeT("id")));

  return (
    <article className="card p-5 sm:p-6" aria-labelledby="detail-h" data-testid="admin-detail">
      <button type="button" className="btn-ghost -ml-2 mb-2 lg:hidden" onClick={onBack}><Icon name="arrow-left" /> {t("admin.back")}</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="detail-h" className="text-2xl font-bold leading-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted">{t("admin.submitted", { date: formatWhen(rec.submittedAt || nowIso, lang, "WIB") })} · {t("admin.by", { email: rec.email })}</p>
          {rec.reviewedAt && rec.status !== "pending" && <p className="text-sm text-muted">{t("admin.reviewed", { status: t(`admin.status.${rec.status}` as MsgKey), email: rec.reviewedBy, date: formatWhen(rec.reviewedAt, lang, "WIB") })}</p>}
          {rec.status === "rejected" && rec.rejectReason && <p className="mt-1 text-sm">{rec.rejectReason}</p>}
        </div>
        <span className={`chip ${rec.status === "approved" ? "border-success/40! bg-success-soft! text-ink!" : rec.status === "rejected" ? "border-danger/40! bg-danger-soft! text-ink!" : ""}`} data-testid="detail-status">{t(`admin.status.${rec.status}` as MsgKey)}</span>
      </div>

      <section className="mt-5" aria-labelledby="checks-h">
        <h3 id="checks-h" className="text-base font-bold text-ink-2">{t("admin.checksTitle")}</h3>
        {item.checks.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-success"><Icon name="check-circle" /> {t("admin.checksOk")}</p>
        ) : (
          <ul className="mt-2 space-y-1.5" data-testid="admin-checks">
            {item.checks.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <Icon name={levelIcon[c.level]} className={`mt-1 shrink-0 ${levelClass[c.level]}`} />
                <span><span className={`font-semibold ${levelClass[c.level]}`}>{t(`admin.level.${c.level}` as MsgKey)}:</span> {checkText(c, t)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5 rounded-lg border border-border bg-surface-2 p-4" aria-label={t("admin.title")}>
        {rejecting ? (
          <div data-testid="reject-form">
            <h3 className="font-semibold">{t("admin.rejectTitle")}</h3>
            <div className="mt-2 space-y-1">
              {REASONS.map((r) => (
                <label key={r} className="flex min-h-11 items-center gap-2.5">
                  <input type="checkbox" className="size-5 accent-accent" checked={reasons.includes(r)} onChange={(e) => setReasons(e.target.checked ? [...reasons, r] : reasons.filter((x) => x !== r))} />
                  {t(`admin.reason.${r}` as MsgKey)}
                </label>
              ))}
            </div>
            <label htmlFor="reason-note" className="label mt-3">{t("admin.reasonNote")}</label>
            <textarea id="reason-note" rows={3} className="input" value={reasonNote} maxLength={400} onChange={(e) => setReasonNote(e.target.value)} />
            <label className="mt-3 flex min-h-11 items-center gap-2.5 text-sm font-semibold"><input type="checkbox" className="size-5 accent-accent" checked={notify} onChange={(e) => setNotify(e.target.checked)} />{t("admin.notifyGm")}</label>
            <p className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn-danger" disabled={reasons.length === 0 && !reasonNote.trim()} onClick={reject} data-testid="reject-confirm"><Icon name="cross-circle" /> {t("admin.rejectConfirm")}</button>
              <button type="button" className="btn-ghost" onClick={() => setRejecting(false)}>{t("admin.cancel")}</button>
            </p>
          </div>
        ) : (
          <div>
            <p className="flex flex-wrap items-center gap-2">
              {rec.status !== "approved" && <button type="button" className="btn-primary" disabled={blocked} onClick={() => onDecide("approved")} data-testid="approve"><Icon name="check" /> {t("admin.approve")}</button>}
              {rec.status !== "rejected" && <button type="button" className="btn-secondary" onClick={() => setRejecting(true)} data-testid="reject"><Icon name="cross-circle" /> {t("admin.reject")}</button>}
              {rec.status !== "pending" && <button type="button" className="btn-ghost" onClick={() => onDecide("pending")}><Icon name="undo" /> {t("admin.toPending")}</button>}
              {item.kind === "game" && rec.status === "approved" && (
                <button type="button" className="btn-secondary" aria-pressed={rec.featured} onClick={() => onFeature(!rec.featured)}><Icon name="star" solid={rec.featured} /> {t(rec.featured ? "admin.unfeature" : "admin.feature")}</button>
              )}
              {item.kind === "game" && rec.status === "approved" && (
                <button type="button" className="btn-secondary" aria-pressed={rec.full} onClick={() => onFull(!rec.full)} data-testid="toggle-full">{t(rec.full ? "admin.reopen" : "admin.markFull")}</button>
              )}
            </p>
            {blocked && rec.status !== "approved" && <p className="mt-2 text-sm text-danger">{t("admin.approveBlocked")}</p>}
            <label className="mt-3 flex min-h-11 items-center gap-2.5 text-sm font-semibold"><input type="checkbox" className="size-5 accent-accent" checked={notify} onChange={(e) => setNotify(e.target.checked)} data-testid="notify" />{t("admin.notifyGm")}</label>
          </div>
        )}
      </section>

      <section className="mt-6" aria-labelledby="preview-h">
        <h3 id="preview-h" className="text-base font-bold text-ink-2">{t("admin.previewTitle")}</h3>
        {item.kind === "game" ? (
          <div className="mt-3 grid gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
            <div className="max-w-xs"><GameCard game={previewGame(item.rec, item.gm, nowIso)} t={t} lang={lang} preview /></div>
            <GameDetails rec={item.rec} t={t} lang={lang} />
          </div>
        ) : (
          <GmDetails rec={item.rec} t={t} />
        )}
      </section>

      <section className="mt-6" aria-labelledby="contact-h">
        <h3 id="contact-h" className="text-base font-bold text-ink-2">{t("admin.contactTitle")}</h3>
        {gm ? (
          <div className="mt-2 space-y-1.5">
            {item.kind === "game" && <p className="font-semibold">{t("admin.gmOf", { name: gm.name })}</p>}
            <p className="flex flex-wrap items-center gap-3">
              <span className="tabular-nums">{gm.whatsapp ? `+${gm.whatsapp}` : "–"}</span>
              {gm.whatsapp && <a href={waLink(gm.whatsapp, contactMessage({ name: gm.name }, null, lang))} target="_blank" rel="noopener noreferrer" className="btn-secondary"><Icon name="whatsapp" brand /> {t("admin.testWhatsapp")}</a>}
            </p>
            {gm.discord && <p className="flex items-center gap-2"><Icon name="discord" brand /> <span className="tabular-nums">{gm.discord}</span></p>}
          </div>
        ) : (
          <p className="mt-2 text-muted">{t("admin.noGm")}</p>
        )}
        <p className="mt-2 text-sm"><span className="text-muted">{t("admin.emailLabel")}:</span> <a className="break-all underline" href={`mailto:${rec.email}`}>{rec.email}</a></p>
      </section>

      {item.kind === "gm" && (item.rec as GmRecord).sharesPhoneIds?.length ? (
        <section className="mt-6" aria-labelledby="merge-h" data-testid="merge-box">
          <h3 id="merge-h" className="text-base font-bold text-ink-2">{t("admin.mergeTitle")}</h3>
          <ul className="mt-2 space-y-2">
            {(item.rec as GmRecord).sharesPhoneIds!.map((otherId, i) => {
              const name = (item.rec as GmRecord).sharesPhoneWith![i] ?? otherId;
              return (
                <li key={otherId} className="flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-secondary" onClick={() => { if (confirmId === otherId) void onMerge(item.id, otherId); else setConfirmId(otherId); }}>
                    {confirmId === otherId ? t("admin.mergeConfirm", { name }) : t("admin.merge", { name })}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="note-h">
        <h3 id="note-h" className="sr-only">{t("admin.noteLabel")}</h3>
        <label htmlFor="admin-note" className="label">{t("admin.noteLabel")}</label>
        <textarea id="admin-note" rows={2} className="input" value={note} maxLength={1000} onChange={(e) => { setNote(e.target.value); setNoteSaved(false); }} />
        <p className="mt-2 flex items-center gap-3">
          <button type="button" className="btn-secondary" disabled={note === rec.adminNote && !noteSaved} onClick={async () => setNoteSaved(await onNote(note))}>{t("admin.noteSave")}</button>
          <span role="status" className="text-sm font-semibold text-success">{noteSaved ? t("admin.noteSaved") : ""}</span>
        </p>
      </section>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3"><dt className="w-28 shrink-0 text-sm font-semibold text-muted">{label}</dt><dd className="min-w-0 whitespace-pre-line break-words">{children}</dd></div>;
}

function GameDetails({ rec, t, lang }: { rec: GameRecord; t: T; lang: Lang }) {
  return (
    <dl className="space-y-2 text-sm" data-testid="game-details">
      <Field label={t("game.when")}>{rec.startsAt ? formatWhen(rec.startsAt, lang, rec.zone) : "–"}</Field>
      <Field label={t("game.where")}>{whereLabel(rec, t) || "–"}{rec.venueMapsUrl && <> · <a className="underline" href={rec.venueMapsUrl} target="_blank" rel="noopener noreferrer">{t("game.openMaps")}</a></>}</Field>
      <Field label={t("game.format")}>{t(rec.format === "campaign" ? "format.campaign" : "format.one_shot")} · {t("common.seats", { n: rec.seats })}</Field>
      <Field label={t("game.price")}>{priceLabel(rec.priceIdr, t)}</Field>
      <Field label={t("game.language")}>{languageLabel(rec.language, t)} · {t(rec.level === "beginner" ? "level.beginner" : rec.level === "experienced" ? "level.experienced" : "level.any")}{rec.minAge > 0 && <> · {t("game.ages", { n: rec.minAge })}</>}</Field>
      {(rec.genres.length > 0 || rec.styles.length > 0) && (
        <Field label={t("games.genre")}>
          <span className="flex flex-wrap gap-1.5">
            {rec.genres.filter(isGenre).map((g) => <span key={g} className="chip"><Icon name={genreIcon(g)} />{t(genreLabelKey(g))}</span>)}
            {rec.styles.filter(isStyle).map((s) => <span key={s} className="chip"><Icon name={styleIcon(s)} />{t(styleLabelKey(s))}</span>)}
          </span>
        </Field>
      )}
      <Field label={t("game.about")}>{rec.description || "–"}</Field>
      {rec.scheduleNote && <Field label={t("game.schedule")}>{rec.scheduleNote}</Field>}
      <Field label={t("game.cw")}>{rec.contentWarnings || t("game.cwNone")}</Field>
      <Field label={t("game.safety")}>{rec.safetyTools || t("game.safetyNone")}</Field>
      {rec.expiresAt && <Field label={t("admin.whenUntil")}>{formatWhen(rec.expiresAt, lang, rec.zone)}</Field>}
    </dl>
  );
}

function GmDetails({ rec, t }: { rec: GmRecord; t: T }) {
  return (
    <div className="mt-3 flex flex-col gap-4 sm:flex-row">
      <Avatar name={rec.name || "?"} photo={rec.photoId ? adminPictureUrl(rec.photoId) : null} size={96} />
      <dl className="min-w-0 flex-1 space-y-2 text-sm" data-testid="gm-details">
        <Field label={t("gm.title")}>{rec.name || "–"}</Field>
        <Field label={t("games.city")}>{rec.city || "–"}</Field>
        <Field label={t("gm.systems")}>{rec.systems.join(", ") || "–"}</Field>
        <Field label={t("game.about")}>{rec.bio || "–"}</Field>
      </dl>
    </div>
  );
}
