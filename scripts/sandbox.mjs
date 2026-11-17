// The sandbox: a local copy of the site with the real backend, to try Quest Board by hand before it goes live (tests/support/sandbox-server.ts).
//
//   npm run sandbox                     builds the site (a minute or two), then serves it at http://localhost:4180/__sandbox/
//   npm run sandbox -- --skip-build     serves the site already in out/ (use it when out/ was built by this command)
//   npm run sandbox -- --share          also opens a temporary public link (a free Cloudflare quick tunnel, needs `cloudflared`) for guests
//   PORT=4200 npm run sandbox           another port (the site is built for 4180: only the links in metadata point there)
//
// Nothing here reaches the live site: no Cloudflare credentials, no mail relay. Its data lives in .sandbox/ (git-ignored).
import { execSync, spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const port = process.env.PORT ?? "4180";
const share = process.argv.includes("--share");

/** `cloudflared` from the PATH, or from .sandbox/bin (where a download for this project can sit). */
function findCloudflared() {
  const exe = process.platform === "win32" ? "cloudflared.exe" : "cloudflared";
  const local = path.join(".sandbox", "bin", exe);
  if (existsSync(local)) return local;
  const found = spawnSync(process.platform === "win32" ? "where" : "which", ["cloudflared"], { encoding: "utf8" });
  return found.status === 0 ? found.stdout.split(/\r?\n/)[0].trim() : null;
}

let tunnel = null;
let publicUrl = "";
if (share) {
  const bin = findCloudflared();
  if (!bin) {
    console.error("--share needs cloudflared (free, no account): winget install Cloudflare.cloudflared (Windows), brew install cloudflared (Mac), or put the file in .sandbox/bin/");
    process.exit(1);
  }
  tunnel = spawn(bin, ["tunnel", "--url", `http://localhost:${port}`, "--no-autoupdate"], { stdio: ["ignore", "ignore", "pipe"] });
  publicUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no tunnel address within 60 s")), 60_000);
    tunnel.stderr.on("data", (d) => {
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(d));
      if (m) { clearTimeout(timer); resolve(m[0]); }
    });
    tunnel.on("exit", () => reject(new Error("cloudflared stopped before it gave an address")));
  }).catch((e) => { console.error(String(e.message ?? e)); tunnel?.kill(); process.exit(1); });
}

if (!process.argv.includes("--skip-build")) {
  execSync("npm run build", {
    stdio: "inherit",
    env: { ...process.env, TPK_API_BASE: "", NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`, NEXT_PUBLIC_REPORT_URL: "https://forms.example/report", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "" },
  });
}
// Async (not spawnSync): the tunnel's output must keep being read while the server runs.
const server = spawn(process.execPath, ["--conditions=react-server", "--import", "./tests/loader.mjs", "tests/support/sandbox-server.ts"], { stdio: "inherit", env: { ...process.env, PORT: port, SANDBOX_PUBLIC_URL: publicUrl } });
const stop = () => { tunnel?.kill(); server.kill(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => { tunnel?.kill(); process.exit(code ?? 1); });
