import type { MetadataRoute } from "next";
import { gameViews, loadSiteData } from "@/lib/data";
import { areaPages, systemPages } from "@/lib/landing";
import { LANGS } from "@/lib/types";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const data = loadSiteData();
  const lastModified = data.generatedAt;
  const views = gameViews(data);
  const landing = [...systemPages(views, Date.now()).map((p) => `/systems/${p.slug}/`), ...areaPages(views, Date.now()).map((p) => `/areas/${p.slug}/`)]; // the pages written for the systems and areas that have a game now
  const pages = ["/", "/games/", "/systems/", "/genres/", "/styles/", "/mechanics/", "/gms/", "/how-it-works/", "/find-a-game/", "/list-your-game/", ...landing, ...data.games.map((g) => `/games/${g.slug}/`), ...data.gms.map((g) => `/gm/${g.slug}/`)];
  return pages.flatMap((p) =>
    LANGS.map((lang) => ({
      url: `${SITE_URL}/${lang}${p}`,
      lastModified,
      alternates: { languages: Object.fromEntries(LANGS.map((l) => [l, `${SITE_URL}/${l}${p}`])) },
    })),
  );
}
