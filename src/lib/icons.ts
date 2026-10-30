// The icons Quest Board uses, as our names for Phosphor icons (https://phosphoricons.com, MIT licence, see THIRD_PARTY_NOTICES.md).
// Only these are shipped: `npm run icons` copies their outlines into src/components/icon-data.ts.
// Add a name here, then re-run `npm run icons`. Pure module (no imports) so the generator script and node --test can load it.

/** Our name for the icon, then the file name in `@phosphor-icons/core/assets/regular`. */
export const ICON_FILES = {
  // theme
  sun: "sun",
  moon: "moon",
  "circle-half-stroke": "circle-half",
  // status and actions (the admin page and notices)
  check: "check",
  "check-circle": "check-circle",
  "cross-circle": "x-circle",
  "triangle-warning": "warning",
  info: "info",
  undo: "arrow-counter-clockwise",
  refresh: "arrows-clockwise",
  "arrow-left": "arrow-left",
  trash: "trash",
  "user-add": "user-plus",
  "sign-out-alt": "sign-out",
  globe: "globe",
  "rocket-lunch": "rocket-launch",
  // the two contact channels a Game Master can give
  whatsapp: "whatsapp-logo",
  discord: "discord-logo",
} as const;

export type IconName = keyof typeof ICON_FILES;
