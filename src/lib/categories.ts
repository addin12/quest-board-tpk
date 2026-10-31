// Game categories: genres and play styles, a fixed translated taxonomy (labels: t(`genre.${key}`), t(`style.${key}`)).
// The same keys are checked by the backend (worker/src/rules.ts imports this file), so the form and the server cannot drift.
// Pure module (type-only imports).

import type { MsgKey } from "./i18n/dict";

export const GENRES = [
  { key: "fantasy" },
  { key: "dark-fantasy" },
  { key: "horror" },
  { key: "sci-fi" },
  { key: "cyberpunk" },
  { key: "mystery" },
  { key: "post-apocalyptic" },
  { key: "urban" },
  { key: "historical" },
  { key: "cozy" },
  { key: "high-fantasy" },
  { key: "gritty-fantasy" },
  { key: "low-magic" },
  { key: "grimdark" },
  { key: "imaginative" },
  { key: "supernatural" },
  { key: "gothic-horror" },
  { key: "eldritch-horror" },
  { key: "survival" },
  { key: "modern" },
  { key: "futuristic" },
  { key: "space-opera" },
  { key: "space-western" },
  { key: "steampunk" },
  { key: "superhero" },
  { key: "anime" },
  { key: "isekai" },
  { key: "pirate" },
  { key: "viking" },
  { key: "western" },
  { key: "victorian" },
  { key: "rustic" },
  { key: "political-intrigue" },
  { key: "espionage" },
  { key: "comedy" },
  { key: "wacky" },
  { key: "heartwarming" },
  { key: "romance" },
  { key: "battle-royale" },
  { key: "universal" },
] as const satisfies readonly { key: string }[];

export const STYLES = [
  { key: "roleplay-heavy" },
  { key: "combat-heavy" },
  { key: "tactical" },
  { key: "rule-of-cool" },
  { key: "theater-of-mind" },
  { key: "sandbox" },
  { key: "puzzle-mystery" },
  { key: "dungeon-crawl" },
  { key: "narrative" },
  { key: "roleplay-light" },
  { key: "combat-light" },
  { key: "rules-as-written" },
  { key: "hexcrawl" },
  { key: "kingdom-building" },
  { key: "west-marches" },
  { key: "organized-play" },
  { key: "play-by-post" },
] as const satisfies readonly { key: string }[];

/** How a game resolves things: the dice or cards behind the rules. A game carries at most MAX_PER_GAME of them. */
export const MECHANICS = [
  { key: "d20" },
  { key: "d100" },
  { key: "2d6" },
  { key: "dice-pool" },
  { key: "fate-dice" },
  { key: "pbta" },
  { key: "fitd" },
  { key: "osr" },
  { key: "card-based" },
  { key: "no-dice" },
] as const satisfies readonly { key: string }[];

export type GenreKey = (typeof GENRES)[number]["key"];
export type StyleKey = (typeof STYLES)[number]["key"];

/** Each game carries at most this many genres and this many styles. */
export const MAX_PER_GAME = 3;

export const isGenre = (k: string): k is GenreKey => GENRES.some((g) => g.key === k);
export type MechanicKey = (typeof MECHANICS)[number]["key"];
export const isMechanic = (k: string): k is MechanicKey => MECHANICS.some((m) => m.key === k);
export const mechanicLabelKey = (k: MechanicKey) => `mechanic.${k}` as MsgKey;
export const isStyle = (k: string): k is StyleKey => STYLES.some((s) => s.key === k);

export const genreLabelKey = (k: GenreKey) => `genre.${k}` as MsgKey;
/** A genre's picture: public domain book art, one file per genre in public/images/genres (credits in docs/art-credits.md). */
export const genreCover = (k: GenreKey) => `/images/genres/${k}.webp`;
export const styleLabelKey = (k: StyleKey) => `style.${k}` as MsgKey;
