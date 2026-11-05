"use client";

import { useEffect, useRef, useState } from "react";
import { call, zonedParts } from "@/lib/account-api";
import { AREAS, SUMMARY_MAX, isArea } from "@/lib/areas";
import { CHARACTER_SOURCES, GENRES, MAX_GENRES, MAX_PER_GAME, MECHANICS, NEEDS, SAFETY_TOOLS, STYLES, characterLabelKey, genreLabelKey, isGenre, isSafetyTool, mechanicLabelKey, needLabelKey, safetyToolLabelKey, styleLabelKey } from "@/lib/categories";
import type { GameView } from "@/lib/games";
import { STEPS, firstStepWith, stepErrors, type GameFormValues } from "@/lib/game-steps";
import type { MsgKey, T } from "@/lib/i18n/core";
import { formatWhen } from "@/lib/format";
import { listingTips } from "@/lib/listing-tips";
import { OTHER_SYSTEM, SYSTEMS } from "@/lib/systems";
import { ZONES, type GameFormat, type GameLanguage, type GameRecord, type Lang, type Level, type LocationType, type Zone } from "@/lib/types";
import { useI18n } from "../i18n-provider";
import { SearchPicker } from "../search-picker";
import { GameCard, languageLabel, placesLabel, priceLabel } from "../ui";
import { Choice, Ticks } from "./choices";
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
const OFFSET_HOURS: Record<Zone, number> = { WIB: 7, WITA: 8, WIT: 9 };

/** The first session as an instant, or null while the date or time is not complete. */
function startOf(v: GameFormValues): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || !/^\d{2}:\d{2}$/.test(v.time)) return null;
  const at = Date.parse(`${v.date}T${v.time}:00Z`) - (OFFSET_HOURS[v.zone as Zone] ?? 7) * 3_600_000;
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

/** The answers as the card players will see (the same component the board uses), so the Game Master writes the notice while looking at it. */
function previewOf(v: GameFormValues, gmName: string, cover: string | null, t: T): GameView {
  const startsAt = startOf(v) ?? "2000-01-01T00:00:00.000Z";
  return {
    id: "preview", slug: "preview", gmId: "", gmName: gmName || "…", title: v.title.trim() || t("acct.preview.untitled"),
    system: (v.system === OTHER_SYSTEM ? v.otherSystem : v.system).trim() || t("acct.preview.noSystem"), summary: v.summary.trim(), description: v.description,
    format: (v.format || "one_shot") as GameFormat, locationType: (v.locationType || "online") as LocationType, platform: v.platform, city: v.cities[0] ?? "", cities: v.cities,
    venueName: v.venueName, venueMapsUrl: "", startsAt, zone: (v.zone || "WIB") as Zone, scheduleNote: v.scheduleNote, expiresAt: startsAt, priceIdr: Number(v.priceIdr) || 0, seats: Number(v.seats) || 0,
    language: (v.language || "id") as GameLanguage, level: (v.level || "any") as Level, minAge: Number(v.minAge) || 0, contentWarnings: v.contentWarnings, safetyTools: v.safetyTools,
    genres: v.genres, styles: v.styles, mechanics: v.mechanics, sessionHours: Number(v.sessionHours) || 0, characters: v.characters as GameView["characters"], needs: v.needs,
    safetyKeys: v.safetyKeys, noWarnings: v.noWarnings, onDemand: v.onDemand, cover, coverKey: v.coverKey, full: false, listedAt: startsAt, updatedAt: startsAt,
  };
}

/**
 * A game, new or one of the GM's own, written in five short steps (ADR-52, reworked in ADR-53) beside the notice it makes: on a wide screen the card players will
 * see stays next to the form and changes as they type; on a phone it comes at the last step. Next checks the step it leaves (src/lib/game-steps.ts); the last
 * step shows the answers by part with one way back to each, and posts. An error the server finds opens the step it belongs to. It goes live when saved.
 */
