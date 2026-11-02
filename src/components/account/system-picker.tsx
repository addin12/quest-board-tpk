"use client";

import { useId, useMemo, useState } from "react";
import { norm } from "@/lib/games";
import { useI18n } from "../i18n-provider";

/**
 * A searchable list for the game system: 141 names are too many to scroll in a native dropdown. A standard ARIA combobox: type to narrow the list,
 * arrow keys and Enter to choose, Escape to close. `onChange` gets the chosen name.
 * In the GM form `other` is the last choice; in the games filter `any` is the first (it chooses "", no system) and is shown when nothing is typed.
 */
export function SystemPicker({ id, value, options, other, any, onChange, invalid }: { id: string; value: string; options: readonly string[]; other?: string; any?: string; onChange: (value: string) => void; invalid?: boolean }) {
  const { t } = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState(0);

  const choices = useMemo(() => {
    const words = dirty ? norm(text).split(/\s+/).filter(Boolean) : [];
    const found = options.filter((o) => words.every((w) => norm(o).includes(w))).map((o) => ({ label: o, value: o }));
    return [...(any && words.length === 0 ? [{ label: any, value: "" }] : []), ...found, ...(other ? [{ label: other, value: other }] : [])];
  }, [options, other, any, text, dirty]);

  function choose(i: number) {
    const c = choices[Math.min(i, choices.length - 1)];
    if (c) onChange(c.value);
    setOpen(false);
    setDirty(false);
  }

  function key(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, choices.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); choose(active); }
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); setDirty(false); }
  }

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${Math.min(active, choices.length - 1)}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        className="input"
        value={open && dirty ? text : value || any || ""}
        placeholder={t("acct.f.systemPlaceholder")}
        // Opened by a click or by typing, not by focus: a filter sheet focuses its first field when it opens, and Escape must then close the sheet (and focus must not scroll the page)
        onClick={(e) => { setOpen(true); setActive(0); e.currentTarget.select(); }}
        onBlur={() => { setOpen(false); setDirty(false); }}
        onChange={(e) => { setText(e.target.value); setDirty(true); setOpen(true); setActive(0); }}
        onKeyDown={key}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={t("acct.f.systemList")} className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto border border-ink bg-paper">
          {choices.map((c, i) => (
            <li
              key={c.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={c.value === value}
              className={`flex min-h-11 cursor-pointer items-center px-[var(--space-md)] ${i === active ? "bg-accent-soft" : ""} ${c.value === value ? "font-bold" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); choose(i); }} // keeps focus in the input
              onMouseEnter={() => setActive(i)}
            >
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
