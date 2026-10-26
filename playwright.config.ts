import { defineConfig } from "@playwright/test";

// The built site (out/) is served by scripts/preview.mjs, the way Cloudflare Pages serves it. The test build
// (scripts/e2e-build.mjs) uses the demo data and fake form and sign-in settings; the admin page's Google sign-in
// and Sheet script are replaced in each test (tests/support/admin-stubs.ts).
const PORT = 4174;
// The installed Edge locally (no download), Playwright's bundled Chromium on CI.
const CHROMIUM = process.env.PW_CHANNEL || (process.env.CI ? undefined : "msedge");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { channel: CHROMIUM } },
    { name: "firefox", use: { browserName: "firefox" }, testMatch: /public\.spec\.ts/ },
    { name: "webkit", use: { browserName: "webkit" }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: {
    command: "node scripts/e2e-build.mjs && node scripts/preview.mjs",
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/en/`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
