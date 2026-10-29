"use client";

import { useState } from "react";
import { call } from "@/lib/account-api";
import { AREAS } from "@/lib/areas";
import type { GmRecord } from "@/lib/types";
import { useI18n } from "../i18n-provider";
import { Check, Field, PictureField, errorText, field } from "./fields";

const ONLINE_ONLY = "Online only";

/** The GM profile: created once, changed any time (a change goes back to review). */
export function ProfileForm({ profile, onSaved, onCancel }: { profile: GmRecord | null; onSaved: (message: string) => void; onCancel?: () => void }) {
  const { t } = useI18n();
  const [v, setV] = useState({
    name: profile?.name ?? "", bio: profile?.bio ?? "", city: profile?.city ?? "", systems: (profile?.systems ?? []).join(", "),
    whatsapp: profile?.whatsapp ?? "", discord: profile?.discord ?? "", photoKey: profile?.photoId ?? "", consent: profile?.consent ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof v>) => setV((old) => ({ ...old, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem("");
    const r = await call<{ changed: boolean }>("PUT", "/profile", v);
    setBusy(false);
    if (r.ok) {
      setErrors({});
      onSaved(t(r.data.changed ? "acct.saved" : "acct.savedSame"));
    } else if (r.status === 422 && r.fields) {
      setErrors(r.fields);
      setProblem(t("acct.err.fix"));
    } else { setErrors({}); setProblem(errorText(t, r.error)); }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-[var(--space-lg)]" data-testid="profile-form">
      <Field id="p-name" label={t("acct.f.name")} error={field(errors, "name", t)}>
        <input id="p-name" className="input" value={v.name} maxLength={60} autoComplete="name" onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field id="p-bio" label={t("acct.f.bio")} error={field(errors, "bio", t)}>
        <textarea id="p-bio" className="input min-h-32" value={v.bio} maxLength={800} onChange={(e) => set({ bio: e.target.value })} />
      </Field>
      <Field id="p-city" label={t("acct.f.city")} error={field(errors, "city", t)}>
        <select id="p-city" className="input" value={v.city} onChange={(e) => set({ city: e.target.value })}>
          <option value="">{""}</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          <option value={ONLINE_ONLY}>{t("acct.f.cityOnline")}</option>
        </select>
      </Field>
      <Field id="p-systems" label={t("acct.f.systems")} hint={t("acct.f.systemsHint")} error={field(errors, "systems", t)}>
        <input id="p-systems" className="input" value={v.systems} onChange={(e) => set({ systems: e.target.value })} />
      </Field>
      <Field id="p-wa" label={t("acct.f.whatsapp")} hint={t("acct.f.whatsappHint")} error={field(errors, "whatsapp", t)}>
        <input id="p-wa" className="input" type="tel" inputMode="tel" autoComplete="tel" value={v.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} />
      </Field>
      <Field id="p-discord" label={t("acct.f.discord")} hint={t("acct.f.discordHint")} error={field(errors, "discord", t)}>
        <input id="p-discord" className="input" value={v.discord} onChange={(e) => set({ discord: e.target.value })} />
      </Field>
      <PictureField id="p-photo" kind="photo" value={v.photoKey} onChange={(photoKey) => set({ photoKey })} label={t("acct.f.photo")} hint={t("acct.f.photoHint")} error={field(errors, "photoKey", t)} />
      <div>
        <Check id="p-consent" checked={v.consent} onChange={(consent) => set({ consent })}>{t("acct.f.consentProfile")}</Check>
        {errors.consent && <p role="alert" className="text-sm font-bold text-danger">{errorText(t, errors.consent)}</p>}
      </div>
      {problem && <p role="alert" className="font-bold text-danger">{problem}</p>}
      <div className="flex flex-wrap items-center gap-[var(--space-lg)]">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t("acct.sending") : t("acct.saveProfile")}</button>
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>{t("acct.cancel")}</button>}
      </div>
    </form>
  );
}
