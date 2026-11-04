import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SYSTEMS } from "../../src/lib/systems.ts";

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
  expect(url.searchParams.get("text")).toMatch(/^Hi Raka Pratama, I found “Mercusuar di Pulau Kabut” on Quest Board \(.* WIB\)\. Is there still a seat\?$/);
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
  await expect(page.locator("[data-ready]")).toBeAttached(); // the page's scripts have run; a tap before that does nothing
  await expect(page.getByTestId("games-count")).toHaveText("Showing 18 games");
  await page.getByRole("button", { name: /Filters/ }).click();
  await page.getByLabel("Where", { exact: true }).selectOption("online");
  await expect(page).toHaveURL(/where=online/);
  await expect(page.getByTestId("games-count")).toHaveText("Showing 12 games");
  await page.getByLabel("Experience level").selectOption("beginner");
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game");

  await page.reload();
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game"); // read back from the address
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByTestId("games-count")).toHaveText("Showing 18 games");
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
  await expect(page.getByTestId("games-count")).toHaveText("Menampilkan 12 game");
});

test("a GM's profile lists their games and both ways to reach them", async ({ page, context, browserName }) => {
  // Headless Chromium on Linux refuses clipboard writes unless allowed; Firefox and WebKit have no such permission name.
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/gm/raka-pratama-0r01/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Raka Pratama");
  await expect(page.getByTestId("contact-whatsapp")).toBeVisible();
  await expect(page.getByTestId("contact-discord")).toContainText("raka_gm");
  await expect(page.getByTestId("contact-instagram")).toHaveAttribute("href", "https://www.instagram.com/raka.plays/");
  await expect(page.getByTestId("contact-instagram")).toContainText("raka.plays");
  await page.getByRole("button", { name: "Copy Discord username" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied" })).toBeVisible();
  await expect(page.getByTestId("games-list").or(page.getByRole("heading", { name: "Open games" }))).toBeVisible();
  await page.goto("/en/gm/bima-anggraini-0b01/");
  await expect(page.getByRole("link", { name: "Open Discord invite" })).toHaveAttribute("href", "https://discord.gg/sampleinvite");
  await expect(page.getByTestId("contact-instagram")).toHaveCount(0); // optional: a GM without one shows no button
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

test("the list shows nine games a page, with a pager that keeps the address", async ({ page }) => {
  await page.goto("/en/games/");
  await expect(page.locator("[data-ready]")).toBeAttached(); // a click before the page's scripts run does nothing
  const list = page.getByTestId("games-list").getByRole("listitem");
  await expect(list).toHaveCount(9);
  await expect(page.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
  await page.getByRole("button", { name: "Page 2" }).click();
  await expect(page).toHaveURL(/\?page=2$/);
  await expect(page.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  await page.goBack(); // moving to a page is a history step, so Back returns to the page before
  await expect(page.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(page.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  await expect(list).toHaveCount(9);
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page"); // read back from the address
  await page.getByRole("button", { name: /Filters/ }).click();
  await page.getByLabel("Where", { exact: true }).selectOption("in_person");
  await expect(page.getByTestId("games-count")).toHaveText("Showing 6 games"); // a filter sends the list back to page 1, and 6 fit on one
  await expect(page.getByTestId("games-pager")).toHaveCount(0);
  await page.goto("/id/games/?page=99");
  await expect(page.getByRole("button", { name: "Halaman 2" })).toHaveAttribute("aria-current", "page"); // past the end shows the last page
  await expect(page.getByRole("button", { name: "Sebelumnya" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Berikutnya" })).toBeDisabled();
  await page.getByRole("button", { name: "Halaman 1" }).click();
  await page.getByRole("button", { name: /Filter/ }).click();
  await page.getByLabel("Tempat", { exact: true }).selectOption("online");
  await expect(page.getByTestId("games-count")).toHaveText("Menampilkan 12 game");
  await expect(page.getByRole("button", { name: "Halaman 2" })).toBeVisible(); // 12 online games are two pages
  await page.getByRole("button", { name: "Halaman 2" }).click();
  await expect(page.getByTestId("games-list").getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "Hapus filter" }).click();
  await expect(page.getByTestId("games-count")).toHaveText("Menampilkan 18 game"); // clearing the filters also returns to page 1
  await expect(page.getByRole("button", { name: "Halaman 1" })).toHaveAttribute("aria-current", "page");
  expect(new URL(page.url()).search).toBe("");
});

test("an address that filters or pages the list does not show the unfiltered list first", async ({ page }) => {
  await page.route("**/_next/static/**/*.js", async (route) => { await new Promise((r) => setTimeout(r, 1000)); await route.continue(); }); // the page is drawn before it can read its address
  const shown = () => page.evaluate(() => getComputedStyle(document.querySelector("[data-late]")!).visibility);
  await page.goto("/en/games/?system=Cairn%202e", { waitUntil: "domcontentloaded" });
  expect(await shown()).toBe("hidden");
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game");
  expect(await shown()).toBe("visible");
  await page.goto("/en/games/", { waitUntil: "domcontentloaded" });
  expect(await shown(), "no query, nothing to wait for").toBe("visible");
});

test("the browse pages list every system, genre, style and mechanic and lead into the filtered list", async ({ page }) => {
  await page.goto("/en/");
  await page.getByRole("link", { name: `All ${SYSTEMS.length} game systems`, exact: true }).click(); // the button; the Browse tile above it has the same words in a longer name
  await expect(page).toHaveURL(/\/en\/systems\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Game systems");
  await expect(page.getByRole("link", { name: /Nimble 5e/ })).toContainText("0 games");
  const ld = (await page.locator('script[type="application/ld+json"]').allInnerTexts()).join("");
  expect(ld).toContain("BreadcrumbList");
  await page.getByRole("link", { name: /Cairn 2e/ }).click();
  await expect(page).toHaveURL(/system=Cairn%202e/);
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game");

  for (const [path, title] of [["genres", "Genres"], ["styles", "Play styles"], ["mechanics", "Game mechanics"]]) {
    await page.goto(`/en/${path}/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  }
  await page.goto("/en/mechanics/");
  await page.getByRole("link", { name: /Fate dice/ }).click();
  await expect(page).toHaveURL(/mechanic=fate-dice/);
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game");
  await expect(page.getByTestId("games-list")).toContainText("Kapal Hantu Kapten Jenaka");
});

test("the systems page can be searched, and the search stays in the address", async ({ page }) => {
  await page.goto("/en/systems/");
  await expect(page.locator("[data-ready]")).toBeAttached(); // typing before the page's scripts run is lost
  const visible = page.locator("#browse-tiles [data-name]:not([hidden])");
  const all = await visible.count();
  expect(all).toBe(SYSTEMS.length);
  await page.getByLabel("Find a system").fill("cairn");
  await expect(page.getByTestId("tile-count")).toHaveText(`Showing 2 of ${SYSTEMS.length}`);
  await expect(visible).toHaveCount(2);
  await expect(page).toHaveURL(/\/en\/systems\/\?q=cairn$/);
  await page.getByLabel("Find a system").fill("mork"); // accents do not matter: Mörk Borg
  await expect(visible).toHaveCount(1);
  await page.getByLabel("Find a system").fill("zzzz");
  await expect(page.getByTestId("tile-count")).toHaveText("No match. Try another word.");
  await page.getByLabel("Find a system").fill("");
  await expect(visible).toHaveCount(SYSTEMS.length);
  await page.goto("/id/systems/?q=shadowrun");
  await expect(page.getByTestId("tile-count")).toHaveText(`Menampilkan 4 dari ${SYSTEMS.length}`); // read back from the address
  await expect(page.getByText(/Pilih “Other”/)).toBeVisible();
});

test("on a phone the filters are a sheet, and the header slides away going down and back going up", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/games/");
  await expect(page.locator("[data-ready]")).toBeAttached();
  await page.getByRole("button", { name: /Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Where", { exact: true }).selectOption("online");
  await expect(sheet.getByRole("button", { name: "Show 12 games" })).toBeVisible(); // the button says what the filters leave
  await page.keyboard.press("Escape"); // a native modal dialog: Escape closes it
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId("games-count")).toHaveText("Showing 12 games");
  await page.getByRole("button", { name: /Filters/ }).click();
  await sheet.getByRole("button", { name: "Show 12 games" }).click();
  await expect(sheet).toBeHidden();

  const top = () => page.locator("header").evaluate((el) => el.getBoundingClientRect().top);
  expect(await top()).toBe(0);
  await page.mouse.wheel(0, 900);
  await expect.poll(top).toBeLessThan(-40); // gone while reading downwards
  await page.mouse.wheel(0, -200);
  await expect.poll(top).toBe(0); // back as soon as the reader scrolls up
});

test("with no match the empty state offers the way out, and people who ask for less motion get none", async ({ page, browser }) => {
  await page.goto("/en/games/?q=zzzzzz");
  await expect(page.getByText("No games match these filters")).toBeVisible();
  await page.getByRole("main").getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page.getByTestId("games-count")).toHaveText("Showing 18 games");

  const calm = await browser.newContext({ reducedMotion: "reduce" });
  const calmPage = await calm.newPage();
  await calmPage.goto(new URL("/en/", page.url()).href);
  const duration = await calmPage.getByRole("link", { name: "List your game" }).first().evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
  expect(duration, "state changes are instant").toBeLessThan(0.001);
  await calm.close();
});

test("the system filter has a search box inside it: type, pick, and go back to Any", async ({ page }) => {
  await page.goto("/en/games/");
  await expect(page.locator("[data-ready]")).toBeAttached();
  await page.getByRole("button", { name: /Filters/ }).click();
  const system = page.getByLabel("Game system", { exact: true });
  await expect(system).toHaveValue("Any");
  await system.fill("cairn");
  const list = page.getByRole("listbox", { name: "Choices for Game system" });
  await expect(list.getByRole("option")).toHaveCount(1); // only the systems with listed games are offered, here Cairn 2e
  await list.getByRole("option", { name: "Cairn 2e" }).click();
  await expect(page).toHaveURL(/system=Cairn\+2e/);
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game");
  await system.click();
  await system.press("ArrowDown"); // from "Any" to the first system, then Enter would pick it; Escape closes without a change
  await system.press("Escape");
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game");
  await system.fill("");
  await list.getByRole("option", { name: "Any" }).click();
  await expect(page.getByTestId("games-count")).toHaveText("Showing 18 games");
  await expect(page).toHaveURL(/\/en\/games\/$/);

  // genres, play styles and mechanics are searchable the same way, and show their translated names
  for (const [label, typed, option, param] of [["Genre", "horr", "Horror", "genre=horror"], ["Play style", "tact", "Tactical", "style=tactical"], ["Mechanic", "d100", "Percentile (d100)", "mechanic=d100"]] as const) {
    const field = page.getByLabel(label, { exact: true });
    await field.fill(typed);
    await page.getByRole("listbox", { name: `Choices for ${label}` }).getByRole("option", { name: option, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(param.replace(/[()]/g, "\\$&")));
    await expect(field).toHaveValue(option);
    await field.click();
    await page.getByRole("listbox", { name: `Choices for ${label}` }).getByRole("option", { name: "Any" }).click();
    await expect(page).toHaveURL(/\/en\/games\/$/);
  }
});

test("every search box understands the short names: dnd, d&d, science fiction", async ({ page }) => {
  // the systems page
  await page.goto("/en/systems/");
  await expect(page.locator("[data-ready]")).toBeAttached();
  await page.getByLabel("Find a system").fill("DnD");
  await expect(page.locator("#browse-tiles [data-name]:not([hidden])").filter({ hasText: "Dungeons & Dragons 5.5e 2024" })).toHaveCount(1);
  await page.getByLabel("Find a system").fill("d&d 2014");
  await expect(page.locator("#browse-tiles [data-name]:not([hidden])")).toHaveCount(1);
  // the games list: the main search, and the pickers in the filters
  await page.goto("/en/games/?q=dnd");
  await expect(page.getByTestId("games-count")).toHaveText("Showing 3 games"); // the three D&D games of the demo data (two on 5.5e 2024, one on 5e 2014), found without the word "Dungeons" in the search
  await page.getByRole("button", { name: /Filters/ }).click();
  await page.getByLabel("Game system", { exact: true }).fill("d&d");
  const list = page.getByRole("listbox", { name: "Choices for Game system" });
  await expect(list.getByRole("option", { name: "Dungeons & Dragons 5.5e 2024" })).toBeVisible();
  await page.goto("/en/games/");
  await expect(page.locator("[data-ready]")).toBeAttached();
  await page.getByRole("button", { name: /Filters/ }).click();
  await page.getByLabel("Genre", { exact: true }).fill("science fiction");
  await expect(page.getByRole("listbox", { name: "Choices for Genre" }).getByRole("option", { name: "Sci-fi" })).toBeVisible();
});

test("the Game Masters page can be searched by name, city or system, and the short names work", async ({ page }) => {
  await page.goto("/en/gms/");
  await expect(page.locator("[data-ready]")).toBeAttached();
  const shown = page.locator("#gm-list [data-name]:not([hidden])");
  await expect(shown).toHaveCount(4);
  await page.getByLabel("Find a Game Master").fill("dnd"); // Dewi Lestari runs Dungeons & Dragons
  await expect(shown).toHaveCount(1);
  await expect(shown).toContainText("Dewi Lestari");
  await expect(page.getByTestId("tile-count")).toHaveText("Showing 1 of 4");
  await page.getByLabel("Find a Game Master").fill("depok");
  await expect(shown).toHaveCount(1);
  await expect(shown).toContainText("Raka Pratama");
  await expect(page).toHaveURL(/\/en\/gms\/\?q=depok$/);
  await page.getByLabel("Find a Game Master").fill("zzzz");
  await expect(page.getByTestId("tile-count")).toHaveText("No match. Try another word.");
  await page.goto("/id/gms/?q=coc"); // read back from the address; Call of Cthulhu
  await expect(page.getByLabel("Cari Game Master")).toHaveValue("coc");
  await expect(shown).toHaveCount(1);
});

test("before the page's scripts have run the search says so and ignores taps, a tap on Filters is remembered; afterwards they work", async ({ page }) => {
  await page.route("**/_next/static/**/*.js", async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue(); }); // a slow phone
  await page.goto("/en/games/", { waitUntil: "domcontentloaded" });
  const search = page.getByLabel("Search", { exact: true });
  const filters = page.getByRole("button", { name: /Filters/ });
  await expect(search).toHaveJSProperty("readOnly", true);
  await expect(filters).toHaveAttribute("aria-disabled", "true");
  expect(await search.evaluate((el) => getComputedStyle(el).pointerEvents), "the search takes no taps yet").toBe("none");
  await filters.click({ force: true }); // a real tap is not held back by aria-disabled; too early for the page's own handler: only the inline script sees it
  await expect(page.locator("html")).toHaveAttribute("data-ft", "1");
  await expect(page.locator("[data-ready]")).toBeAttached({ timeout: 20_000 });
  await expect(search).toHaveJSProperty("readOnly", false);
  await expect(filters).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByLabel("Where", { exact: true }), "the early tap opened Filters").toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-ft", "1");
  await search.fill("kumu");
  await expect(page.getByTestId("games-count")).toHaveText("Showing 1 game");
});

test("on a slow phone a tap on Filters before the scripts have run opens the Filters sheet as soon as they have", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/_next/static/**/*.js", async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
  await page.goto("/en/games/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Filters/ }).click({ force: true }); // a real tap is not held back by aria-disabled
  await expect(page.locator("[data-ready]")).toBeAttached({ timeout: 20_000 });
  await expect(page.getByRole("dialog"), "the sheet is open without a second tap").toBeVisible();
  await expect(page.getByLabel("Where", { exact: true })).toBeVisible();
});

test("the home page: a ranked row of systems, counts on the buttons, a way in for Game Masters, and a header that stays", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.getByRole("link", { name: `All ${SYSTEMS.length} game systems`, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "All 40 genres", exact: true })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="systems-h"] .rank').first()).toHaveText("1");
  await expect(page.getByText("Do you run games?")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "List your game" }).first()).toHaveAttribute("href", "/en/list-your-game/");
  await page.goto("/en/systems/");
  await page.evaluate(() => scrollTo(0, 3000));
  const top = await page.locator("header").evaluate((el) => el.getBoundingClientRect().top);
  expect(top, "the header is still at the top after scrolling").toBe(0);
});

test("a game marked full says so, sinks to the end of the list, and can still be messaged", async ({ page }) => {
  await page.goto("/en/games/?page=2");
  await expect(page.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page"); // the address is read after the page loads
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

test("the header toggle switches between light and dark, and the choice is remembered; the footer has no theme control", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/en/");
  await expect(page.getByRole("contentinfo").getByRole("button")).toHaveCount(0);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
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
      // Before the page's scripts have run the list controls are deliberately dimmed (`.pending`, slow phones); a slow WebKit run measured that.
      await page.waitForFunction(() => !document.querySelector(".pending"));
      expect(await axe(page)).toEqual([]);
    });
  }
}

test("on a phone a game in the list is one short row, and the game page keeps WhatsApp within reach", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/games/");
  await expect(page.locator("[data-ready]")).toBeAttached();
  const row = page.getByTestId("games-list").locator("li").first();
  expect((await row.boundingBox())!.height, "a game is a row of a few lines, not a full card").toBeLessThan(260);
  await expect(row.getByText(/Rp\s?75\.000|Free|Gratis/).first()).toBeVisible();

  await row.getByRole("link").first().click();
  const bar = page.getByTestId("sticky-contact");
  await expect(bar, "the contact bar is there on a phone").toBeVisible();
  await expect(bar).toContainText(/Rp|Free|Gratis/);
  const cover = await page.locator("main picture, main img").first().boundingBox();
  expect(cover!.width, "the cover fills the column").toBeGreaterThan(340);

  await context.route("https://wa.me/**", (route) => route.fulfill({ contentType: "text/html", body: "chat" }));
  const popup = context.waitForEvent("page");
  await page.getByTestId("sticky-whatsapp").click();
  expect(new URL((await popup).url()).pathname).toBe("/62811000000001");

  await page.locator("#contact").evaluate((el) => el.scrollIntoView({ block: "center" })); // the panel in the middle of the screen, as a reader would have it
  const tabs = page.locator("nav.fixed");
  await expect.poll(async () => (await bar.boundingBox())!.y >= (await tabs.boundingBox())!.y - 1, { message: "the bar steps behind the tab bar while the contact panel is on screen", timeout: 10_000 }).toBe(true);
});

test("on a desktop the game page has no contact bar, and the home page shows Starting soon as a grid", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en/games/mercusuar-di-pulau-kabut-0m01/");
  await expect(page.getByTestId("sticky-contact")).toBeHidden();
  await page.goto("/en/");
  const soon = page.locator("#soon-h").locator("xpath=ancestor::section//ul");
  const display = await soon.evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe("grid");
});

test("on a phone the quick filters under the search narrow the list in one tap, and a second tap clears them", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/games/");
  await expect(page.locator("[data-ready]")).toBeAttached();
  const count = page.getByTestId("games-count");
  const all = await count.innerText();
  const online = page.getByRole("button", { name: "Online", exact: true });
  await online.click();
  await expect(online).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/where=online/);
  await expect(count).not.toHaveText(all);
  await page.getByRole("button", { name: "Campaign", exact: true }).click();
  await expect(page).toHaveURL(/format=campaign/);
  await online.click();
  await expect(online).toHaveAttribute("aria-pressed", "false");
  await expect(page).not.toHaveURL(/where=/);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("group", { name: "Quick filters" }), "the chips are for a phone: the desktop has the filter panel").toBeHidden();
});

test("on a phone the tab bar has an icon on every tab, and the browse pages keep a search under the masthead", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/styles/");
  const tabs = page.locator("nav.fixed").getByRole("link");
  await expect(tabs).toHaveCount(4);
  for (let i = 0; i < 4; i++) await expect(tabs.nth(i).locator("svg")).toBeVisible();
  const search = page.getByRole("search").first();
  await expect(search.getByRole("searchbox")).toBeVisible();
  await search.getByRole("searchbox").fill("mercusuar");
  await search.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/\/en\/games\/\?q=mercusuar/);

  await page.goto("/en/gms/");
  await expect(page.locator("#header-q"), "the Game Masters list has a search of its own").toHaveCount(0);
});

test("the home page opens the four browse pages from large tiles, and on a phone the contact bar has a sheet with every way to reach the GM", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/");
  const gateway = page.locator('section[aria-labelledby="gateway-h"]');
  await expect(gateway.getByRole("link")).toHaveCount(4);
  for (const path of ["systems", "genres", "styles", "mechanics"]) await expect(gateway.locator(`a[href="/en/${path}/"]`)).toBeVisible();

  await page.goto("/en/games/mercusuar-di-pulau-kabut-0m01/");
  await page.getByTestId("sticky-more").click();
  const sheet = page.getByTestId("contact-sheet");
  await expect(sheet.getByTestId("contact-discord")).toBeVisible();
  await expect(sheet.getByTestId("contact-instagram")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});
