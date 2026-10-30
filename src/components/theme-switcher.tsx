"use client";

import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "./theme-state";

/** Automatic (follows the device) → light → dark, in the footer. The header has the quick light/dark toggle. Remembered in this browser only. */
export function ThemeSwitcher() {
  const { t } = useI18n();
  const theme = useThemeChoice();
  const next: ThemeChoice = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const name = (m: ThemeChoice) => t(m === "system" ? "theme.system" : m === "light" ? "theme.light" : "theme.dark");

  return (
    <button type="button" onClick={() => setThemeChoice(next)} className="btn-secondary" aria-label={t("theme.switch", { current: name(theme), next: name(next) })}>
      <Icon name={theme === "system" ? "circle-half-stroke" : theme === "light" ? "sun" : "candle-holder"} />
      {t("theme.current", { current: name(theme) })}
    </button>
  );
}
