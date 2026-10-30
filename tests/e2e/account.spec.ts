import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { linkFor, newWorld, openLink } from "../support/e2e-world.ts";
import { BUILD_KEY } from "../support/worker-env.ts";

// A Game Master's side against the real backend: sign in by an emailed link, one profile, any number of games, a picture shrunk in the
// browser, edits that go back to review, marking a game full, removing a game, erasing the account. Each test has its own world.

const COLUMN = (title: string) => `SELECT * FROM games WHERE title = '${title}'`;

async function fillProfile(page: Page, name = "Sari Dewanti") {
  await page.getByLabel("Display name", { exact: true }).fill(name);
  await page.getByLabel("Short bio").fill("A GM who likes quiet horror.");
  await page.getByLabel("City", { exact: true }).selectOption("Depok");
  await page.getByLabel("WhatsApp number", { exact: true }).fill("0813-5555-0101");
  await page.getByRole("checkbox", { name: /shown publicly on Quest Board TPK/ }).check();
}

test("signing in: the link in the email opens the account, the token leaves the address bar, and it works once", async ({ page }) => {
  const world = await newWorld(page);
  await page.goto("/en/account/");
  await page.getByLabel("Email address").fill("Sari.Dewanti@Example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByTestId("link-sent")).toContainText("Sari.Dewanti@Example.com");
  const link = await linkFor(world, "sari.dewanti@example.com");
  await openLink(page, link);
  await expect(page.getByTestId("signed-in-as")).toContainText("sari.dewanti@example.com");
  expect(page.url()).not.toContain("#t=");

  await page.context().clearCookies({ name: "tpk_session" });
  await openLink(page, link);
  await expect(page.getByText("That link did not work.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
});

test("one email is one account: the same address typed differently opens the same profile", async ({ page }) => {
  const world = await newWorld(page);
  await world.signInAs("sari.dewanti@gmail.com");
  await page.goto("/en/account/");
  await fillProfile(page);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByTestId("message")).toContainText("Saved.");
  await page.context().clearCookies({ name: "tpk_session" });
  await world.signInAs("SariDewanti+games@gmail.com");
  await page.goto("/en/account/");
  await expect(page.getByText("Sari Dewanti", { exact: true })).toBeVisible();
  expect(await world.sql("SELECT COUNT(*) AS n FROM accounts")).toEqual([{ n: 1 }]);
  expect(await world.sql("SELECT COUNT(*) AS n FROM profiles")).toEqual([{ n: 1 }]);
});

test("profile, then a game with a picture: both wait for review; the picture is shrunk and stored; nothing is public yet", async ({ page }) => {
  const world = await newWorld(page);
  await world.signInAs("sari@example.com");
  await page.goto("/en/account/");
  await expect(page.getByText("Fill in your profile first, then you can add games.")).toBeVisible();
  await fillProfile(page);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByTestId("message")).toContainText("An admin will review it");
  await expect(page.getByTestId("status").first()).toHaveText("Waiting for review");

  await page.getByRole("button", { name: "Add a game" }).click();
  const form = page.getByTestId("game-form");
  await form.getByLabel("Game title").fill("Kabut di Kebun Raya");
  await form.getByLabel("Game system").selectOption("Call of Cthulhu 7e");
  await form.getByLabel("Short description").fill("Penyelidikan horor satu malam di kebun raya.");
  await form.getByLabel("Full description").fill("Lima penyelidik, satu malam, dan sesuatu yang bergerak di antara pepohonan. Karakter siap main disediakan.");
  await form.getByLabel("One-shot").check();
  await form.getByLabel("Online", { exact: true }).check();
  await form.getByLabel("Platform (online games)").fill("Discord");
  await form.getByLabel("Date of the first session").fill(new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10));
  await form.getByLabel("Time zone").selectOption("WIB");
  await form.getByLabel("Seats", { exact: true }).fill("4");
  await form.getByLabel("Play language").selectOption("id");
  await form.getByLabel("Experience level").selectOption("beginner");
  await form.getByRole("checkbox", { name: "Horror", exact: true }).check();
  const png = await sharp({ create: { width: 1600, height: 1600, channels: 3, background: { r: 120, g: 60, b: 40 } } }).png().toBuffer();
  await form.getByLabel("Cover picture").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  await expect(form.getByText("Picture ready")).toBeVisible();
  await form.getByRole("checkbox", { name: /I confirm this information is true/ }).check();
  await form.getByRole("button", { name: "Save game" }).click();

  await expect(page.getByTestId("my-game")).toHaveCount(1);
  await expect(page.getByTestId("my-game")).toContainText("Kabut di Kebun Raya");
  await expect(page.getByTestId("my-game").getByTestId("status")).toHaveText("Waiting for review");
  const [game] = await world.sql(COLUMN("Kabut di Kebun Raya"));
  expect(game.status).toBe("pending");
  expect(game.cover_key).toMatch(/^covers\/[a-z0-9]{16}\.(webp|jpg)$/);
  const stored = await page.evaluate(async (key) => (await fetch(`/api/img/${key}`)).status, game.cover_key);
  expect(stored, "a picture that is not approved is private").toBe(404);
  const pub = await (await page.request.get(`/api/public?key=${BUILD_KEY}`)).json();
  expect(pub.games, "nothing is public before an admin approves").toEqual([]);
});

