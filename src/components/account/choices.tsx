"use client";

import { Icon } from "../icon";

// Answers you tap instead of dropdowns: large pills (44 px tall) that read and work like buttons. Underneath they are real radio buttons and checkboxes, so a
// screen reader, the keyboard and the browser tests find them by their names exactly as before; only the look changed.

const PILL = "inline-flex min-h-11 cursor-pointer select-none items-center gap-[var(--space-xs)] rounded-full border px-[var(--space-md)] text-[length:var(--text-md)] transition-colors peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-focus)]";
const ON = "border-accent bg-accent text-accent-ink";
const OFF = "border-[color-mix(in_oklab,var(--color-ink)_28%,var(--color-paper))] bg-paper text-ink hover:bg-paper-3";
const DISABLED = "cursor-not-allowed opacity-45 hover:bg-paper";
/** The input itself, invisible and over the whole pill: a click anywhere on the pill is a click on it. */
const COVER = "peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed";

type Option = { value: string; label: string };

/** One answer from a few (the format, the language, the time zone…). */
export function Choice({ name, legend, hint, options, value, onChange, error }: { name: string; legend: string; hint?: string; options: Option[]; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <fieldset className="grid gap-[var(--space-sm)]">
      <legend className="label">{legend}</legend>
      {hint && <p className="hint -mt-[var(--space-xs)]">{hint}</p>}
      <div className="flex flex-wrap gap-[var(--space-sm)]">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <label key={o.value} className="relative">
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className={COVER} />
              <span className={`${PILL} ${on ? ON : OFF}`}>{on && <Icon name="check" />}{o.label}</span>
            </label>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

/** Several answers from a list (genres, places, safety tools…). With `max`, the rest wait once that many are picked, and a counter says so. */
export function Chips({ name, legend, hint, options, selected, onChange, max, counter, error }: { name: string; legend: string; hint?: string; options: Option[]; selected: string[]; onChange: (next: string[]) => void; max?: number; counter?: string; error?: string }) {
  const full = max !== undefined && selected.length >= max;
  const toggle = (value: string, on: boolean) => onChange(on ? [...selected, value] : selected.filter((v) => v !== value));
  return (
    <fieldset className="grid gap-[var(--space-sm)]">
      <legend className="label">{legend}</legend>
      {(hint || counter) && <p className="hint -mt-[var(--space-xs)]">{[hint, counter].filter(Boolean).join(" ")}</p>}
      <div className="flex flex-wrap gap-[var(--space-sm)]">
        {options.map((o) => {
          const on = selected.includes(o.value);
          const off = !on && full;
          return (
            <label key={o.value} className="relative">
              <input type="checkbox" name={name} value={o.value} checked={on} disabled={off} onChange={(e) => toggle(o.value, e.target.checked)} className={COVER} />
              <span className={`${PILL} ${on ? ON : OFF} ${off ? DISABLED : ""}`}>{on && <Icon name="check" />}{o.label}</span>
            </label>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  );
}
