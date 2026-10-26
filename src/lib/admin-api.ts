// The admin page's connection to the Google Sheet's script and to Google sign-in. Client-side only.
//
// Sign-in: Google's button gives the page an ID token (a signed statement of who is signing in). The page sends it
// with every call; the script asks Google whether it is genuine and then looks the email up in the Admins tab. The
// token is kept in sessionStorage so a reload doesn't sign you out, and goes when the tab closes.
import { ADMIN_API_URL, GOOGLE_CLIENT_ID } from "./site.ts";
import type { Lang } from "./types.ts";

export const adminConfigured = (): boolean => Boolean(ADMIN_API_URL && GOOGLE_CLIENT_ID);

export class ApiError extends Error {
  constructor(public code: string, public detail: Record<string, unknown> = {}) {
    super(code);
  }
}

/**
 * One call to the script. The body is sent as text/plain so the browser makes no CORS pre-flight request (Apps Script
 * can't answer one); the script reads it as JSON.
 */
export async function api<T = Record<string, unknown>>(token: string, action: string, body: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ADMIN_API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...body, action, token }) });
  } catch {
    throw new ApiError("network");
  }
  let json: { ok?: boolean; error?: string } & Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError("bad_response");
  }
  if (!json.ok) throw new ApiError(json.error ?? "server_error", json);
  return json as T;
}

const KEY = "tpk-admin-token";

/** The email and expiry inside an ID token. Only for the page's own display: the script does the real check. */
export function readToken(token: string): { email: string; exp: number } | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.email === "string" && typeof payload.exp === "number" ? { email: payload.email.toLowerCase(), exp: payload.exp * 1000 } : null;
  } catch {
    return null;
  }
}

export function storedToken(nowMs = Date.now()): string | null {
  try {
    const t = sessionStorage.getItem(KEY);
    const info = t ? readToken(t) : null;
    return t && info && info.exp > nowMs + 60_000 ? t : null;
  } catch {
    return null;
  }
}

export const storeToken = (token: string | null): void => {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Private browsing: the sign-in lasts until the page reloads.
  }
};

type Gis = {
  accounts: { id: { initialize(c: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }): void; renderButton(el: HTMLElement, o: Record<string, unknown>): void; disableAutoSelect(): void } };
};

let gisLoading: Promise<Gis> | null = null;

/** Loads Google's sign-in script once. */
export function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  gisLoading ??= new Promise<Gis>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google?.accounts?.id ? resolve(w.google) : reject(new Error("gis")));
    s.onerror = () => { gisLoading = null; reject(new Error("gis")); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** Draws Google's "Sign in" button into `el`; `onToken` gets the ID token when someone signs in. */
export async function renderSignIn(el: HTMLElement, lang: Lang, onToken: (token: string) => void): Promise<void> {
  const gis = await loadGis();
  gis.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => onToken(r.credential), auto_select: false });
  gis.accounts.id.renderButton(el, { type: "standard", theme: "outline", size: "large", text: "signin_with", shape: "rectangular", width: 280, locale: lang });
}

export function signOutGoogle(): void {
  (window as unknown as { google?: Gis }).google?.accounts.id.disableAutoSelect();
}
