// schema.org structured data for search engines (JSON-LD), and the language alternates of a page.
// Pure module. Only what the page shows everyone goes in: never an email address, and no phone number.
import { SITE_URL } from "./site.ts";
import type { Lang, SiteGame, SiteGm } from "./types.ts";

const abs = (path: string | null) => (path ? `${SITE_URL}${path}` : undefined);

export type Crumb = { name: string; url: string };

export function breadcrumbJsonLd(crumbs: Crumb[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
  };
}

/** One Event for a game's first session: when, where, what it costs, who runs it. */
export function gameJsonLd(game: SiteGame, gm: SiteGm | undefined, lang: Lang): object {
  const online = game.locationType === "online";
  const url = `${SITE_URL}/${lang}/games/${game.slug}/`;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: game.title,
    description: game.summary || undefined,
    startDate: game.startsAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: online ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    inLanguage: game.language === "both" ? ["id", "en"] : game.language,
    location: online
      ? { "@type": "VirtualLocation", url }
      : {
          "@type": "Place",
          name: game.venueName || game.city,
          address: { "@type": "PostalAddress", addressLocality: game.city, addressCountry: "ID" },
          ...(game.venueName && game.venueMapsUrl ? { hasMap: game.venueMapsUrl } : {}),
        },
    image: game.cover ? [abs(game.cover)] : undefined,
    organizer: gm ? { "@type": "Person", name: gm.name, url: `${SITE_URL}/${lang}/gm/${gm.slug}/` } : undefined,
    offers: { "@type": "Offer", url, price: game.priceIdr, priceCurrency: "IDR", availability: game.full ? "https://schema.org/SoldOut" : "https://schema.org/InStock" },
    maximumAttendeeCapacity: game.seats,
    keywords: game.system,
  };
}

export function gmJsonLd(gm: SiteGm, lang: Lang): object {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE_URL}/${lang}/gm/${gm.slug}/`,
    mainEntity: { "@type": "Person", name: gm.name, jobTitle: "Game Master", description: gm.bio.slice(0, 300) || undefined, image: abs(gm.photo), homeLocation: gm.city ? { "@type": "Place", name: gm.city } : undefined },
  };
}

export function websiteJsonLd(lang: Lang, description: string): object[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Quest Board TPK",
      url: SITE_URL,
      inLanguage: lang === "id" ? "id-ID" : "en",
      description,
      potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/${lang}/games/?q={search_term_string}`, "query-input": "required name=search_term_string" },
    },
    { "@context": "https://schema.org", "@type": "Organization", name: "The Pandemonium Kollektive", url: SITE_URL, areaServed: "ID" },
  ];
}

export function collectionJsonLd(name: string, lang: Lang, games: Pick<SiteGame, "title" | "slug">[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: games.length,
      itemListElement: games.slice(0, 50).map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.title, url: `${SITE_URL}/${lang}/games/${g.slug}/` })),
    },
  };
}

/** JSON for a <script type="application/ld+json">, safe against "</script>" in a title. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** canonical + hreflang for a page: `path` without a language prefix ("/games/"), e.g. languageAlternates("en", "/games/"). */
export function languageAlternates(lang: Lang, path: string) {
  return {
    canonical: `${SITE_URL}/${lang}${path}`,
    languages: { en: `${SITE_URL}/en${path}`, id: `${SITE_URL}/id${path}`, "x-default": `${SITE_URL}/en${path}` },
  };
}