test("what the server refuses is shown next to the field", async ({ page }) => {
  const world = await newWorld(page);
  await world.signInAs("sari@example.com");
  await page.goto("/en/account/");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Some answers need a fix.")).toBeVisible();
  await expect(page.getByText("Enter a phone number, e.g. 0812-3456-7890.")).toBeVisible();
  await fillProfile(page);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByTestId("message")).toBeVisible();

  await page.getByRole("button", { name: "Add a game" }).click();
  const form = page.getByTestId("game-form");
  await form.getByLabel("Short description").fill("x".repeat(95));
  await form.getByRole("button", { name: "Save game" }).click();
  await expect(form.getByText("Too long: up to 80 characters.")).toBeVisible();
  await expect(form.getByText("Fill this in.").first()).toBeVisible();
  expect(await world.sql("SELECT COUNT(*) AS n FROM games")).toEqual([{ n: 0 }]);
});

test("editing an approved game sends it back to review; saving the same thing again changes nothing", async ({ page }) => {
  const world = await newWorld(page, { seed: true });
  await world.signInAs("raka@example.com");
  await page.goto("/en/account/");
  await expect(page.getByTestId("my-game")).toHaveCount(4);
  const panen = page.getByTestId("my-game").filter({ hasText: "Panen Harapan" });
  await expect(panen.getByTestId("status")).toHaveText("Approved");

  await panen.getByRole("button", { name: "Edit" }).click();
  await page.getByTestId("game-form").getByRole("button", { name: "Save game" }).click();
  await expect(page.getByTestId("message")).toContainText("Nothing changed.");
  expect((await world.sql(COLUMN("Panen Harapan")))[0].status).toBe("approved");

  await page.getByTestId("my-game").filter({ hasText: "Panen Harapan" }).getByRole("button", { name: "Edit" }).click();
  await page.getByTestId("game-form").getByLabel("Seats", { exact: true }).fill("6");
  await page.getByTestId("game-form").getByRole("button", { name: "Save game" }).click();
  await expect(page.getByTestId("message")).toContainText("An admin will review it");
  await expect(page.getByTestId("my-game").filter({ hasText: "Panen Harapan" }).getByTestId("status")).toHaveText("Waiting for review");
  expect((await world.sql(COLUMN("Panen Harapan")))[0].seats).toBe(6);
});

