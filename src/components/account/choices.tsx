"use client";

// The answers of the game form, drawn the way the rest of the site draws things (design.md): small rectangles with a hairline, no pills, no icons, and the
// accent kept for the one main button. Each option is a real radio button or tick box with its label, so it reads like a printed form, works with the
// keyboard, and is found by screen readers and the browser tests by its name.

type Option = { value: string; label: string };

/** A box around one radio option: the chosen one gets an ink border and a light tint, so the choice shows without colour alone. */
const BOX = "flex min-h-11 cursor-pointer items-center gap-[var(--space-sm)] rounded-[var(--radius-input)] border px-[var(--space-md)] py-[var(--space-xs)] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-focus)]";
const BOX_ON = "border-ink bg-paper-3";
const BOX_OFF = "border-[color-mix(in_oklab,var(--color-ink)_25%,var(--color-paper))] hover:border-ink";
/** The native control, in the accent (the browser draws it; nothing extra). */
const CONTROL = "size-5 shrink-0 accent-[var(--color-accent)]";
/** A list in columns: one column on a narrow phone, two from 400 px, three on a wide screen. */
const LIST = "grid grid-cols-1 gap-x-[var(--space-lg)] min-[400px]:grid-cols-2 lg:grid-cols-3";

/**
 * One answer from a few (format, date or on request, time zone, language, level, characters). `stacked` puts long labels one under another; `columns`
 * draws a longer list (the Game Master's area) as plain radio buttons in columns, the way Ticks draws a tick list.
 */
export function Choice({ name, legend, hint, options, value, onChange, error, stacked = false, columns = false }: { name: string; legend: string; hint?: string; options: Option[]; value: string; onChange: (v: string) => void; error?: string; stacked?: boolean; columns?: boolean }) {
  return (
    <fieldset className={columns ? "grid gap-[var(--space-xs)]" : "grid gap-[var(--space-sm)]"}>
      <legend className="label">{legend}</legend>
      {hint && <p className="hint -mt-[var(--space-xs)] mb-0">{hint}</p>}
      <div className={columns ? LIST : stacked ? "grid gap-[var(--space-xs)]" : "flex flex-wrap gap-[var(--space-sm)]"}>
        {options.map((o) => {
          const on = value === o.value;
          if (columns) {
            return (
              <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-[var(--space-sm)]">
                <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className={CONTROL} />
                <span className={on ? "font-medium" : undefined}>{o.label}</span>
              </label>
            );
          }
          return (
            <label key={o.value} className={`${BOX} ${on ? BOX_ON : BOX_OFF}`}>
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className={CONTROL} />
              <span className={on ? "font-medium" : undefined}>{o.label}</span>
            </label>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

/**
 * Several answers from a list (genres, places, safety tools, what to bring, a Game Master's systems) as a tick list in columns. With `max`, the rest wait once
 * that many are ticked. `children` come under the list (the profile form puts its "add a system" search there).
 */
export function Ticks({ name, legend, hint, options, selected, onChange, max, counter, error, columns = 3, children }: { name: string; legend: string; hint?: string; options: Option[]; selected: string[]; onChange: (next: string[]) => void; max?: number; counter?: string; error?: string; columns?: 2 | 3; children?: React.ReactNode }) {
  const full = max !== undefined && selected.length >= max;
  const toggle = (value: string, on: boolean) => onChange(on ? [...selected, value] : selected.filter((v) => v !== value));
  return (
    <fieldset className="grid gap-[var(--space-xs)]">
      <legend className="label flex w-full flex-wrap items-baseline justify-between gap-x-[var(--space-md)]">
        <span>{legend}</span>
        {counter && <span className="text-sm font-normal text-muted" aria-live="polite">{counter}</span>}
      </legend>
      {hint && <p className="hint -mt-[var(--space-xs)] mb-0">{hint}</p>}
      {options.length > 0 && <div className={columns === 3 ? LIST : "grid grid-cols-1 gap-x-[var(--space-lg)] min-[400px]:grid-cols-2"}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          const off = !on && full;
          return (
            <label key={o.value} className={`flex min-h-11 items-center gap-[var(--space-sm)] ${off ? "cursor-not-allowed text-muted" : "cursor-pointer"}`}>
              <input type="checkbox" name={name} value={o.value} checked={on} disabled={off} onChange={(e) => toggle(o.value, e.target.checked)} className={CONTROL} />
              <span className={on ? "font-medium" : undefined}>{o.label}</span>
            </label>
          );
        })}
      </div>}
      {children}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  );
}
