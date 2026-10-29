"use client";

import { useState } from "react";
import { call, zonedParts } from "@/lib/account-api";
import { AREAS, SUMMARY_MAX } from "@/lib/areas";
import { GENRES, MAX_PER_GAME, STYLES, genreLabelKey, styleLabelKey } from "@/lib/categories";
import { OTHER_SYSTEM, SYSTEMS } from "@/lib/systems";
import { ZONES, type GameRecord } from "@/lib/types";
import { useI18n } from "../i18n-provider";
import { Check, Field, PictureField, errorText, field } from "./fields";

type Values = {
  title: string; system: string; otherSystem: string; summary: string; description: string; format: string; locationType: string; platform: string; city: string;
  venueName: string; venueMapsRaw: string; date: string; time: string; zone: string; scheduleNote: string; keepUntil: string; priceIdr: string; seats: string;
  language: string; level: string; minAge: string; contentWarnings: string; safetyTools: string; genres: string[]; styles: string[]; coverKey: string; consent: boolean;
};

const EMPTY: Values = {
  title: "", system: "", otherSystem: "", summary: "", description: "", format: "", locationType: "", platform: "", city: "", venueName: "", venueMapsRaw: "", date: "", time: "19:00",
  zone: "WIB", scheduleNote: "", keepUntil: "", priceIdr: "0", seats: "5", language: "", level: "", minAge: "", contentWarnings: "", safetyTools: "", genres: [], styles: [], coverKey: "", consent: false,
};

/** The form's values for a game that exists. A "keep until" date shows only if the GM set one (the default is a day after the start). */
function valuesOf(g: GameRecord): Values {
  const start = zonedParts(g.startsAt, g.zone);
  const end = zonedParts(g.expiresAt, g.zone);
  const known = (SYSTEMS as readonly string[]).includes(g.system);
  return {
    title: g.title, system: known ? g.system : OTHER_SYSTEM, otherSystem: known ? "" : g.system, summary: g.summary, description: g.description, format: g.format, locationType: g.locationType,
    platform: g.platform, city: g.city, venueName: g.venueName, venueMapsRaw: g.venueMapsRaw, date: start.date, time: start.time, zone: g.zone, scheduleNote: g.scheduleNote,
    keepUntil: Date.parse(g.expiresAt) - Date.parse(g.startsAt) === 86_400_000 ? "" : end.date, priceIdr: String(g.priceIdr), seats: String(g.seats), language: g.language, level: g.level,
    minAge: g.minAge ? String(g.minAge) : "", contentWarnings: g.contentWarnings, safetyTools: g.safetyTools, genres: g.genres, styles: g.styles, coverKey: g.coverId, consent: g.consent,
  };
}

