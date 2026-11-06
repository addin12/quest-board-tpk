// Every internal link in one place. The site is exported as static files with a trailing slash on every address
// (`/en/games/<slug>/`), and each language has its own prefix.
import type { Lang } from "./types.ts";

export const paths = {
  home: (l: Lang) => `/${l}/`,
  games: (l: Lang, query = "") => `/${l}/games/${query}`,
  game: (l: Lang, slug: string) => `/${l}/games/${slug}/`,
  systems: (l: Lang) => `/${l}/systems/`,
  system: (l: Lang, slug: string) => `/${l}/systems/${slug}/`,
  area: (l: Lang, slug: string) => `/${l}/areas/${slug}/`,
  genres: (l: Lang) => `/${l}/genres/`,
  styles: (l: Lang) => `/${l}/styles/`,
  mechanics: (l: Lang) => `/${l}/mechanics/`,
  gms: (l: Lang) => `/${l}/gms/`,
  gm: (l: Lang, slug: string) => `/${l}/gm/${slug}/`,
  how: (l: Lang) => `/${l}/how-it-works/`,
  quiz: (l: Lang) => `/${l}/find-a-game/`,
  list: (l: Lang) => `/${l}/list-your-game/`,
  admin: (l: Lang) => `/${l}/admin/`,
  account: (l: Lang) => `/${l}/account/`,
};

/** The same page in the other language: "/en/games/x/" -> "/id/games/x/". */
export function switchLang(pathname: string, to: Lang): string {
  return /^\/(en|id)(\/|$)/.test(pathname) ? pathname.replace(/^\/(en|id)/, `/${to}`) : `/${to}/`;
}

/** The smaller copy of a cover (cards and tiles use it): the build makes one for each listing cover, `npm run tiles` for each system and genre picture. The demo covers and the admin page's previews straight from the backend have only one size. */
export const smallCover = (cover: string): string => (/^\/(media|images\/(systems|genres))\//.test(cover) ? cover.replace(/\.webp$/, "-sm.webp") : cover);

/** The smallest copy of a listing's cover, for the rows of an index (80-96 px wide): the build makes one for each listing cover (`-xs`, 240 px). Anything else has no copy that small: its `smallCover`. */
export const rowCover = (cover: string): string => (/^\/media\/covers\/.+\.webp$/.test(cover) ? cover.replace(/\.webp$/, "-xs.webp") : smallCover(cover));
