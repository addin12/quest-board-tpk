// Checks the sandbox in shared mode (`npm run sandbox -- --share`): what a guest can and cannot do. Starts its own server on :4181 with throwaway data, so it never touches .sandbox/. Needs the site data from a build (src/generated/): `npm run build` first.
//   node tests/support/sandbox-guest-check.mjs
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PUB = "http://localhost:4181";
const dir = mkdtempSync(path.join(tmpdir(), "sb-guest-"));
const srv = spawn(process.execPath, ["--conditions=react-server", "--import", "./tests/loader.mjs", "tests/support/sandbox-server.ts"], { env: { ...process.env, PORT: "4181", SANDBOX_PUBLIC_URL: PUB, SANDBOX_DIR: dir } });
let log = "";
srv.stdout.on("data", (d) => (log += d));
srv.stderr.on("data", (d) => (log += d));
for (let i = 0; i < 60 && !log.includes("give guests"); i++) await new Promise((r) => setTimeout(r, 1000));
const key = /key=([0-9a-f]{24})/.exec(log)?.[1];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`);
const get = (p, init) => fetch(PUB + p, { redirect: "manual", ...init });

const sw = await (await get("/__sandbox/")).text();
check("switcher hides the admin account", !sw.includes("owner@example.com"));
check("switcher has no reset and no any-address form", !sw.includes("Reset the sandbox") && !sw.includes("Sign in as this address"));
check("switcher still has the demo accounts", sw.includes("sari@example.com") && sw.includes("baru@example.com"));
const r1 = await get("/__sandbox/enter?email=sari%40example.com&to=%2Fen%2Faccount%2F");
check("guest account one-click works", r1.status === 302);
check("owner without key is refused", (await get("/__sandbox/enter?email=owner%40example.com")).status === 403);
check("owner with a wrong key is refused", (await get("/__sandbox/enter?email=owner%40example.com&key=" + "0".repeat(24))).status === 403);
check("an arbitrary address is refused", (await get("/__sandbox/enter?email=someone%40example.com")).status === 403);
check("reset is refused", (await get("/__sandbox/reset", { method: "POST" })).status === 403);
check("robots header", (await get("/en/")).headers.get("x-robots-tag")?.includes("noindex") === true);
const r2 = await get("/__sandbox/enter?email=owner%40example.com&to=%2Fen%2Fadmin%2F&key=" + key);
const cookie = r2.headers.get("set-cookie")?.split(";")[0] ?? "";
check("owner with the printed key gets in", r2.status === 302 && cookie.startsWith("tpk_session="));
const me = await (await fetch(PUB + "/api/me", { headers: { Cookie: cookie } })).json();
check("that session is the admin", me.admin === true);
// the real form for the owner's address must not leak the link into the guest mailbox
const login = await fetch(PUB + "/api/login/request", { method: "POST", headers: { "Content-Type": "application/json", Origin: PUB }, body: JSON.stringify({ email: "owner@example.com" }) });
const mb = await (await get("/__sandbox/mail")).text();
check("login request for the owner is accepted by the API", login.status === 200);
check("…but its mail is not in the guest mailbox", !mb.includes("owner@example.com") && !mb.includes("#t="));
const l2 = await fetch(PUB + "/api/login/request", { method: "POST", headers: { "Content-Type": "application/json", Origin: PUB }, body: JSON.stringify({ email: "guest1@example.com" }) });
const mb2 = await (await get("/__sandbox/mail")).text();
check("another address's link does appear (the real sign-in flow works)", l2.status === 200 && mb2.includes(PUB + "/en/account/#t="));
check("a write from the old localhost origin is refused while shared", (await fetch(PUB + "/api/login/request", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:4180" }, body: JSON.stringify({ email: "x@example.com" }) })).status >= 400);
srv.kill();
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
