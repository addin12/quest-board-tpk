"use client";

import { useEffect, useRef, useState } from "react";
import { call, zonedParts } from "@/lib/account-api";
import { AREAS, SUMMARY_MAX, isArea } from "@/lib/areas";
import { CHARACTER_SOURCES, GENRES, MAX_GENRES, MAX_PER_GAME, MECHANICS, NEEDS, SAFETY_TOOLS, STYLES, characterLabelKey, genreLabelKey, isGenre, isSafetyTool, mechanicLabelKey, needLabelKey, safetyToolLabelKey, styleLabelKey } from "@/lib/categories";
import { STEPS, firstStepWith, stepErrors, type GameFormValues } from "@/lib/game-steps";
import type { MsgKey, T } from "@/lib/i18n/core";
import { listingTips } from "@/lib/listing-tips";
import { OTHER_SYSTEM, SYSTEMS } from "@/lib/systems";
import { ZONES, type GameRecord } from "@/lib/types";
import { useI18n } from "../i18n-provider";
import { SearchPicker } from "../search-picker";
import { Chips, Choice } from "./choices";
import { Check, Field, PictureField, errorText, field } from "./fields";

const EMPTY: GameFormValues = {
  title: "", system: "", otherSystem: "", summary: "", description: "", format: "", locationType: "", platform: "", cities: [], venueName: "", venueMapsRaw: "",
  onDemand: false, date: "", time: "19:00", zone: "WIB", scheduleNote: "", keepUntil: "", priceIdr: "0", seats: "5", language: "", level: "", minAge: "",
  contentWarnings: "", safetyTools: "", genres: [], styles: [], mechanics: [], coverKey: "", consent: false,
  sessionHours: "3", characters: "", needs: [], safetyKeys: [], noWarnings: false,
};

/** The form's answers for a game that exists. A "keep until" date shows only if the GM set one (the default is a day after the start). */
function valuesOf(g: GameRecord): GameFormValues {
  const start = zonedParts(g.startsAt, g.zone);
  const end = zonedParts(g.expiresAt, g.zone);
  const known = (SYSTEMS as readonly string[]).includes(g.system);
  return {
    title: g.title, system: known ? g.system : OTHER_SYSTEM, otherSystem: known ? "" : g.system, summary: g.summary, description: g.description, format: g.format, locationType: g.locationType,
    platform: g.platform, cities: (g.cities.length ? g.cities : g.city ? [g.city] : []).filter(isArea), venueName: g.venueName, venueMapsRaw: g.venueMapsRaw,
    onDemand: g.onDemand, date: g.onDemand ? "" : start.date, time: g.onDemand ? "19:00" : start.time, zone: g.zone, scheduleNote: g.scheduleNote,
    keepUntil: g.onDemand || Date.parse(g.expiresAt) - Date.parse(g.startsAt) === 86_400_000 ? "" : end.date, priceIdr: String(g.priceIdr), seats: String(g.seats), language: g.language, level: g.level,
    minAge: g.minAge ? String(g.minAge) : "", contentWarnings: g.contentWarnings, safetyTools: g.safetyTools, genres: g.genres, styles: g.styles, mechanics: g.mechanics, coverKey: g.coverId, consent: g.consent,
    sessionHours: g.sessionHours ? String(g.sessionHours) : "3", characters: g.characters, needs: g.needs, safetyKeys: g.safetyKeys, noWarnings: g.noWarnings,
  };
}

const STEP_TITLE: Record<(typeof STEPS)[number], MsgKey> = { game: "acct.step.game", when: "acct.step.when", players: "acct.step.players", safety: "acct.step.safety", review: "acct.step.review" };

/**
 * A game, new or one of the GM's own, as five short steps (ADR-52): the game, when and where, players, safety, then the picture and a last look. Next checks the
 * step it leaves (src/lib/game-steps.ts); Save sends everything, and an error the server finds opens the step it belongs to. It goes live when saved.
 */
