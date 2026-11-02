"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The sticky header. On a phone it slides away while you scroll down (the page needs the height) and comes back the moment you scroll up, reach
 * the top or move focus into it; from 1024 px up it never moves. The slide is a transform, and the reduced-motion rule makes it instant.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [away, setAway] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    last.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const delta = y - last.current;
      if (Math.abs(delta) < 8) return; // ignore jitter
      setAway(delta > 0 && y > 140);
      last.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 bg-paper transition-transform duration-[var(--dur-short)] ease-[var(--ease-out)] lg:translate-y-0 ${away ? "max-lg:-translate-y-full" : ""}`}
      onFocusCapture={() => setAway(false)}
    >
      {children}
    </header>
  );
}