export function GameForm({ game, gmName, heading, onSaved, onCancel }: { game: GameRecord | null; gmName: string; heading: string; onSaved: (message: string) => void; onCancel: () => void }) {
  const { t, lang } = useI18n();
  const [v, setV] = useState<GameFormValues>(game ? valuesOf(game) : EMPTY);
  const [step, setStep] = useState(0);
  const [moved, setMoved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(""); // the picture just chosen, for the preview (a stored one is private until the game is live)
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const set = (patch: Partial<GameFormValues>) => setV((old) => ({ ...old, ...patch }));
  const err = (key: string) => field(errors, key, t);
  const last = STEPS.length - 1;

  // A new step starts at its own heading: in view, and where a screen reader is (not on the first paint).
  useEffect(() => {
    if (!moved) return;
    stepHeading.current?.focus({ preventScroll: true });
    stepHeading.current?.scrollIntoView({ block: "start" });
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
  const cover = picked || null;

  return (
    <div className="grid gap-[var(--space-xl)]" data-testid="game-form">
      <header className="flex flex-wrap items-end justify-between gap-[var(--space-md)] border-b border-rule pb-[var(--space-md)]">
        <h3 className="text-[length:var(--text-title)]">{heading}</h3>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t("acct.cancel")}</button>
      </header>

      {/* The five parts, drawn like the site's own navigation: the current one on a tinted rectangle; any of them can be opened again. */}
      <nav aria-label={t("acct.stepsLabel")}>
        <p className="text-sm text-muted sm:sr-only" data-testid="step-count">{t("acct.stepOf", { n: step + 1, total: STEPS.length })}</p>
        <ol className="flex flex-wrap gap-[var(--space-2xs)] max-sm:hidden">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => go(i)} aria-current={i === step ? "step" : undefined}
                className={`inline-flex min-h-11 items-center gap-[var(--space-xs)] rounded-[var(--radius-input)] px-[var(--space-sm)] ${i === step ? "bg-paper-3 font-medium text-ink" : i < step ? "text-ink hover:bg-paper-3" : "text-muted hover:bg-paper-3 hover:text-ink"}`}>
                <span aria-hidden className="tabular-nums">{i + 1}</span><span>{t(STEP_TITLE[s])}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-x-[var(--space-2xl)] gap-y-[var(--space-xl)] lg:grid-cols-[minmax(0,1fr)_17rem]">
        <form onSubmit={(e) => { e.preventDefault(); if (step === last) void save(); else next(); }} noValidate className="grid min-w-0 content-start gap-[var(--space-lg)]">
          <h4 ref={stepHeading} tabIndex={-1} className="scroll-mt-24 text-[length:var(--text-xl)] outline-none" data-testid="step-title">{t(STEP_TITLE[stepName])}</h4>

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
              <Ticks name="genres" legend={t("acct.f.genres")} counter={t("acct.f.pickCount", { n: v.genres.length, max: MAX_GENRES })} options={GENRES.map((g) => ({ value: g.key, label: t(genreLabelKey(g.key)) }))} selected={v.genres} max={MAX_GENRES} onChange={(genres) => set({ genres })} error={err("genres")} />
              <details open={v.styles.length + v.mechanics.length > 0}>
                <summary className="label flex min-h-11 cursor-pointer items-center">{t("acct.f.more")}</summary>
                <div className="mt-[var(--space-md)] grid gap-[var(--space-lg)]">
                  <Ticks name="styles" legend={t("acct.f.styles")} counter={t("acct.f.pickCount", { n: v.styles.length, max: MAX_PER_GAME })} options={STYLES.map((s) => ({ value: s.key, label: t(styleLabelKey(s.key)) }))} selected={v.styles} max={MAX_PER_GAME} onChange={(styles) => set({ styles })} />
                  <Ticks name="mechanics" legend={t("acct.f.mechanics")} counter={t("acct.f.pickCount", { n: v.mechanics.length, max: MAX_PER_GAME })} options={MECHANICS.map((m) => ({ value: m.key, label: t(mechanicLabelKey(m.key)) }))} selected={v.mechanics} max={MAX_PER_GAME} onChange={(mechanics) => set({ mechanics })} />
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
                  <Ticks name="cities" legend={t("acct.f.places")} hint={t("acct.f.placesHint")} columns={2} options={AREAS.map((a) => ({ value: a, label: a }))} selected={v.cities} onChange={(cities) => set({ cities })} error={err("cities") ?? err("city")} />
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
              <Choice name="characters" legend={t("acct.f.characters")} stacked options={[option("", "acct.f.charactersNone"), ...CHARACTER_SOURCES.map((c) => option(c, characterLabelKey(c)))]} value={v.characters} onChange={(characters) => set({ characters })} error={err("characters")} />
              <Ticks name="needs" legend={t("acct.f.needs")} hint={t("acct.f.needsHint")} columns={2} options={NEEDS.map((n) => ({ value: n.key, label: t(needLabelKey(n.key)) }))} selected={v.needs} onChange={(needs) => set({ needs })} error={err("needs")} />
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
              <Ticks name="safetyKeys" legend={t("acct.f.safetyTools")} hint={t("acct.f.safetyToolsHint")} columns={2} options={SAFETY_TOOLS.map((s) => ({ value: s.key, label: t(safetyToolLabelKey(s.key)) }))} selected={v.safetyKeys} onChange={(safetyKeys) => set({ safetyKeys })} error={err("safetyKeys") ?? err("safetyTools")} />
              <Field id="g-safety" label={t("acct.f.safety")} hint={t("acct.f.safetyHint")}>
                <input id="g-safety" className="input" value={v.safetyTools} maxLength={300} onChange={(e) => set({ safetyTools: e.target.value })} />
              </Field>
            </>
          )}

          {stepName === "review" && (
            <>
              <PictureField id="g-cover" kind="cover" value={v.coverKey} onChange={(coverKey) => set({ coverKey })} onPreview={setPicked} label={t("acct.f.cover")} hint={t("acct.f.coverHint")} error={err("coverKey")} />
              <Summary v={v} t={t} lang={lang} onChange={go} />
              <div>
                <Check id="g-consent" checked={v.consent} onChange={(consent) => set({ consent })}>{t("acct.f.consentGame")}</Check>
                {errors.consent && <p role="alert" className="text-sm font-medium text-danger">{errorText(t, errors.consent)}</p>}
              </div>
            </>
          )}

          {problem && <p role="alert" className="font-medium text-danger">{problem}</p>}

          {/* Back on the left; the step's one action on the right, saying where it leads. */}
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-md)] border-t border-rule pt-[var(--space-lg)]">
            <span>{step > 0 && <button type="button" className="btn btn-secondary" onClick={() => go(step - 1)}>{t("acct.back")}</button>}</span>
            {step < last
              ? <button type="submit" className="btn btn-primary" data-testid="step-next">{t("acct.nextTo", { step: t(STEP_TITLE[STEPS[step + 1]!]) })}</button>
              : <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t("acct.sending") : game ? t("acct.saveGame") : t("acct.postGame")}</button>}
          </div>
        </form>

        {/* The notice itself. Beside the form on a wide screen, all along; on a phone only at the last step, above the answers. */}
        <aside aria-labelledby="g-preview-h" className={`${stepName === "review" ? "max-lg:order-first" : "max-lg:hidden"} lg:sticky lg:top-24 lg:self-start`}>
          <h4 id="g-preview-h" className="label text-muted">{t("acct.preview.title")}</h4>
          <div className="mx-auto mt-[var(--space-sm)] max-w-64" data-testid="game-preview">
            <GameCard game={previewOf(v, gmName, cover, t)} t={t} lang={lang} preview whenOverride={v.onDemand || /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? undefined : t("acct.preview.noDate")} />
          </div>
          {tips.length > 0 && (
            <div className="mt-[var(--space-lg)]" data-testid="listing-tips">
              <p className="text-sm font-medium">{t("acct.tipsTitle")}</p>
              <ul className="mt-[var(--space-xs)] grid gap-[var(--space-xs)] text-sm text-ink-2">{tips.map((tip) => <li key={tip.id}>{t(tip.key)}</li>)}</ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** The answers by part, each part with one way back to its step. */
function Summary({ v, t, lang, onChange }: { v: GameFormValues; t: T; lang: Lang; onChange: (step: number) => void }) {
  const start = startOf(v);
  const when = v.onDemand ? t("game.onRequest") : start ? formatWhen(start, lang, (v.zone || "WIB") as Zone) : ""; // "Sat 21 Nov, 19.00 WIB", as the site writes it
  const where = v.locationType === "online" ? [t("loc.online"), v.platform].filter(Boolean).join(", ")
    : v.locationType === "in_person" ? [v.venueName, placesLabel({ city: v.cities[0] ?? "", cities: v.cities })].filter(Boolean).join(", ") : "";
  const parts: { step: number; rows: [string, string][] }[] = [
    { step: 0, rows: [[t("acct.f.title"), v.title], [t("acct.f.system"), v.system === OTHER_SYSTEM ? v.otherSystem : v.system], [t("acct.f.genres"), v.genres.filter(isGenre).map((g) => t(genreLabelKey(g))).join(", ")]] },
    { step: 1, rows: [[t("game.when"), when], [t("game.where"), where]] },
    { step: 2, rows: [[t("acct.f.price"), priceLabel(Number(v.priceIdr) || 0, t)], [t("acct.f.seats"), v.seats], [t("acct.f.language"), v.language ? languageLabel(v.language as GameLanguage, t) : ""]] },
    { step: 3, rows: [[t("acct.f.warnings"), v.noWarnings ? t("game.cwNone") : v.contentWarnings], [t("acct.f.safetyTools"), [...v.safetyKeys.filter(isSafetyTool).map((k) => t(safetyToolLabelKey(k))), v.safetyTools].filter(Boolean).join(", ")]] },
  ];
  return (
    <section aria-label={t("acct.summary")} className="grid gap-[var(--space-lg)]" data-testid="game-review" lang={lang}>
      {parts.map((part) => (
        <div key={part.step} className="border-t border-rule pt-[var(--space-sm)]">
          <div className="flex items-center justify-between gap-[var(--space-md)]">
            <p className="font-medium">{t(STEP_TITLE[STEPS[part.step]!])}</p>
            <button type="button" className="btn btn-ghost" onClick={() => onChange(part.step)} aria-label={`${t("acct.change")}: ${t(STEP_TITLE[STEPS[part.step]!])}`}>{t("acct.change")}</button>
          </div>
          <dl className="mt-[var(--space-xs)] grid gap-[var(--space-2xs)]">
            {part.rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-[var(--space-md)] max-[400px]:grid-cols-1">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="whitespace-pre-line break-words">{value || "–"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
