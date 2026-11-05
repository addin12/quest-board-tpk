"use client";

import { useEffect, useRef, useState } from "react";
import { fetchLive, toSite, type Known } from "@/lib/live";
import type { SiteData } from "@/lib/types";

/** How often a page that stays open asks again. The server's own cache lasts about twenty seconds, so this is "within a minute or so". */
const REFRESH_MS = 60_000;

/**
 * What is true now, or null until the first answer (and for good if the server cannot be reached: the page keeps what it was built with).
 * `known` is what the page was built with, used to keep pictures that were already cropped. Asks again every minute while the page is in view.
 */
export function useLive(known: Known): SiteData | null {
  const [data, setData] = useState<SiteData | null>(null);
  const knownRef = useRef(known);
  useEffect(() => { knownRef.current = known; }); // the latest `known`, read when an answer arrives
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const raw = await fetchLive();
        if (!stopped) setData(toSite(raw, knownRef.current));
      } catch {
        // offline or the backend is down: what the page was built with stays on screen
      }
    };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, REFRESH_MS);
    const onShow = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onShow); };
  }, []);
  return data;
}
