// The sandbox: a local copy of the site with the real backend, to try Quest Board by hand before it goes live (tests/support/sandbox-server.ts).
//
//   npm run sandbox                     builds the site (a minute or two), then serves it at http://localhost:4180/__sandbox/
//   npm run sandbox -- --skip-build     serves the site already in out/ (use it when out/ was built by this command)
//   PORT=4200 npm run sandbox           another port (the site is built for 4180: only the links in metadata point there)
//
// Nothing here reaches the live site: no Cloudflare credentials, no mail relay. Its data lives in .sandbox/ (git-ignored).
import { execSync, spawnSync } from "node:child_process";

const port = process.env.PORT ?? "4180";
if (!process.argv.includes("--skip-build")) {
  execSync("npm run build", {
    stdio: "inherit",
    env: { ...process.env, TPK_API_BASE: "", NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`, NEXT_PUBLIC_REPORT_URL: "https://forms.example/report", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "" },
  });
}
const run = spawnSync(process.execPath, ["--conditions=react-server", "--import", "./tests/loader.mjs", "tests/support/sandbox-server.ts"], { stdio: "inherit", env: { ...process.env, PORT: port } });
process.exit(run.status ?? 1);