export function GameForm({ game, onSaved, onCancel }: { game: GameRecord | null; onSaved: (message: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [v, setV] = useState<GameFormValues>(game ? valuesOf(game) : EMPTY);
  const [step, setStep] = useState(0);
  const [moved, setMoved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const set = (patch: Partial<GameFormValues>) => setV((old) => ({ ...old, ...patch }));
  const err = (key: string) => field(errors, key, t);
  const last = STEPS.length - 1;

  // A new step starts at its own heading: in view, and where a screen reader is (not on the first paint).
  useEffect(() => {
    if (!moved) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start" });
  }, [step, moved]);

  function go(to: number) {
    setMoved(true);
    setProblem("");
    setStep(to);
  }

  function next() {
    const found = stepErrors(v, step);
    setErrors(found);
    if (Object.keys(found).length) { setProblem(t("acct.err.fix")); return; }
    go(step + 1);
  }

  async function save() {
    for (let s = 0; s <= last; s++) {
      const found = stepErrors(v, s);
      if (Object.keys(found).length) { setErrors(found); go(s); setProblem(t("acct.err.fix")); return; }
    }
    setBusy(true);
    setProblem("");
    const body = { ...v, system: v.system === OTHER_SYSTEM ? OTHER_SYSTEM : v.system, priceIdr: v.priceIdr.trim(), seats: v.seats.trim(), minAge: v.minAge.trim(), sessionHours: v.sessionHours.trim(), keepUntil: v.onDemand ? "" : v.keepUntil };
    const r = game ? await call<{ changed: boolean; status?: string }>("PUT", `/games/${game.id}`, body) : await call<{ changed: boolean; status?: string }>("POST", "/games", body);
    setBusy(false);
    if (r.ok) {
      setErrors({});
      onSaved(t(!r.data.changed ? "acct.savedSame" : r.data.status === "pending" ? "acct.savedHeld" : "acct.saved")); // pending: the wording was held for an admin's look
    } else if (r.status === 422 && r.fields) {
      setErrors(r.fields);
      const at = firstStepWith(r.fields);
      if (at !== null) go(at);
      setProblem(t("acct.err.fix"));
    } else if (r.error === "no_profile") setProblem(t("acct.profileFirst"));
    else { setErrors({}); setProblem(errorText(t, r.error)); }
  }

  const option = (value: string, key: MsgKey) => ({ value, label: t(key) });
  const tips = listingTips(v);
  const stepName = STEPS[step]!;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-[var(--space-xl)]" data-testid="game-form">
      {/* Where you are: the five steps; any of them can be opened again. */}
      <nav aria-label={t("acct.stepsLabel")}>
        <p className="text-sm font-medium text-muted" data-testid="step-count">{t("acct.stepOf", { n: step + 1, total: STEPS.length })}</p>
        <ol className="mt-[var(--space-sm)] grid grid-cols-5 gap-[var(--space-xs)]">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => go(i)} aria-current={i === step ? "step" : undefined} aria-label={t(STEP_TITLE[s])} className="group grid min-h-11 w-full content-start gap-[var(--space-xs)] text-left">
                <span className={`block h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-[color-mix(in_oklab,var(--color-ink)_18%,var(--color-paper))]"}`} />
                <span className={`hidden text-sm sm:block ${i === step ? "font-medium text-ink" : "text-muted group-hover:text-ink"}`}>{t(STEP_TITLE[s])}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <form onSubmit={(e) => { e.preventDefault(); if (step === last) void save(); else next(); }} noValidate className="grid gap-[var(--space-lg)]">
        <h4 ref={heading} tabIndex={-1} className="scroll-mt-24 text-[length:var(--text-title)] outline-none" data-testid="step-title">{t(STEP_TITLE[stepName])}</h4>

        {stepName === "game" && (
          <>
            <Field id="g-title" label={t("acct.f.title")} error={err("title")}>
              <input id="g-title" className="input" value={v.title} maxLength={100} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field id="g-system" label={t("acct.f.system")} error={err("system")}>
              <SearchPicker id="g-system" value={v.system} options={SYSTEMS.map((s) => ({ value: s, label: s }))} other={{ value: OTHER_SYSTEM, label: OTHER_SYSTEM }} placeholder={t("acct.f.systemPlaceholder")} listLabel={t("acct.f.systemList")} onChange={(system) => set({ system })} invalid={!!err("system")} />
            </Field>
            {v.system === OTHER_SYSTEM && (
              <Field id="g-other" label={t("acct.f.otherSystem")}>
                <input id="g-other" className="input" value={v.otherSystem} maxLength={80} onChange={(e) => set({ otherSystem: e.target.value })} />
              </Field>
            )}
            <Field id="g-summary" label={t("acct.f.summary")} hint={`${t("acct.f.summaryHint", { n: SUMMARY_MAX })} (${v.summary.length}/${SUMMARY_MAX})`} error={err("summary")}>
              <input id="g-summary" className="input" value={v.summary} onChange={(e) => set({ summary: e.target.value })} aria-describedby="g-summary-hint" />
            </Field>
            <Field id="g-desc" label={t("acct.f.description")} hint={t("acct.f.descriptionHint")} error={err("description")}>
              <textarea id="g-desc" className="input min-h-40" value={v.description} maxLength={4000} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Chips name="genres" legend={t("acct.f.genres")} counter={t("acct.f.pickCount", { n: v.genres.length, max: MAX_GENRES })} options={GENRES.map((g) => ({ value: g.key, label: t(genreLabelKey(g.key)) }))} selected={v.genres} max={MAX_GENRES} onChange={(genres) => set({ genres })} error={err("genres")} />
            <details open={v.styles.length + v.mechanics.length > 0}>
              <summary className="label flex min-h-11 cursor-pointer items-center">{t("acct.f.more")}</summary>
              <div className="mt-[var(--space-md)] grid gap-[var(--space-lg)]">
                <Chips name="styles" legend={t("acct.f.styles")} counter={t("acct.f.pickCount", { n: v.styles.length, max: MAX_PER_GAME })} options={STYLES.map((s) => ({ value: s.key, label: t(styleLabelKey(s.key)) }))} selected={v.styles} max={MAX_PER_GAME} onChange={(styles) => set({ styles })} />
                <Chips name="mechanics" legend={t("acct.f.mechanics")} counter={t("acct.f.pickCount", { n: v.mechanics.length, max: MAX_PER_GAME })} options={MECHANICS.map((m) => ({ value: m.key, label: t(mechanicLabelKey(m.key)) }))} selected={v.mechanics} max={MAX_PER_GAME} onChange={(mechanics) => set({ mechanics })} />
              </div>
            </details>
          </>
        )}

        {stepName === "when" && (
          <>
            <Choice name="format" legend={t("acct.f.format")} options={[option("one_shot", "format.one_shot"), option("campaign", "format.campaign")]} value={v.format} onChange={(format) => set({ format })} error={err("format")} />
            <Choice name="mode" legend={t("acct.f.when")} options={[option("date", "acct.f.onDate"), option("request", "acct.f.onRequest")]} value={v.onDemand ? "request" : "date"} onChange={(m) => set({ onDemand: m === "request" })} hint={v.onDemand ? t("acct.f.onRequestHint") : undefined} />
            {!v.onDemand && (
              <>
                <div className="grid gap-[var(--space-lg)] sm:grid-cols-2">
                  <Field id="g-date" label={t("acct.f.date")} error={err("date")}>
                    <input id="g-date" className="input" type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} />
                  </Field>
                  <Field id="g-time" label={t("acct.f.time")}>
                    <input id="g-time" className="input" type="time" value={v.time} onChange={(e) => set({ time: e.target.value })} />
                  </Field>
                </div>
                <Choice name="zone" legend={t("acct.f.zone")} options={ZONES.map((z) => ({ value: z, label: z }))} value={v.zone} onChange={(zone) => set({ zone })} error={err("zone")} />
                <Field id="g-keep" label={t("acct.f.keepUntil")} hint={t("acct.f.keepUntilHint")} error={err("keepUntil")}>
                  <input id="g-keep" className="input" type="date" value={v.keepUntil} onChange={(e) => set({ keepUntil: e.target.value })} />
                </Field>
              </>
            )}
            <Field id="g-schedule" label={t("acct.f.schedule")} hint={t("acct.f.scheduleHint")} error={err("scheduleNote")}>
              <textarea id="g-schedule" className="input min-h-24" value={v.scheduleNote} maxLength={1000} onChange={(e) => set({ scheduleNote: e.target.value })} />
            </Field>
            <Choice name="locationType" legend={t("acct.f.where")} options={[option("online", "loc.online"), option("in_person", "loc.inPerson")]} value={v.locationType} onChange={(locationType) => set({ locationType })} error={err("locationType")} />
            {v.locationType === "online" && (
              <Field id="g-platform" label={t("acct.f.platform")} hint={t("acct.f.platformHint")} error={err("platform")}>
                <input id="g-platform" className="input" value={v.platform} maxLength={80} onChange={(e) => set({ platform: e.target.value })} />
              </Field>
            )}
            {v.locationType === "in_person" && (
              <>
                <Chips name="cities" legend={t("acct.f.places")} hint={t("acct.f.placesHint")} options={AREAS.map((a) => ({ value: a, label: a }))} selected={v.cities} onChange={(cities) => set({ cities })} error={err("cities") ?? err("city")} />
                <Field id="g-venue" label={t("acct.f.venue")} hint={t("acct.f.venueHint")} error={err("venueName")}>
                  <input id="g-venue" className="input" value={v.venueName} maxLength={80} onChange={(e) => set({ venueName: e.target.value })} />
                </Field>
                <Field id="g-maps" label={t("acct.f.maps")} hint={t("acct.f.mapsHint")} error={err("venueMapsRaw")}>
                  <input id="g-maps" className="input" type="url" inputMode="url" value={v.venueMapsRaw} onChange={(e) => set({ venueMapsRaw: e.target.value })} />
                </Field>
              </>
            )}
          </>
        )}

        {stepName === "players" && (
          <>
            <div className="grid gap-[var(--space-lg)] sm:grid-cols-3">
              <Field id="g-price" label={t("acct.f.price")} hint={t("acct.f.priceHint")} error={err("priceIdr")}>
                <input id="g-price" className="input" inputMode="numeric" value={v.priceIdr} onChange={(e) => set({ priceIdr: e.target.value })} />
              </Field>
              <Field id="g-seats" label={t("acct.f.seats")} error={err("seats")}>
                <input id="g-seats" className="input" inputMode="numeric" value={v.seats} onChange={(e) => set({ seats: e.target.value })} />
              </Field>
              <Field id="g-age" label={t("acct.f.minAge")} error={err("minAge")}>
                <input id="g-age" className="input" inputMode="numeric" value={v.minAge} onChange={(e) => set({ minAge: e.target.value })} />
              </Field>
            </div>
            <Choice name="language" legend={t("acct.f.language")} options={[option("id", "lang.gameId"), option("en", "lang.gameEn"), option("both", "lang.gameBoth")]} value={v.language} onChange={(language) => set({ language })} error={err("language")} />
            <Choice name="level" legend={t("acct.f.level")} options={[option("beginner", "level.beginner"), option("any", "level.any"), option("experienced", "level.experienced")]} value={v.level} onChange={(level) => set({ level })} error={err("level")} />
            <Choice name="sessionHours" legend={t("acct.f.sessionHours")} hint={t("acct.f.sessionHoursHint")} options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: t("common.hours", { n }) }))} value={v.sessionHours} onChange={(sessionHours) => set({ sessionHours })} error={err("sessionHours")} />
            <Choice name="characters" legend={t("acct.f.characters")} options={[option("", "acct.f.charactersNone"), ...CHARACTER_SOURCES.map((c) => option(c, characterLabelKey(c)))]} value={v.characters} onChange={(characters) => set({ characters })} error={err("characters")} />
            <Chips name="needs" legend={t("acct.f.needs")} hint={t("acct.f.needsHint")} options={NEEDS.map((n) => ({ value: n.key, label: t(needLabelKey(n.key)) }))} selected={v.needs} onChange={(needs) => set({ needs })} error={err("needs")} />
          </>
        )}

        {stepName === "safety" && (
          <>
            <div className="grid gap-[var(--space-xs)]">
              <Field id="g-warnings" label={t("acct.f.warnings")} hint={t("acct.f.warningsHint")} error={err("contentWarnings")}>
                <textarea id="g-warnings" className="input min-h-24" value={v.contentWarnings} maxLength={1000} disabled={v.noWarnings} onChange={(e) => set({ contentWarnings: e.target.value })} />
              </Field>
              <Check id="g-nowarnings" checked={v.noWarnings} onChange={(on) => set({ noWarnings: on, contentWarnings: on ? "" : v.contentWarnings })}>{t("acct.f.noWarnings")}</Check>
            </div>
            <Chips name="safetyKeys" legend={t("acct.f.safetyTools")} hint={t("acct.f.safetyToolsHint")} options={SAFETY_TOOLS.map((s) => ({ value: s.key, label: t(safetyToolLabelKey(s.key)) }))} selected={v.safetyKeys} onChange={(safetyKeys) => set({ safetyKeys })} error={err("safetyKeys") ?? err("safetyTools")} />
            <Field id="g-safety" label={t("acct.f.safety")} hint={t("acct.f.safetyHint")}>
              <input id="g-safety" className="input" value={v.safetyTools} maxLength={300} onChange={(e) => set({ safetyTools: e.target.value })} />
            </Field>
          </>
        )}

        {stepName === "review" && (
          <>
            <PictureField id="g-cover" kind="cover" value={v.coverKey} onChange={(coverKey) => set({ coverKey })} label={t("acct.f.cover")} hint={t("acct.f.coverHint")} error={err("coverKey")} />
            {tips.length > 0 && (
              <aside className="well" aria-labelledby="g-tips-h" data-testid="listing-tips">
                <h5 id="g-tips-h" className="text-[length:var(--text-lg)]">{t("acct.tipsTitle")}</h5>
                <ul className="mt-[var(--space-sm)] grid list-disc gap-[var(--space-xs)] ps-5 text-ink-2">{tips.map((tip) => <li key={tip.id}>{t(tip.key)}</li>)}</ul>
              </aside>
            )}
            <Review v={v} t={t} onEdit={go} />
            <div>
              <Check id="g-consent" checked={v.consent} onChange={(consent) => set({ consent })}>{t("acct.f.consentGame")}</Check>
              {errors.consent && <p role="alert" className="text-sm font-medium text-danger">{errorText(t, errors.consent)}</p>}
            </div>
          </>
        )}

        {problem && <p role="alert" className="font-medium text-danger">{problem}</p>}

        {/* Back and Cancel on the left; the one action of the step on the right. */}
        <div className="flex flex-wrap items-center justify-between gap-[var(--space-md)] border-t border-rule pt-[var(--space-lg)]">
          <div className="flex flex-wrap gap-[var(--space-sm)]">
            {step > 0 && <button type="button" className="btn btn-secondary" onClick={() => go(step - 1)}>{t("acct.back")}</button>}
            <button type="button" className="btn btn-ghost" onClick={onCancel}>{t("acct.cancel")}</button>
          </div>
          {step < last
            ? <button type="submit" className="btn btn-primary" data-testid="step-next">{t("acct.next")}</button>
            : <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t("acct.sending") : t("acct.saveGame")}</button>}
        </div>
      </form>
    </div>
  );
}

