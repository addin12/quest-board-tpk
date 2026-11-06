"use client";

import { useEffect, useRef, useState } from "react";
import { call } from "@/lib/account-api";
import { AREAS, ONLINE_ONLY } from "@/lib/areas";
import { MAX_GM_SYSTEMS } from "@/lib/categories";
import { formatPhone } from "@/lib/format";
import { adminPictureUrl } from "@/lib/pictures";
import { OTHER_SYSTEM, SYSTEMS } from "@/lib/systems";
import type { GmRecord, SiteGm } from "@/lib/types";
import { useI18n } from "../i18n-provider";
import { SearchPicker } from "../search-picker";
import { GmCard } from "../ui";
import { Choice, Ticks } from "./choices";
import { Check, Field, PictureField, errorText, field } from "./fields";

type ProfileValues = { name: string; bio: string; city: string; systems: string[]; whatsapp: string; discord: string; instagram: string; photoKey: string; consent: boolean };

/**
 * The Game Master's profile, made once and changed any time (ADR-54), drawn like the game form: a header with Cancel, the questions in two parts (about
 * you, how players reach you), and beside them the card the Game Masters list will show, changing as they type. On a phone the card comes after the
 * questions, just above the agreement and Save. Systems are added from the same search the game form uses and kept as a tick list.
 */
