// The build the browser tests run against: demo data, and the settings that switch the admin page and the forms on.
// The addresses are fake; the tests intercept them.
import { execSync } from "node:child_process";

execSync("npm run build", {
  stdio: "inherit",
  env: {
    ...process.env,
    TPK_API_URL: "",
    NEXT_PUBLIC_SITE_URL: "http://localhost:4174",
    NEXT_PUBLIC_GM_FORM_URL: "https://forms.example/gm-profile",
    NEXT_PUBLIC_GAME_FORM_URL: "https://forms.example/game",
    NEXT_PUBLIC_REPORT_URL: "https://forms.example/report",
    NEXT_PUBLIC_ADMIN_API_URL: "http://localhost:4174/__api",
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
  },
});
