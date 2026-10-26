// Every internal link in one place. The site is exported as static files with a trailing slash on every address
// (`/en/games/<slug>/`), and each language has its own prefix.
import type { Lang } from "./types.ts";

export const paths = {
  home: (l: Lang) => `/${l}/`,
  games: (l: Lang, query = "") => `/${l}/games/${query}`,
  game: (l: Lang, slug: string) => `/${l}/games/${slug}/`,
  gms: (l: Lang) => `/${l}/gms/`,
  gm: (l: Lang, slug: string) => `/${l}/gm/${slug}/`,
  how: (l: Lang) => `/${l}/how-it-works/`,
  list: (l: Lang) => `/${l}/list-your-game/`,
  admin: (l: Lang) => `/${l}/admin/`,
};

/** The same page in the other language: "/en/games/x/" -> "/id/games/x/". */
export function switchLang(pathname: string, to: Lang): string {
  return /^\/(en|id)(\/|$)/.test(pathname) ? pathname.replace(/^\/(en|id)/, `/${to}`) : `/${to}/`;
}

/** The smaller copy of a cover the build made (cards use it); covers that ship with the project have only one size. */
export const smallCover = (cover: string): string => cover.replace(/\.webp$/, "-sm.webp");
