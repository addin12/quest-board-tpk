// What every page's top bar needs to know: is this browser signed in, and as whom (ADR-57). The sign-in cookie is HttpOnly (a page's scripts cannot read it),
// so the account page leaves a note in this browser's storage once it has been told who is signed in, and the top bar reads that note. The note is only a
// hint to show or hide a bar: it holds a name, never a key, and the bar checks it with the server once per page load (a signed-out visitor, who has no note,
// makes no request at all). Client-side only.
import { useSyncExternalStore } from "react";

const KEY = "tpk-signed-in";
const EVENT = "tpk-signed-in-change";

function read(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null; // blocked or private storage: the bar simply stays away
  }
}

/** Notes who is signed in (the Game Master's display name, or their address before they have a profile), or, with null, that nobody is. */
export function writeSignedIn(label: string | null): void {
  try {
    if (label) localStorage.setItem(KEY, label.slice(0, 80));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: nothing to keep in step
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab signed in or out
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Who this browser is signed in as, or null. Null on the server and on the first paint, so the page and its build agree. */
export const useSignedIn = (): string | null => useSyncExternalStore(subscribe, read, () => null);
