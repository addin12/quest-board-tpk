"use client";

import { useId, useMemo, useState } from "react";
import { matchesWords, queryWords, searchText } from "@/lib/search";

export type PickerOption = { value: string; label: string };

/**
 * A searchable list in place of a long native dropdown (the game systems, the genres, the play styles, the mechanics). A standard ARIA combobox:
 * click or type to open and narrow the list, arrow keys and Enter to choose, Escape to close. `value` is the chosen option's value ("" for none);
 * `onChange` gets the chosen value. In the GM form `other` is the last choice; in the games filter `any` is the first (it chooses "") and shows
 * while nothing is typed. The list opens on a click or on typing, never on focus: a filter sheet focuses its first field when it opens, and
 * Escape must then close the sheet.
 */
export function SearchPicker({ id, value, options, other, any, placeholder, listLabel, onChange, invalid, "aria-describedby": describedBy }: {
  id: string; value: string; options: readonly PickerOption[]; other?: PickerOption; any?: string; placeholder: string; listLabel: string; onChange: (value: string) => void; invalid?: boolean; "aria-describedby"?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState(0);

  const choices = useMemo(() => {
    const words = dirty ? queryWords(text) : [];
    const found = options.filter((o) => matchesWords(searchText(o.label), words));
    return [...(any && words.length === 0 ? [{ label: any, value: "" }] : []), ...found, ...(other ? [other] : [])];
  }, [options, other, any, text, dirty]);

  const shown = options.find((o) => o.value === value)?.label ?? (other && value === other.value ? other.label : value || any || "");

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
        aria-describedby={describedBy}
        autoComplete="off"
        className="input"
        value={open && dirty ? text : shown}
        placeholder={placeholder}
        onClick={(e) => { setOpen(true); setActive(0); e.currentTarget.select(); }}
        onBlur={() => { setOpen(false); setDirty(false); }}
        onChange={(e) => { setText(e.target.value); setDirty(true); setOpen(true); setActive(0); }}
        onKeyDown={key}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={listLabel} className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto border border-ink bg-paper">
          {choices.map((c, i) => (
            <li
              key={c.value || c.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={c.value === value}
              className={`flex min-h-11 cursor-pointer items-center px-[var(--space-md)] ${i === active ? "bg-accent-soft" : ""} ${c.value === value ? "font-medium" : ""}`}
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