test("a GM marks a game full without a review, reopens it, and removes another with a confirmation", async ({ page }) => {
  const world = await newWorld(page, { seed: true });
  await world.signInAs("raka@example.com");
  await page.goto("/en/account/");
  const panen = () => page.getByTestId("my-game").filter({ hasText: "Panen Harapan" });
  await panen().getByRole("button", { name: "Mark as full" }).click();
  await expect(panen().getByText("Full", { exact: true })).toBeVisible();
  expect((await world.sql(COLUMN("Panen Harapan")))[0]).toMatchObject({ full: 1, status: "approved" });
  const pub = await (await page.request.get(`/api/public?key=${BUILD_KEY}`)).json();
  expect(pub.games.find((g: { title: string }) => g.title === "Panen Harapan").full).toBe(true);
  await panen().getByRole("button", { name: "Reopen" }).click();
  await expect(panen().getByRole("button", { name: "Mark as full" })).toBeVisible();

  const neon = page.getByTestId("my-game").filter({ hasText: "Neon Run" });
  await neon.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Remove “Neon Run” from the site?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("my-game")).toHaveCount(4);
  await neon.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Yes, remove it" }).click();
  await expect(page.getByTestId("my-game")).toHaveCount(3);
  expect((await world.sql(COLUMN("Neon Run")))[0].removed).toBe(1);
});

test("a GM can erase their account: profile, games and picture go, and they are signed out", async ({ page }) => {
  const world = await newWorld(page, { seed: true });
  await world.signInAs("raka@example.com");
  await page.goto("/en/account/");
  await page.getByRole("button", { name: "Erase my account and data" }).click();
  await page.getByRole("button", { name: "Yes, erase everything" }).click();
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
  expect(await world.sql("SELECT COUNT(*) AS n FROM profiles WHERE name = 'Raka Pratama'")).toEqual([{ n: 0 }]);
  expect(await world.sql("SELECT COUNT(*) AS n FROM accounts WHERE email = 'raka@example.com'")).toEqual([{ n: 0 }]);
  expect(await world.sql("SELECT COUNT(*) AS n FROM games WHERE title = 'Panen Harapan'")).toEqual([{ n: 0 }]);
});

test("the whole journey: a GM signs up, an admin approves, and the listing is in the public data the site is built from", async ({ page }) => {
  const world = await newWorld(page, { seed: true });
  await world.signInAs("raka@example.com");
  await page.goto("/en/account/");
  await page.getByTestId("my-game").filter({ hasText: "Mercusuar di Pulau Kabut" }).waitFor();
  await page.context().clearCookies({ name: "tpk_session" });
  await world.signInAs("admin@example.com");
  await page.goto("/en/admin/");
  await page.getByTestId("admin-row").filter({ hasText: "Mercusuar di Pulau Kabut" }).click();
  await page.getByTestId("approve").click();
  await expect.poll(() => world.status("games", "Mercusuar di Pulau Kabut")).toBe("approved");
  const pub = await (await page.request.get(`/api/public?key=${BUILD_KEY}`)).json();
  expect(pub.games.map((g: { title: string }) => g.title).sort()).toEqual(["Mercusuar di Pulau Kabut", "Panen Harapan"]);
  expect(JSON.stringify(pub)).not.toContain("example.com");
  const cover = pub.games.find((g: { title: string }) => g.title === "Mercusuar di Pulau Kabut").coverId as string;
  expect((await page.request.get(`/api/img/${cover}`)).status(), "an approved picture is public").toBe(200);
});

test("the account page is kept out of search results and has no accessibility problems", async ({ page }) => {
  const world = await newWorld(page, { seed: true });
  await page.goto("/en/account/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const check = async () => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(await check()).toEqual([]);
  await world.signInAs("raka@example.com");
  await page.goto("/en/account/");
  await expect(page.getByTestId("my-game")).toHaveCount(4);
  expect(await check()).toEqual([]);
  await page.getByRole("button", { name: "Add a game" }).click();
  await expect(page.getByTestId("game-form")).toBeVisible();
  expect(await check()).toEqual([]);
});

test("in Bahasa Indonesia, on a phone, nothing scrolls sideways", async ({ page }) => {
  const world = await newWorld(page, { seed: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await world.signInAs("raka@example.com");
  await page.goto("/id/account/");
  await expect(page.getByRole("heading", { name: "Profil Game Master-mu" })).toBeVisible();
  await page.getByRole("button", { name: "Tambah game" }).click();
  await expect(page.getByTestId("game-form")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
