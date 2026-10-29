// The admin page's connection to the backend. Admins sign in like everyone else (an emailed link, on the account page); the
// session cookie goes with every call. Client-side only.
import { call } from "./account-api.ts";
import type { Me } from "./account-api.ts";

export class ApiError extends Error {
  constructor(public code: string, public detail: Record<string, unknown> = {}) {
    super(code);
  }
}

/** One admin call (`action` is one of whoami, queue, review, patch, admin.add, admin.remove, merge, deploy). */
export async function api<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const r = await call<T>("POST", "/admin", { ...body, action });
  if (r.ok) return r.data;
  throw new ApiError(r.status === 401 ? "unauthorized" : r.error, { message: r.message });
}

/** Who is signed in: nobody, an admin, or someone who is not an admin. */
export async function whoami(): Promise<{ state: "out" } | { state: "admin" | "notAdmin"; email: string } | { state: "error" }> {
  const r = await call<Me>("GET", "/me");
  if (r.ok) return { state: r.data.admin ? "admin" : "notAdmin", email: r.data.email };
  return r.status === 401 ? { state: "out" } : { state: "error" };
}

export const signOutSession = (): Promise<unknown> => call("POST", "/logout");