/** A game: new, or one of the GM's own (a change goes back to review). */
export function GameForm({ game, onSaved, onCancel }: { game: GameRecord | null; onSaved: (message: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [v, setV] = useState<Values>(game ? valuesOf(game) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Values>) => setV((old) => ({ ...old, ...patch }));
  const err = (key: string) => field(errors, key, t);
  const inPerson = v.locationType === "in_person";

  const pick = (list: string[], key: string, on: boolean, max: number) => (on ? [...list, key].slice(0, max) : list.filter((k) => k !== key));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem("");
    const body = { ...v, system: v.system === OTHER_SYSTEM ? OTHER_SYSTEM : v.system, priceIdr: v.priceIdr.trim(), seats: v.seats.trim(), minAge: v.minAge.trim(), keepUntil: v.keepUntil };
    const r = game ? await call<{ changed: boolean }>("PUT", `/games/${game.id}`, body) : await call<{ changed: boolean }>("POST", "/games", body);
    setBusy(false);
    if (r.ok) {
      setErrors({});
      onSaved(t(r.data.changed ? "acct.saved" : "acct.savedSame"));
    } else if (r.status === 422 && r.fields) {
      setErrors(r.fields);
      setProblem(t("acct.err.fix"));
    } else if (r.error === "no_profile") setProblem(t("acct.profileFirst"));
    else { setErrors({}); setProblem(errorText(t, r.error)); }
  }

  const radio = (name: keyof Values, value: string, label: string) => (
    <label key={value} className="flex min-h-11 items-center gap-[var(--space-sm)]">
      <input type="radio" name={name} className="size-5" checked={v[name] === value} onChange={() => set({ [name]: value } as Partial<Values>)} />
      {label}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-[var(--space-lg)]" data-testid="game-form">
      <Field id="g-title" label={t("acct.f.title")} error={err("title")}>
        <input id="g-title" className="input" value={v.title} maxLength={100} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field id="g-system" label={t("acct.f.system")} error={err("system")}>
        <select id="g-system" className="input" value={v.system} onChange={(e) => set({ system: e.target.value })}>
          <option value="">{""}</option>
          {SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value={OTHER_SYSTEM}>{OTHER_SYSTEM}</option>
        </select>
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

      <fieldset className="grid gap-[var(--space-xs)]">
        <legend className="label">{t("acct.f.format")}</legend>
        {radio("format", "one_shot", t("format.one_shot"))}
        {radio("format", "campaign", t("format.campaign"))}
        {err("format") && <p role="alert" className="text-sm font-bold text-danger">{err("format")}</p>}
      </fieldset>
      <fieldset className="grid gap-[var(--space-xs)]">
        <legend className="label">{t("acct.f.genres")}</legend>
        <div className="grid gap-x-[var(--space-lg)] sm:grid-cols-2 lg:grid-cols-3">
          {GENRES.map((g) => <Check key={g.key} id={`g-genre-${g.key}`} checked={v.genres.includes(g.key)} disabled={!v.genres.includes(g.key) && v.genres.length >= MAX_PER_GAME} onChange={(on) => set({ genres: pick(v.genres, g.key, on, MAX_PER_GAME) })}>{t(genreLabelKey(g.key))}</Check>)}
        </div>
        {err("genres") && <p role="alert" className="text-sm font-bold text-danger">{err("genres")}</p>}
      </fieldset>
      <fieldset className="grid gap-[var(--space-xs)]">
        <legend className="label">{t("acct.f.styles")}</legend>
        <div className="grid gap-x-[var(--space-lg)] sm:grid-cols-2 lg:grid-cols-3">
          {STYLES.map((s) => <Check key={s.key} id={`g-style-${s.key}`} checked={v.styles.includes(s.key)} disabled={!v.styles.includes(s.key) && v.styles.length >= MAX_PER_GAME} onChange={(on) => set({ styles: pick(v.styles, s.key, on, MAX_PER_GAME) })}>{t(styleLabelKey(s.key))}</Check>)}
        </div>
      </fieldset>

      <fieldset className="grid gap-[var(--space-xs)]">
        <legend className="label">{t("acct.f.where")}</legend>
        {radio("locationType", "online", t("loc.online"))}
        {radio("locationType", "in_person", t("loc.inPerson"))}
        {err("locationType") && <p role="alert" className="text-sm font-bold text-danger">{err("locationType")}</p>}
      </fieldset>
      {v.locationType === "online" && (
        <Field id="g-platform" label={t("acct.f.platform")} hint={t("acct.f.platformHint")} error={err("platform")}>
          <input id="g-platform" className="input" value={v.platform} maxLength={80} onChange={(e) => set({ platform: e.target.value })} />
        </Field>
      )}
      {inPerson && (
        <>
          <Field id="g-city" label={t("acct.f.gameCity")} error={err("city")}>
            <select id="g-city" className="input" value={v.city} onChange={(e) => set({ city: e.target.value })}>
              <option value="">{""}</option>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field id="g-venue" label={t("acct.f.venue")} hint={t("acct.f.venueHint")} error={err("venueName")}>
            <input id="g-venue" className="input" value={v.venueName} maxLength={80} onChange={(e) => set({ venueName: e.target.value })} />
          </Field>
          <Field id="g-maps" label={t("acct.f.maps")} hint={t("acct.f.mapsHint")} error={err("venueMapsRaw")}>
            <input id="g-maps" className="input" type="url" inputMode="url" value={v.venueMapsRaw} onChange={(e) => set({ venueMapsRaw: e.target.value })} />
          </Field>
        </>
      )}

      <div className="grid gap-[var(--space-lg)] sm:grid-cols-3">
        <Field id="g-date" label={t("acct.f.date")} error={err("date")}>
          <input id="g-date" className="input" type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field id="g-time" label={t("acct.f.time")}>
          <input id="g-time" className="input" type="time" value={v.time} onChange={(e) => set({ time: e.target.value })} />
        </Field>
        <Field id="g-zone" label={t("acct.f.zone")} error={err("zone")}>
          <select id="g-zone" className="input" value={v.zone} onChange={(e) => set({ zone: e.target.value })}>
            {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </Field>
      </div>
      <Field id="g-schedule" label={t("acct.f.schedule")} hint={t("acct.f.scheduleHint")} error={err("scheduleNote")}>
        <textarea id="g-schedule" className="input min-h-24" value={v.scheduleNote} maxLength={1000} onChange={(e) => set({ scheduleNote: e.target.value })} />
      </Field>
      <Field id="g-keep" label={t("acct.f.keepUntil")} hint={t("acct.f.keepUntilHint")} error={err("keepUntil")}>
        <input id="g-keep" className="input" type="date" value={v.keepUntil} onChange={(e) => set({ keepUntil: e.target.value })} />
      </Field>

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
      <div className="grid gap-[var(--space-lg)] sm:grid-cols-2">
        <Field id="g-language" label={t("acct.f.language")} error={err("language")}>
          <select id="g-language" className="input" value={v.language} onChange={(e) => set({ language: e.target.value })}>
            <option value="">{""}</option>
            <option value="id">{t("lang.gameId")}</option>
            <option value="en">{t("lang.gameEn")}</option>
            <option value="both">{t("lang.gameBoth")}</option>
          </select>
        </Field>
        <Field id="g-level" label={t("acct.f.level")} error={err("level")}>
          <select id="g-level" className="input" value={v.level} onChange={(e) => set({ level: e.target.value })}>
            <option value="">{""}</option>
            <option value="beginner">{t("level.beginner")}</option>
            <option value="any">{t("level.any")}</option>
            <option value="experienced">{t("level.experienced")}</option>
          </select>
        </Field>
      </div>
      <Field id="g-warnings" label={t("acct.f.warnings")} hint={t("acct.f.warningsHint")} error={err("contentWarnings")}>
        <textarea id="g-warnings" className="input min-h-24" value={v.contentWarnings} maxLength={1000} onChange={(e) => set({ contentWarnings: e.target.value })} />
      </Field>
      <Field id="g-safety" label={t("acct.f.safety")} hint={t("acct.f.safetyHint")} error={err("safetyTools")}>
        <input id="g-safety" className="input" value={v.safetyTools} maxLength={300} onChange={(e) => set({ safetyTools: e.target.value })} />
      </Field>
      <PictureField id="g-cover" kind="cover" value={v.coverKey} onChange={(coverKey) => set({ coverKey })} label={t("acct.f.cover")} hint={t("acct.f.coverHint")} error={err("coverKey")} />
      <div>
        <Check id="g-consent" checked={v.consent} onChange={(consent) => set({ consent })}>{t("acct.f.consentGame")}</Check>
        {errors.consent && <p role="alert" className="text-sm font-bold text-danger">{errorText(t, errors.consent)}</p>}
      </div>

      {problem && <p role="alert" className="font-bold text-danger">{problem}</p>}
      <div className="flex flex-wrap items-center gap-[var(--space-lg)]">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t("acct.sending") : t("acct.saveGame")}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>{t("acct.cancel")}</button>
      </div>
    </form>
  );
}
