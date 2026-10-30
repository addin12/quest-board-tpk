// Game categories: genres and play styles, a fixed translated taxonomy (labels: t(`genre.${key}`), t(`style.${key}`)).
// The same keys are checked by the backend (worker/src/rules.ts imports this file), so the form and the server cannot drift.
// Pure module (type-only imports).

import type { RegularIcon } from "./icons";
import type { MsgKey } from "./i18n/dict";

export const GENRES = [
  { key: "fantasy", icon: "dragon" },
  { key: "dark-fantasy", icon: "skull" },
  { key: "horror", icon: "ghost" },
  { key: "sci-fi", icon: "rocket" },
  { key: "cyberpunk", icon: "bolt" },
  { key: "mystery", icon: "fingerprint" },
  { key: "post-apocalyptic", icon: "radiation" },
  { key: "urban", icon: "city" },
  { key: "historical", icon: "castle" },
  { key: "cozy", icon: "campfire" },
  { key: "high-fantasy", icon: "crown" },
  { key: "gritty-fantasy", icon: "axe-battle" },
  { key: "low-magic", icon: "scroll" },
  { key: "grimdark", icon: "tombstone" },
  { key: "imaginative", icon: "magic-wand" },
  { key: "supernatural", icon: "moon-stars" },
  { key: "gothic-horror", icon: "bat" },
  { key: "eldritch-horror", icon: "eye" },
  { key: "survival", icon: "camping" },
  { key: "modern", icon: "building" },
  { key: "futuristic", icon: "satellite" },
  { key: "space-opera", icon: "planet-ringed" },
  { key: "space-western", icon: "hat-cowboy" },
  { key: "steampunk", icon: "gears" },
  { key: "superhero", icon: "hand-fist" },
  { key: "anime", icon: "star-shooting" },
  { key: "isekai", icon: "door-open" },
  { key: "pirate", icon: "skull-crossbones" },
  { key: "viking", icon: "helmet-battle" },
  { key: "western", icon: "horse" },
  { key: "victorian", icon: "umbrella" },
  { key: "rustic", icon: "wheat" },
  { key: "political-intrigue", icon: "chess-queen" },
  { key: "espionage", icon: "spy" },
  { key: "comedy", icon: "laugh-beam" },
  { key: "wacky", icon: "confetti" },
  { key: "heartwarming", icon: "hands-heart" },
  { key: "romance", icon: "heart" },
  { key: "battle-royale", icon: "trophy" },
  { key: "universal", icon: "globe" },
] as const satisfies readonly { key: string; icon: RegularIcon }[];

export const STYLES = [
  { key: "roleplay-heavy", icon: "theater-masks" },
  { key: "combat-heavy", icon: "sword" },
  { key: "tactical", icon: "chess" },
  { key: "rule-of-cool", icon: "sparkles" },
  { key: "theater-of-mind", icon: "brain" },
  { key: "sandbox", icon: "map" },
  { key: "puzzle-mystery", icon: "puzzle" },
  { key: "dungeon-crawl", icon: "axe" },
  { key: "narrative", icon: "feather" },
  { key: "roleplay-light", icon: "smile" },
  { key: "combat-light", icon: "shield" },
  { key: "rules-as-written", icon: "book-open-reader" },
  { key: "hexcrawl", icon: "hexagon" },
  { key: "kingdom-building", icon: "chess-rook" },
  { key: "west-marches", icon: "route" },
  { key: "organized-play", icon: "list-check" },
  { key: "play-by-post", icon: "comment-dots" },
] as const satisfies readonly { key: string; icon: RegularIcon }[];

export type GenreKey = (typeof GENRES)[number]["key"];
export type StyleKey = (typeof STYLES)[number]["key"];

/** Each game carries at most this many genres and this many styles. */
export const MAX_PER_GAME = 3;

export const isGenre = (k: string): k is GenreKey => GENRES.some((g) => g.key === k);
export const isStyle = (k: string): k is StyleKey => STYLES.some((s) => s.key === k);

export const genreLabelKey = (k: GenreKey) => `genre.${k}` as MsgKey;
export const styleLabelKey = (k: StyleKey) => `style.${k}` as MsgKey;
export const genreIcon = (k: GenreKey): RegularIcon => GENRES.find((g) => g.key === k)!.icon;
export const styleIcon = (k: StyleKey): RegularIcon => STYLES.find((s) => s.key === k)!.icon;
