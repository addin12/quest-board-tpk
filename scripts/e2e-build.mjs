// The build the browser tests run against: demo data and a fake site address. The /api backend is the real code on an in-memory
// database (tests/support/test-server.ts).
import { execSync } from "node:child_process";

execSync("npm run build", {
  stdio: "inherit",
  env: {
    ...process.env,
    TPK_API_BASE: "",
    NEXT_PUBLIC_SITE_URL: "http://localhost:4174",
    NEXT_PUBLIC_REPORT_URL: "https://forms.example/report",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
  },
});
