"use client";

import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";
import { setThemeChoice, useResolvedTheme } from "./theme-state";

/**
 * The quick light/dark toggle in the header. It names the mode it switches to (a moon and "Dark" while the page is light), so the
 * label is the action. Under 1024 px only the icon shows, the full name stays in the accessible name; the footer has the
 * three-way switch with Automatic.
 */
export function ThemeToggle() {
  const { t } = useI18n();
  const theme = useResolvedTheme();
  const target = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setThemeChoice(target)}
      aria-label={t(target === "dark" ? "theme.toDark" : "theme.toLight")}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-[var(--space-xs)] rounded-[var(--radius-input)] border border-ink px-2 text-sm font-bold text-ink hover:bg-paper-3 lg:px-3"
    >
      <Icon name={target === "dark" ? "moon" : "sun"} />
      <span className="max-lg:hidden">{t(target === "dark" ? "theme.darkShort" : "theme.lightShort")}</span>
    </button>
  );
}
