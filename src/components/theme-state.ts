"use client";

import { useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "tpk-theme";

const html = () => document.documentElement;
const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Both theme controls (the header toggle and the footer's three-way switch) read the one `data-theme` attribute, so they never disagree. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(html(), { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

const choiceNow = (): ThemeChoice => {
  const attr = html().getAttribute("data-theme");
  return attr === "light" || attr === "dark" ? attr : "system";
};

/** The person's choice: automatic (follows the device), light or dark. */
export const useThemeChoice = (): ThemeChoice => useSyncExternalStore(subscribe, choiceNow, () => "system");

/** The theme in force right now: the choice, or the device's preference when it is automatic. */
export const useResolvedTheme = (): "light" | "dark" =>
  useSyncExternalStore(subscribe, () => { const c = choiceNow(); return c === "system" ? (prefersDark() ? "dark" : "light") : c; }, () => "light");

/** Applies and remembers a choice (in this browser only). */
export function setThemeChoice(choice: ThemeChoice): void {
  if (choice === "system") html().removeAttribute("data-theme");
  else html().setAttribute("data-theme", choice);
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Private browsing: the choice lasts until the page is closed.
  }
}
