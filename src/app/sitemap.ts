import type { MetadataRoute } from "next";
import { loadSiteData } from "@/lib/data";
import { LANGS } from "@/lib/types";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const data = loadSiteData();
  const lastModified = data.generatedAt;
  const pages = ["/", "/games/", "/systems/", "/genres/", "/gms/", "/how-it-works/", "/list-your-game/", ...data.games.map((g) => `/games/${g.slug}/`), ...data.gms.map((g) => `/gm/${g.slug}/`)];
  return pages.flatMap((p) =>
    LANGS.map((lang) => ({
      url: `${SITE_URL}/${lang}${p}`,
      lastModified,
      alternates: { languages: Object.fromEntries(LANGS.map((l) => [l, `${SITE_URL}/${l}${p}`])) },
    })),
  );
}
