/* eslint-disable @typescript-eslint/no-explicit-any */
// Everything the admin page talks to, replaced for browser tests: Google's sign-in script becomes a button that
// "signs in" with a token the test chooses, and the Sheet's script becomes the REAL Code.gs logic running over an
// in-memory sheet (tests/support/fake-sheet.ts). The page under test is the real built page.
import type { Page } from "@playwright/test";
import { GAME_FORM, GM_FORM, loadScript, makeDeps, makeRow, makeStore, plain } from "./fake-sheet.ts";

export const API_PATH = "/__api";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
/** A token shaped like Google's ID token (the page only reads the email and the expiry out of it). */
export const fakeToken = (email: string, ttlSeconds = 3600) => `${b64({ alg: "none" })}.${b64({ email, exp: Math.floor(Date.now() / 1000) + ttlSeconds })}.sig`;

function emailOf(token: string): string {
  try {
    const p = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return p.exp * 1000 > Date.now() ? String(p.email) : "";
  } catch {
    return "";
  }
}

/** M/D/YYYY the way the Sheet shows a date (its locale is en_US), `days` from now. */
export function sheetDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

const GOOD = { ...GAME_FORM, description: "A longer description of the game that is comfortably more than eighty characters, so that no check complains about it." };

/** Responses a GM could have sent: one clean, one that sounds like a scam, one with an unreadable date, one whose GM isn't approved. */
export function seedBackend() {
  const gm = (n: number, form: Record<string, string>, admin: Record<string, string> = {}) => makeRow("gm", n, form, admin);
  const game = (n: number, form: Record<string, string>, admin: Record<string, string> = {}) => makeRow("game", n, form, admin);
  const store = makeStore(
    [
      game(2, { ...GOOD, date: sheetDate(10), title: "Mercusuar di Pulau Kabut" }),
      game(3, { ...GOOD, date: sheetDate(11), title: "Neon Run", description: "Send me your OTP first, then pay the admin fee to my new account to join. ".repeat(3) }),
      game(4, { ...GOOD, date: "someday", title: "Date Unknown", venueMapsUrl: "https://evil.example/x" }),
      game(5, { ...GOOD, date: sheetDate(12), title: "Naga-naga Hutan Bara", email: "dewi@example.com", cover: "" }),
      game(6, { ...GOOD, date: sheetDate(13), title: "Panen Harapan" }),
    ],
    [
      gm(2, GM_FORM),
      gm(3, { ...GM_FORM, email: "dewi@example.com", name: "Dewi Lestari", whatsapp: "0812-9999-0000", discord: "" }),
    ],
    [{ email: "admin@example.com", addedBy: "owner@example.com", addedAt: "2026-10-01T00:00:00.000Z" }],
  );
  const ctx = loadScript();
  ctx.sync_(store, Date.now()); // ids, slugs and a pending status for every response, as the script does when it first sees them
  const decided = { ReviewedBy: "owner@example.com", ReviewedAt: new Date().toISOString() };
  store.update("game", 6, { Status: "approved", ...decided });
  store.update("gm", 2, { Status: "approved", ...decided });
  const { deps, calls } = makeDeps(store, {}, {
    now: () => Date.now(),
    verify: emailOf,
    deployInfo: () => ({ lastAt: Date.now() - 20 * 60_000, pending: calls.dirty > 0, configured: true }),
  });
  return { ctx, store, deps, calls };
}
export type Backend = ReturnType<typeof seedBackend>;

const GIS = `
window.google = { accounts: { id: {
  initialize: (cfg) => { window.__gis = cfg; },
  renderButton: (el) => { const b = document.createElement("button"); b.type = "button"; b.textContent = "Sign in with Google"; b.onclick = () => window.__gis.callback({ credential: window.__fakeToken }); el.append(b); },
  disableAutoSelect: () => {},
} } };`;

/** Installs both stubs on a page. `token` is what the "Sign in with Google" button hands the page. */
export async function installAdminStubs(page: Page, backend: Backend, token: string) {
  await page.addInitScript((t) => { (window as any).__fakeToken = t; }, token);
  await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({ contentType: "text/javascript", body: GIS }));
  await page.route(`**${API_PATH}`, async (route) => {
    const req = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(plain(backend.ctx.handle_(req, backend.deps))) });
  });
}
