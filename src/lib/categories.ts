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
  { key: "no-gen-ai" },
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
  // the rest are the mechanics StartPlaying lists (startplaying.games/play/mechanics), in its order
  { key: "brp" },
  { key: "storyteller" },
  { key: "exploding-dice" },
  { key: "year-zero" },
  { key: "interlock" },
  { key: "2d20" },
  { key: "mork-borg" },
  { key: "narrative-dice" },
  { key: "d616" },
  { key: "illuminated-worlds" },
  { key: "fudge" },
  { key: "essence20" },
] as const satisfies readonly { key: string }[];

export type GenreKey = (typeof GENRES)[number]["key"];
export type StyleKey = (typeof STYLES)[number]["key"];

/** Each game carries at most this many play styles and this many mechanics. */
export const MAX_PER_GAME = 3;
/** And at most this many genres: a game is often several at once (a horror mystery in a gothic city). */
export const MAX_GENRES = 5;
/** A Game Master's profile names at most this many systems they usually run. */
export const MAX_GM_SYSTEMS = 10;

export const isGenre = (k: string): k is GenreKey => GENRES.some((g) => g.key === k);
export type MechanicKey = (typeof MECHANICS)[number]["key"];
export const isMechanic = (k: string): k is MechanicKey => MECHANICS.some((m) => m.key === k);
export const mechanicLabelKey = (k: MechanicKey) => `mechanic.${k}` as MsgKey;
export const isStyle = (k: string): k is StyleKey => STYLES.some((s) => s.key === k);

export const genreLabelKey = (k: GenreKey) => `genre.${k}` as MsgKey;

// What a player needs to know before asking for a seat (ADR-49): the safety tools a game uses, what to bring, and where the characters come from.
export const SAFETY_TOOLS = [
  { key: "x-card" },
  { key: "lines-veils" },
  { key: "session-zero" },
  { key: "script-change" },
  { key: "stars-wishes" },
  { key: "open-door" },
] as const satisfies readonly { key: string }[];
export const NEEDS = [
  { key: "mic" },
  { key: "camera" },
  { key: "discord" },
  { key: "vtt" },
  { key: "dice" },
  { key: "book" },
] as const satisfies readonly { key: string }[];
/** Where the characters come from: ready-made, the players' own, or made together at the table. */
export const CHARACTER_SOURCES = ["pregen", "own", "table"] as const;
export type SafetyToolKey = (typeof SAFETY_TOOLS)[number]["key"];
export type NeedKey = (typeof NEEDS)[number]["key"];
export type CharacterSource = (typeof CHARACTER_SOURCES)[number];
export const isSafetyTool = (k: string): k is SafetyToolKey => SAFETY_TOOLS.some((s) => s.key === k);
export const isNeed = (k: string): k is NeedKey => NEEDS.some((n) => n.key === k);
export const safetyToolLabelKey = (k: SafetyToolKey) => `safety.${k}` as MsgKey;
export const needLabelKey = (k: NeedKey) => `need.${k}` as MsgKey;
export const characterLabelKey = (k: CharacterSource) => `characters.${k}` as MsgKey;
/** The short description of a genre (written for this site, ADR-60; the genre cards carry it instead of a picture). */
export const genreAboutKey = (k: GenreKey) => `genre.${k}.about` as MsgKey;
export const styleLabelKey = (k: StyleKey) => `style.${k}` as MsgKey;
/** The short description of a style or a mechanic (written for this site; tests/unit/site-lib.test.ts checks that every key has one in both languages). */
export const styleAboutKey = (k: StyleKey) => `style.${k}.about` as MsgKey;
export const mechanicAboutKey = (k: MechanicKey) => `mechanic.${k}.about` as MsgKey;
