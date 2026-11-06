// Quest Board lists games played online or in person in Jabodetabek. Pure module (no imports): the script,
// the checks and the tests share it.

/** The places a Game Master picks from in the forms: Jakarta in its five parts, and the cities around it. A game can be in several (ADR-52). */
export const AREAS = ["Jakarta Pusat", "Jakarta Utara", "Jakarta Barat", "Jakarta Selatan", "Jakarta Timur", "Bogor", "Depok", "Tangerang", "Tangerang Selatan", "Bekasi"] as const;
/** Places older saves used: still accepted and shown as they are, no longer offered. */
export const LEGACY_AREAS = ["Jakarta"] as const;
/** What a Game Master who plays only online has stored as their city (a profile's city; a game names its places in `cities`). */
export const ONLINE_ONLY = "Online only";
/** True for a place the forms offer or an older save used. */
export const isArea = (v: unknown): v is string => typeof v === "string" && ([...AREAS, ...LEGACY_AREAS] as readonly string[]).includes(v);

/** A card shows the whole short description, so it is kept short: this many characters at most. */
export const SUMMARY_MAX = 80;

const WORDS = ["jakarta", "bogor", "depok", "tangerang", "tangsel", "bekasi", "jabodetabek", "bsd", "cibubur"];

/** True for a city (or district) inside Jabodetabek, however it is spelled: "Jakarta Selatan", "kota bekasi". */
export const inJabodetabek = (city: string): boolean => {
  const c = city.toLowerCase();
  return WORDS.some((w) => c.includes(w));
};
