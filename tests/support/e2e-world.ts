/* eslint-disable @typescript-eslint/no-explicit-any */
// A test's own copy of the backend (see tests/support/test-server.ts): a fresh database, bucket, mailbox and clock, and helpers
// to look into them and to sign in without waiting for an email.
import type { Page } from "@playwright/test";

const BASE = "http://localhost:4174";

export type Mail = { to: string; subject: string; body: string };

export async function newWorld(page: Page, options: { seed?: boolean; hook?: boolean } = {}) {
  const { id } = await (await page.request.post("/__test/new")).json();
  await page.context().addCookies([{ name: "tpk_world", value: id, url: BASE }]);
  const post = async (path: string, body: object = {}) => (await page.request.post(`/__test/${path}`, { data: body })).json();
  if (options.seed) await post("seed");
  await post("hook", { on: Boolean(options.hook) });

  return {
    state: async (): Promise<{ mails: Mail[]; hooks: number; dirty: boolean; lastDeploy: string }> => (await page.request.get("/__test/state")).json(),
    /** Rows of a SELECT on the world's database. */
    sql: async (sql: string, ...args: unknown[]): Promise<any[]> => (await post("sql", { sql, args })).rows,
    exec: (sql: string, ...args: unknown[]) => post("exec", { sql, args }),
    clock: (ms: number) => post("clock", { ms }),
    hook: (on: boolean) => post("hook", { on }),
    /** Signs the browser in as `email` (the same session an emailed link gives). */
    signInAs: async (email: string) => {
      const { cookie } = await post("session", { email });
      await page.context().addCookies([{ name: "tpk_session", value: cookie, url: BASE }]);
    },
    status: async (table: "games" | "profiles", titleOrName: string): Promise<string | undefined> =>
      (await post("sql", { sql: `SELECT status FROM ${table} WHERE ${table === "games" ? "title" : "name"} = ?`, args: [titleOrName] })).rows[0]?.status,
  };
}
export type World = Awaited<ReturnType<typeof newWorld>>;

/** The sign-in link inside the newest email to `to`. */
export async function linkFor(world: World, to: string): Promise<string> {
  const { mails } = await world.state();
  const mail = [...mails].reverse().find((m) => m.to === to);
  if (!mail) throw new Error(`no mail to ${to}`);
  return /https?:\/\/\S+#t=[A-Za-z0-9_-]+/.exec(mail.body)![0];
}

/** Opens a sign-in link the way an email does: in a page that is not already on the account address (a change of only the #fragment would not reload it). */
export async function openLink(page: Page, link: string): Promise<void> {
  await page.goto("/en/");
  await page.goto(link);
}
