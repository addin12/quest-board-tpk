import { defineConfig } from "@playwright/test";

// The built site (out/) is served, with the REAL backend under /api (worker/src, on an in-memory database), by tests/support/test-server.ts.
// The test build (scripts/e2e-build.mjs) uses the demo data. Each test makes its own world (database, bucket, mailbox, clock).
const PORT = 4174;
// The installed Edge locally (no download), Playwright's bundled Chromium on CI.
const CHROMIUM = process.env.PW_CHANNEL || (process.env.CI ? undefined : "msedge");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // Headless Firefox on Windows hangs (graphics compositor) when many windows run at once; two workers is steady everywhere.
  workers: 2,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { channel: CHROMIUM } },
    { name: "firefox", use: { browserName: "firefox" }, testMatch: /public\.spec\.ts/ },
    { name: "webkit", use: { browserName: "webkit" }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: {
    command: "node scripts/e2e-build.mjs && node --conditions=react-server --import ./tests/loader.mjs tests/support/test-server.ts",
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/en/`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
