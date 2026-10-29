"use client";

import { useState } from "react";
import { shrinkImage, uploadImage } from "@/lib/account-api";
import { SUMMARY_MAX } from "@/lib/areas";
import type { MsgKey, T } from "@/lib/i18n/core";
import { useI18n } from "../i18n-provider";

/** The words for an error code from the server (or from a failed call). */
export function errorText(t: T, code: string): string {
  const known = ["required", "choose_one", "invalid_phone", "invalid_discord", "invalid_link", "invalid_date", "in_the_past", "before_start", "invalid_number", "too_long", "invalid", "rate_limited", "bad_email", "mail_failed", "turnstile_failed", "too_large", "not_an_image", "network", "server"];
  return t(`acct.err.${known.includes(code) ? code : "invalid"}` as MsgKey, { n: SUMMARY_MAX });
}

/** A label above its field, a hint under it, and the error (if any) next to it. */
export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p role="alert" className="mt-[var(--space-xs)] text-sm font-bold text-danger">{error}</p>}
    </div>
  );
}

export const field = (errors: Record<string, string>, key: string, t: T) => (errors[key] ? errorText(t, errors[key]) : undefined);

export function Check({ id, checked, onChange, children, disabled = false }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-start gap-[var(--space-sm)] py-[var(--space-xs)]">
      <input id={id} type="checkbox" className="mt-1 size-5 shrink-0" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/**
 * A picture field: the person picks a file, it is shrunk in the browser and uploaded at once, and the form keeps only the key
 * the server gives back. `value` is the key already stored (or "").
 */
export function PictureField({ id, kind, value, onChange, label, hint, error }: { id: string; kind: "cover" | "photo"; value: string; onChange: (key: string) => void; label: string; hint: string; error?: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [preview, setPreview] = useState("");

  async function pick(file: File | undefined) {
    if (!file) return;
    setProblem("");
    setBusy(true);
    try {
      const blob = await shrinkImage(file, kind);
      const up = await uploadImage(blob, kind);
      if (up.ok) {
        setPreview(URL.createObjectURL(blob));
        onChange(up.data.key);
      } else setProblem(errorText(t, up.error));
    } catch {
      setProblem(errorText(t, "not_an_image"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} type="file" accept="image/png,image/jpeg,image/webp" className="input" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
      <p className="hint">{hint}</p>
      {busy && <p role="status" className="mt-[var(--space-xs)] text-sm">{t("acct.f.uploading")}</p>}
      {value && !busy && (
        <div className="mt-[var(--space-sm)] flex flex-wrap items-center gap-[var(--space-md)]">
          {/* A local preview of what was just picked; a stored picture is shown as text only (it is private until approved). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob: preview of a file just picked */}
          {preview && <img src={preview} alt="" className={`plate ${kind === "cover" ? "aspect-[4/5] w-24" : "size-24"} object-cover`} />}
          <span role="status" className="text-sm font-bold">{preview ? t("acct.f.picked") : t("acct.f.pickedOld")}</span>
          <button type="button" className="btn btn-ghost" onClick={() => { setPreview(""); onChange(""); }}>{t("acct.f.removePicture")}</button>
        </div>
      )}
      {(problem || error) && <p role="alert" className="mt-[var(--space-xs)] text-sm font-bold text-danger">{problem || error}</p>}
    </div>
  );
}
