/* eslint-disable @typescript-eslint/no-explicit-any */
// The Sheet's script (apps-script/Code.gs) loaded in a sandbox, with an in-memory sheet and fake services, so unit
// tests and the browser tests run the real backend logic without Google. The sandbox has no URL class and no fetch,
// like Apps Script itself.
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function loadScript(): any {
  const ctx: any = vm.createContext({ console });
  vm.runInContext(readFileSync(new URL("../../apps-script/Code.gs", import.meta.url), "utf8"), ctx);
  return ctx;
}

export const plain = <T = any>(v: unknown): T => JSON.parse(JSON.stringify(v));
export const constant = <T = any>(ctx: any, name: string): T => plain(vm.runInContext(name, ctx));

const ctx = loadScript();
export const GAME_COLS = constant<Record<string, string>>(ctx, "GAME_COLUMNS");
export const GM_COLS = constant<Record<string, string>>(ctx, "GM_COLUMNS");
export const ADMIN_COLS = constant<string[]>(ctx, "ADMIN_COLUMNS");

export type Row = { rowNum: number; cells: Record<string, any>; display: Record<string, string> };

export function makeRow(kind: "game" | "gm", rowNum: number, form: Record<string, string>, admin: Record<string, string> = {}): Row {
  const cols = kind === "game" ? GAME_COLS : GM_COLS;
  const cells: Record<string, any> = { Timestamp: new Date("2026-10-01T03:00:00Z"), "Email Address": form.email ?? "gm@example.com" };
  const display: Record<string, string> = { Timestamp: "10/1/2026 10:00:00", "Email Address": cells["Email Address"] };
  for (const [field, header] of Object.entries(cols)) {
    const v = form[field] ?? "";
    cells[header] = v;
    display[header] = v;
  }
  for (const h of ADMIN_COLS) { cells[h] = admin[h] ?? ""; display[h] = admin[h] ?? ""; }
  return { rowNum, cells, display };
}

export const GM_FORM = { name: "Raka Pratama", bio: "Horror GM from Depok.", city: "Depok", systems: "Call of Cthulhu, Mothership", whatsapp: "0812-3456-7890", discord: "@raka_gm", consent: "I agree" };
export const GAME_FORM = {
  title: "Mercusuar di Pulau Kabut", system: "Call of Cthulhu", summary: "A horror one-shot on a foggy island.", description: "Long description.", format: "One-shot",
  genres: "Horror, Eldritch horror", styles: "Roleplay-heavy", locationType: "In person", city: "Depok", venueName: "Kumu Ground Coffee",
  venueMapsUrl: "https://maps.app.goo.gl/Kumu", date: "10/12/2026", time: "7:00:00 PM", zone: "WIB", price: "75.000", seats: "5", language: "Both (Indonesian & English)",
  level: "Beginner friendly", minAge: "16", cover: "https://drive.google.com/open?id=1AbC_dEfGhIjKlMn-op", consent: "I agree",
};

export function makeStore(games: Row[], gms: Row[], admins: any[] = []) {
  const tables: Record<string, Row[]> = { game: games, gm: gms };
  const shared: Record<string, boolean> = {};
  const logs: string[][] = [];
  return {
    shared,
    logs,
    headers: (kind: string) => Object.keys(tables[kind][0]?.cells ?? { Timestamp: 1, "Email Address": 1 }),
    load: (kind: string) => tables[kind].map((r) => ({ rowNum: r.rowNum, cells: { ...r.cells }, display: { ...r.display } })),
    update: (kind: string, rowNum: number, patch: Record<string, string>) => {
      const row = tables[kind].find((r) => r.rowNum === rowNum)!;
      for (const [h, v] of Object.entries(patch)) { row.cells[h] = v; row.display[h] = String(v); }
    },
    admins: () => admins.map((a) => ({ ...a })),
    addAdmin: (email: string, by: string, at: string) => { admins.push({ email, addedBy: by, addedAt: at }); },
    removeAdmin: (email: string) => { const i = admins.findIndex((a) => a.email === email); if (i >= 0) admins.splice(i, 1); },
    shareFile: (id: string, on: boolean) => { shared[id] = on; },
    log: (rows: string[][]) => { logs.push(...rows); },
  };
}

export function makeDeps(store: ReturnType<typeof makeStore>, tokens: Record<string, string> = { owner: "owner@example.com", admin: "admin@example.com", guest: "guest@example.com" }, over: Record<string, any> = {}) {
  const calls = { dirty: 0, deploys: 0, notified: [] as any[] };
  const deps = {
    now: () => Date.parse("2026-10-05T00:00:00Z"),
    verify: (t: string) => tokens[t] ?? "",
    owner: () => "owner@example.com",
    store,
    notify: (status: string, info: any) => calls.notified.push({ status, kind: info.kind, title: info.record.title ?? info.record.name, reason: info.reason }),
    markDirty: () => { calls.dirty++; },
    deployNow: () => { calls.deploys++; return true; },
    deployInfo: () => ({ lastAt: null, pending: false, configured: true }),
    ...over,
  };
  return { deps, calls };
}

export function fixture() {
  const store = makeStore([makeRow("game", 2, GAME_FORM)], [makeRow("gm", 2, GM_FORM)], [{ email: "admin@example.com", addedBy: "owner@example.com", addedAt: "2026-10-01T00:00:00.000Z" }]);
  return { store, ...makeDeps(store) };
}
export const call = (deps: any, req: any) => plain(ctx.handle_(req, deps));