export function ProfileForm({ profile, heading, lead, openGames, onSaved, onCancel }: { profile: GmRecord | null; heading: string; lead: string; openGames: number; onSaved: (message: string) => void; onCancel?: () => void }) {
  const { t, lang } = useI18n();
  const [v, setV] = useState<ProfileValues>({
    name: profile?.name ?? "", bio: profile?.bio ?? "", city: profile?.city ?? "", systems: profile?.systems ?? [],
    // The number back the way its owner writes it ("0813-5555-0009"), not as stored; saving it again changes nothing.
    whatsapp: profile ? formatPhone(profile.whatsapp) : "", discord: profile?.discord ?? "", instagram: profile?.instagram ?? "", photoKey: profile?.photoId ?? "", consent: profile?.consent ?? false,
  });
  // Every system shown as a tick box on this visit: one unticked stays in the list, so it can be ticked again.
  const [listed, setListed] = useState<string[]>(profile?.systems ?? []);
  const [other, setOther] = useState<string | null>(null); // the name being typed after choosing Other, or null
  const [picked, setPicked] = useState(""); // the photo just chosen, for the preview
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const otherInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ProfileValues>) => setV((old) => ({ ...old, ...patch }));
  const typingOther = other !== null;

  useEffect(() => { if (typingOther) otherInput.current?.focus(); }, [typingOther]);

  function addSystem(raw: string) {
    const name = raw.trim().slice(0, 60);
    if (!name) return;
    setListed((old) => (old.includes(name) ? old : [...old, name]));
    setV((old) => (old.systems.includes(name) || old.systems.length >= MAX_GM_SYSTEMS ? old : { ...old, systems: [...old.systems, name] }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem("");
    const r = await call<{ changed: boolean; status?: string }>("PUT", "/profile", v);
    setBusy(false);
    if (r.ok) {
      setErrors({});
      onSaved(t(!r.data.changed ? "acct.savedSame" : r.data.status === "pending" ? "acct.savedHeld" : "acct.saved")); // pending: the wording was held for an admin's look
    } else if (r.status === 422 && r.fields) {
      setErrors(r.fields);
      setProblem(t("acct.err.fix"));
    } else { setErrors({}); setProblem(errorText(t, r.error)); }
  }

  // A stored photo can be shown once the profile is live (before that it is private); a newly chosen one always.
  const stored = profile && profile.status === "approved" && profile.photoId && v.photoKey === profile.photoId ? adminPictureUrl(profile.photoId) : null;
  const preview: SiteGm = {
    id: "preview", slug: "preview", name: v.name.trim() || t("acct.preview.noName"), bio: v.bio, city: v.city,
    systems: v.systems, discord: "", instagram: "", photo: picked || stored, joinedAt: "",
  };
  // An older profile may name a place no longer on the list (plain "Jakarta"): it stays chosen and shown until the Game Master picks another.
  const areas: string[] = [...AREAS, ...(v.city && v.city !== ONLINE_ONLY && !(AREAS as readonly string[]).includes(v.city) ? [v.city] : [])];

  return (
    <div className="grid gap-[var(--space-xl)]">
      <header className="grid gap-[var(--space-sm)] border-b border-rule pb-[var(--space-md)]">
        <div className="flex flex-wrap items-end justify-between gap-[var(--space-md)]">
          <h2 className="text-[length:var(--text-title)]">{heading}</h2>
          {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>{t("acct.cancel")}</button>}
        </div>
        <p className="max-w-[60ch] text-ink-2">{lead}</p>
      </header>

      {/* Questions in the first column; the card beside them on a wide screen (spanning both rows), between them and Save on a phone. */}
      <div className="grid gap-x-[var(--space-2xl)] gap-y-[var(--space-xl)] lg:grid-cols-[minmax(0,1fr)_17rem]">
        <form id="gm-profile" onSubmit={submit} noValidate className="grid min-w-0 content-start gap-[var(--space-lg)] lg:col-start-1 lg:row-start-1" data-testid="profile-form">
          <h3 className="text-[length:var(--text-xl)]">{t("acct.profilePart.about")}</h3>
          <Field id="p-name" label={t("acct.f.name")} error={field(errors, "name", t)}>
            <input id="p-name" className="input" value={v.name} maxLength={60} autoComplete="name" onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field id="p-bio" label={t("acct.f.bio")} hint={`${v.bio.length}/800`} error={field(errors, "bio", t)}>
            <textarea id="p-bio" className="input min-h-32" value={v.bio} maxLength={800} onChange={(e) => set({ bio: e.target.value })} />
          </Field>
          <PictureField id="p-photo" kind="photo" value={v.photoKey} onChange={(photoKey) => set({ photoKey })} onPreview={setPicked} label={t("acct.f.photo")} hint={t("acct.f.photoHint")} error={field(errors, "photoKey", t)} />
          <Choice name="city" legend={t("acct.f.city")} columns value={v.city} onChange={(city) => set({ city })} error={field(errors, "city", t)}
            options={[...areas.map((a) => ({ value: a, label: a })), { value: ONLINE_ONLY, label: t("acct.f.cityOnline") }]} />
          <Ticks name="systems" legend={t("acct.f.systems")} hint={t("acct.f.systemsHint")} counter={t("acct.f.pickCount", { n: v.systems.length, max: MAX_GM_SYSTEMS })} columns={2}
            options={listed.map((s) => ({ value: s, label: s }))} selected={v.systems} max={MAX_GM_SYSTEMS} onChange={(systems) => set({ systems })} error={field(errors, "systems", t)}>
            {v.systems.length < MAX_GM_SYSTEMS && (
              <div className="mt-[var(--space-xs)]">
                <label htmlFor="p-systems" className="mb-[var(--space-2xs)] block text-sm text-ink-2">{t("acct.f.systemsAdd")}</label>
                <SearchPicker id="p-systems" value="" options={SYSTEMS.filter((s) => !listed.includes(s)).map((s) => ({ value: s, label: s }))} other={{ value: OTHER_SYSTEM, label: OTHER_SYSTEM }}
                  placeholder={t("acct.f.systemPlaceholder")} listLabel={t("acct.f.systemList")} onChange={(s) => (s === OTHER_SYSTEM ? setOther("") : addSystem(s))} />
              </div>
            )}
            {typingOther && (
              <div className="flex flex-wrap items-end gap-[var(--space-sm)]">
                <div className="min-w-0 flex-1 basis-56">
                  <label htmlFor="p-system-other" className="mb-[var(--space-2xs)] block text-sm text-ink-2">{t("acct.f.systemsOther")}</label>
                  <input id="p-system-other" ref={otherInput} className="input" value={other} maxLength={60} onChange={(e) => setOther(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSystem(other); setOther(null); } }} />
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => { addSystem(other); setOther(null); }}>{t("acct.f.systemsAddButton")}</button>
              </div>
            )}
          </Ticks>

          <h3 className="mt-[var(--space-md)] text-[length:var(--text-xl)]">{t("acct.profilePart.contact")}</h3>
          <Field id="p-wa" label={t("acct.f.whatsapp")} hint={t("acct.f.whatsappHint")} error={field(errors, "whatsapp", t)}>
            <input id="p-wa" className="input" type="tel" inputMode="tel" autoComplete="tel" value={v.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} />
          </Field>
          <Field id="p-discord" label={t("acct.f.discord")} hint={t("acct.f.discordHint")} error={field(errors, "discord", t)}>
            <input id="p-discord" className="input" value={v.discord} onChange={(e) => set({ discord: e.target.value })} />
          </Field>
          <Field id="p-instagram" label={t("acct.f.instagram")} hint={t("acct.f.instagramHint")} error={field(errors, "instagram", t)}>
            <input id="p-instagram" className="input" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={v.instagram} onChange={(e) => set({ instagram: e.target.value })} />
          </Field>
        </form>

        <aside aria-labelledby="p-preview-h" className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24 lg:self-start">
          <h3 id="p-preview-h" className="label text-muted">{t("acct.preview.gmTitle")}</h3>
          <div className="mt-[var(--space-sm)] border-t-3 border-ink" data-testid="profile-preview">
            <GmCard gm={preview} openGames={openGames} t={t} lang={lang} preview />
          </div>
        </aside>

        <div className="grid min-w-0 content-start gap-[var(--space-lg)] lg:col-start-1">
          <div>
            <Check id="p-consent" checked={v.consent} onChange={(consent) => set({ consent })}>{t("acct.f.consentProfile")}</Check>
            {errors.consent && <p role="alert" className="text-sm font-medium text-danger">{errorText(t, errors.consent)}</p>}
          </div>
          {problem && <p role="alert" className="font-medium text-danger">{problem}</p>}
          <div className="flex flex-wrap items-center justify-end gap-[var(--space-md)] border-t border-rule pt-[var(--space-lg)]">
            <button type="submit" form="gm-profile" className="btn btn-primary" disabled={busy}>{busy ? t("acct.sending") : t("acct.saveProfile")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
