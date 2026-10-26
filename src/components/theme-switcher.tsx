"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

type Theme = "system" | "light" | "dark";
const KEY = "tpk-theme";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const noop = () => () => {};

/** Automatic (follows the device) → light (parchment) → dark (candlelight). Remembered in this browser only. */
export function ThemeSwitcher() {
  const { t } = useI18n();
  const stored = useSyncExternalStore(noop, read, () => "system" as Theme);
  const [override, setOverride] = useState<Theme | null>(null);
  const theme = override ?? stored;
  const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const name = (m: Theme) => t(m === "system" ? "theme.system" : m === "light" ? "theme.light" : "theme.dark");

  function change() {
    setOverride(next);
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Private browsing: the choice lasts until the page is closed.
    }
  }

  return (
    <button type="button" onClick={change} className="btn-secondary" aria-label={t("theme.switch", { current: name(theme), next: name(next) })}>
      <Icon name={theme === "system" ? "circle-half-stroke" : theme === "light" ? "sun" : "candle-holder"} />
      {t("theme.current", { current: name(theme) })}
    </button>
  );
}
