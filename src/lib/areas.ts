// Quest Board TPK lists games played online or in person in Jabodetabek. Pure module (no imports): the script,
// the checks and the tests share it.

/** The cities a Game Master picks from in the forms. */
export const AREAS = ["Jakarta", "Bogor", "Depok", "Tangerang", "Tangerang Selatan", "Bekasi"] as const;

/** A card shows the whole short description, so it is kept short: this many characters at most. */
export const SUMMARY_MAX = 80;

const WORDS = ["jakarta", "bogor", "depok", "tangerang", "tangsel", "bekasi", "jabodetabek", "bsd", "cibubur"];

/** True for a city (or district) inside Jabodetabek, however it is spelled: "Jakarta Selatan", "kota bekasi". */
export const inJabodetabek = (city: string): boolean => {
  const c = city.toLowerCase();
  return WORDS.some((w) => c.includes(w));
};