/** The last look before saving: the main answers, each with a way back to its step. */
function Review({ v, t, onEdit }: { v: GameFormValues; t: T; onEdit: (step: number) => void }) {
  const when = v.onDemand ? t("game.onRequest") : v.date ? `${v.date} ${v.time} ${v.zone}` : "–";
  const where = v.locationType === "online" ? [t("loc.online"), v.platform].filter(Boolean).join(", ") : v.locationType === "in_person" ? [v.venueName, v.cities.join(", ")].filter(Boolean).join(", ") : "";
  const rows: [string, string, number][] = [
    [t("acct.f.title"), v.title || "–", 0],
    [t("acct.f.system"), (v.system === OTHER_SYSTEM ? v.otherSystem : v.system) || "–", 0],
    [t("acct.f.genres"), v.genres.filter(isGenre).map((g) => t(genreLabelKey(g))).join(", ") || "–", 0],
    [t("game.when"), when, 1],
    [t("game.where"), where || "–", 1],
    [t("acct.f.price"), v.priceIdr.trim() === "0" ? t("common.free") : `Rp ${v.priceIdr.trim()}`, 2],
    [t("acct.f.seats"), v.seats, 2],
    [t("acct.f.warnings"), v.noWarnings ? t("game.cwNone") : v.contentWarnings || "–", 3],
    [t("acct.f.safetyTools"), [...v.safetyKeys.filter(isSafetyTool).map((k) => t(safetyToolLabelKey(k))), v.safetyTools].filter(Boolean).join(", ") || "–", 3],
  ];
  return (
    <section aria-labelledby="g-review-h" className="grid gap-[var(--space-sm)]" data-testid="game-review">
      <h5 id="g-review-h" className="text-[length:var(--text-lg)]">{t("acct.review")}</h5>
      <dl className="ruled">
        {rows.map(([label, value, at]) => (
          <div key={label} className="flex flex-wrap items-center justify-between gap-x-[var(--space-md)] py-[var(--space-sm)]">
            <dt className="w-36 shrink-0 text-sm text-muted">{label}</dt>
            <dd className="min-w-0 flex-1 whitespace-pre-line break-words">{value}</dd>
            <button type="button" className="btn btn-ghost" onClick={() => onEdit(at)} aria-label={`${t("acct.edit")}: ${label}`}>{t("acct.edit")}</button>
          </div>
        ))}
      </dl>
    </section>
  );
}
