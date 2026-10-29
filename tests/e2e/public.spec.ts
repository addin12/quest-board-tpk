import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The public site against the demo data (data/sample.json), as a player uses it.
const GAME = "/en/games/mercusuar-di-pulau-kabut-0m01/";
const PAGES = ["/en/", "/en/games/", GAME, "/en/gm/raka-pratama-0r01/", "/en/gms/", "/en/how-it-works/", "/en/list-your-game/", "/id/", "/id/games/", "/id/list-your-game/", "/en/games/a-game-that-ended-9z01/", "/id/gm/a-gm-who-left-9z02/", "/en/games/doskvol-setelah-gelap-0d02/"];

test("find a game, follow the links, message the GM on WhatsApp", async ({ page, context }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en\/$/);
  await page.getByRole("link", { name: "Games", exact: true }).first().click();
  await expect(page).toHaveURL(/\/en\/games\/$/);
  await expect(page).toHaveTitle(/Find a game/); // the title survives following a link (scripts/fix-export.mjs)
  await page.getByRole("link", { name: /Mercusuar di Pulau Kabut/ }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mercusuar di Pulau Kabut");
  await expect(page).toHaveTitle(/Mercusuar di Pulau Kabut/);

  expect(await page.content(), "the GM's number is not written plainly into the page").not.toContain("62811000000001");
  await context.route("https://wa.me/**", (route) => route.fulfill({ contentType: "text/html", body: "chat" }));
  const popup = context.waitForEvent("page");
  await page.getByTestId("contact-whatsapp").click();
  const chat = await popup;
  await chat.waitForURL(/wa\.me/);
  const url = new URL(chat.url());
  expect(url.pathname).toBe("/62811000000001");
  expect(url.searchParams.get("text")).toMatch(/^Hi Raka Pratama, I found “Mercusuar di Pulau Kabut” on Quest Board TPK \(.* WIB\)\. Is there still a seat\?$/);
});

test("the search on the home page leads to the games that match", async ({ page }) => {
  await page.goto("/en/");
  await page.getByLabel("Search games").fill("kumu");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/en\/games\/\?q=kumu/);
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game");
  await expect(page.getByTestId("games-list").getByRole("listitem")).toHaveCount(1);
});

test("filters narrow the list, keep the address, and can be cleared", async ({ page }) => {
  await page.goto("/en/games/");
  await expect(page.getByTestId("games-count")).toHaveText("Showing 10 games");
  await page.getByRole("button", { name: /Filters/ }).click();
  await page.getByLabel("Where", { exact: true }).selectOption("online");
  await expect(page).toHaveURL(/where=online/);
  await expect(page.getByTestId("games-count")).toHaveText("Showing 7 games");
  await page.getByLabel("Experience level").selectOption("beginner");
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game");

  await page.reload();
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game"); // read back from the address
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByTestId("games-count")).toHaveText("Showing 10 games");
  await expect(page).toHaveURL(/\/en\/games\/$/);

  await page.getByLabel("Search", { exact: true }).fill("zzzzzz");
  await expect(page.getByText("No games match these filters")).toBeVisible();
});

test("the language toggle keeps the page and its filters", async ({ page }) => {
  await page.goto("/en/games/?where=online");
  await page.getByRole("navigation", { name: "Language" }).getByRole("link", { name: "id" }).click();
  await expect(page).toHaveURL(/\/id\/games\/\?where=online/);
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cari game");
  await expect(page.getByTestId("games-count")).toHaveText("Menampilkan 7 game");
});

