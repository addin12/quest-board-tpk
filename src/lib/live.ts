// The site between builds. The pages are built from the data of the last build; this reads what is true now (GET /api/live: public, cached for a few
// seconds, no phone numbers) and turns it into the same shape the pages already use. Pictures the build already cropped keep their cropped file while they
// are still the current ones; a new or replaced picture is read from the bucket (/api/img). Pure apart from fetchLive; imported by client components.
import { parsePublicData } from "./public-data.ts";
import { adminPictureUrl } from "./pictures.ts";
import type { SiteData, SiteGame, SiteGm } from "./types.ts";

export const LIVE_URL = "/api/live";

/** What the build knew (the page's own data): lets a picture it cropped be reused while it is still the current one. */
export type Known = { games?: readonly SiteGame[]; gms?: readonly SiteGm[] };

/** The live data in the site's shape. Anything the site's checks reject is dropped, as it is at build time. */
export function toSite(raw: unknown, known: Known = {}): SiteData {
  const { data } = parsePublicData(raw);
  const covers = new Map((known.games ?? []).filter((g) => g.cover && g.coverKey).map((g) => [g.id, g]));
  const photos = new Map((known.gms ?? []).filter((g) => g.photo && g.photoKey).map((g) => [g.id, g]));
  return {
    generatedAt: data.generatedAt,
    gms: data.gms.map(({ photoId, ...gm }) => {
      const had = photos.get(gm.id);
      return { ...gm, photo: !photoId ? null : had?.photoKey === photoId ? had.photo : adminPictureUrl(photoId), photoKey: photoId };
    }),
    games: data.games.map(({ coverId, ...g }) => {
      const had = covers.get(g.id);
      return { ...g, cover: !coverId ? null : had?.coverKey === coverId ? had.cover : adminPictureUrl(coverId), coverKey: coverId };
    }),
    goneGames: data.goneGames,
    goneGms: data.goneGms,
  };
}

let inflight: { at: number; promise: Promise<unknown> } | null = null;
/** The live data as the server sent it. Calls close together share one request (a page and its widgets all ask at once). Throws when the server cannot be reached. */
export function fetchLive(now: number = Date.now()): Promise<unknown> {
  if (inflight && now - inflight.at < 10_000) return inflight.promise;
  const promise = fetch(LIVE_URL, { headers: { Accept: "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`live_${res.status}`);
    return res.json();
  });
  inflight = { at: now, promise };
  promise.catch(() => { if (inflight?.promise === promise) inflight = null; }); // a failure is not remembered: the next ask tries again
  return promise;
}
