import { LANGS } from "./types.ts";

/** Names no real page: slugs end in "-" and four characters of the id. */
export const PLACEHOLDER_SLUG = "none";

/**
 * The pages of a [lang]/…/[slug] route, one per language and item. `output: "export"` refuses a dynamic route with no
 * pages at all, and a new site has no games or Game Masters yet: then one placeholder page is built, which shows "not
 * found" (the page calls notFound() for any slug it doesn't know) and is linked from nowhere.
 */
export function slugParams(items: readonly { slug: string }[]): { lang: string; slug: string }[] {
  const slugs = items.length > 0 ? items.map((i) => i.slug) : [PLACEHOLDER_SLUG];
  return LANGS.flatMap((lang) => slugs.map((slug) => ({ lang, slug })));
}