test("a GM's profile lists their games and both ways to reach them", async ({ page, context, browserName }) => {
  // Headless Chromium on Linux refuses clipboard writes unless allowed; Firefox and WebKit have no such permission name.
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/gm/raka-pratama-0r01/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Raka Pratama");
  await expect(page.getByTestId("contact-whatsapp")).toBeVisible();
  await expect(page.getByTestId("contact-discord")).toContainText("raka_gm");
  await page.getByRole("button", { name: "Copy Discord username" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied" })).toBeVisible();
  await expect(page.getByTestId("games-list").or(page.getByRole("heading", { name: "Open games" }))).toBeVisible();
  await page.goto("/en/gm/bima-anggraini-0b01/");
  await expect(page.getByRole("link", { name: "Open Discord invite" })).toHaveAttribute("href", "https://discord.gg/sampleinvite");
});

test("the list-your-game page sends GMs to the account page, and the report link is shown", async ({ page }) => {
  await page.goto("/en/list-your-game/");
  await expect(page.getByRole("link", { name: "Sign in and start" })).toHaveAttribute("href", "/en/account/");
  await expect(page.getByRole("link", { name: "Add your game" })).toHaveAttribute("href", "/en/account/");
  await expect(page.getByText("Your email address is never shown.")).toBeVisible();
  await page.goto("/en/games/mercusuar-di-pulau-kabut-0m01/");
  await expect(page.getByRole("link", { name: /Report this listing/ })).toHaveAttribute("href", "https://forms.example/report");
});

test("an address that is not a page gets the 404 page, in both languages", async ({ page }) => {
  const res = await page.goto("/nope/");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Natural 1.");
  await expect(page.getByRole("link", { name: "Back to the tavern" })).toHaveAttribute("href", "/en/");
});

test("a game marked full says so, sinks to the end of the list, and can still be messaged", async ({ page }) => {
  await page.goto("/en/games/");
  const titles = await page.locator("main a h2").allInnerTexts();
  expect(titles.at(-1)).toBe("Doskvol Setelah Gelap");
  await expect(page.locator("main li").filter({ hasText: "Doskvol Setelah Gelap" })).toContainText("Full");

  await page.goto("/en/games/doskvol-setelah-gelap-0d02/");
  await expect(page.getByTestId("full-chip")).toBeVisible();
  await expect(page.getByTestId("full-note")).toContainText("This game is full");
  await expect(page.getByTestId("contact-whatsapp")).toBeVisible();
  expect((await page.locator('script[type="application/ld+json"]').allInnerTexts()).join("")).toContain("SoldOut");

  await page.goto("/id/games/doskvol-setelah-gelap-0d02/");
  await expect(page.getByTestId("full-note")).toContainText("Game ini sudah penuh");
});

test("the address of a listing that is no longer live shows a notice: no details, no way to contact, not for search engines", async ({ page, request }) => {
  await page.goto("/en/games/a-game-that-ended-9z01/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This game is no longer listed.");
  await expect(page.getByTestId("contact-whatsapp")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Report this listing/ })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByRole("link", { name: "See the games" }).click();
  await expect(page).toHaveURL(/\/en\/games\/$/);

  await page.goto("/id/gm/a-gm-who-left-9z02/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Game Master ini tidak tampil.");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("9z01");
  expect(sitemap).not.toContain("9z02");
});

test("search engines get a sitemap with both languages and structured data without any contact details", async ({ page, request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: http://localhost:4174/sitemap.xml");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("http://localhost:4174/en/games/mercusuar-di-pulau-kabut-0m01/");
  expect(sitemap).toContain("http://localhost:4174/id/games/mercusuar-di-pulau-kabut-0m01/");
  expect(sitemap).not.toContain("/admin");

  await page.goto(GAME);
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = blocks.flatMap((b) => [JSON.parse(b)].flat().map((d: { "@type": string }) => d["@type"]));
  expect(types).toEqual(expect.arrayContaining(["Event", "BreadcrumbList"]));
  for (const b of blocks) expect(b).not.toMatch(/62811|wa\.me|@example|discord/i);
  await expect(page.locator('link[rel="alternate"][hreflang="id"]')).toHaveAttribute("href", "http://localhost:4174/id/games/mercusuar-di-pulau-kabut-0m01/");
});

test("light, dark and automatic: the choice is remembered", async ({ page }) => {
  await page.goto("/en/");
  await page.getByRole("button", { name: /^Theme: Automatic/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: /^Theme: Parchment/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

for (const path of PAGES) {
  test(`${path}: no failed requests, no console errors, no sideways scrolling on a phone`, async ({ page }) => {
    const bad: string[] = [];
    page.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    page.on("console", (m) => { if (m.type() === "error") bad.push(`console: ${m.text()}`); });
    page.on("pageerror", (e) => bad.push(`error: ${e.message}`));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path, { waitUntil: "networkidle" });
    expect(bad).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}

for (const scheme of ["light", "dark"] as const) {
  for (const path of PAGES) {
    test(`${path}: accessibility check (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path, { waitUntil: "networkidle" });
      expect(await axe(page)).toEqual([]);
    });
  }
}
