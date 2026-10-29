import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { linkFor, newWorld, openLink, type World } from "../support/e2e-world.ts";

// The admin page against the real backend (worker/src) on an in-memory database: nothing is stubbed in the page, so a decision made
// here really changes the database that is checked afterwards. Each test has its own world (tests/support/test-server.ts).

async function open(page: Page, options: { as?: string | null; hook?: boolean } = {}): Promise<World> {
  const world = await newWorld(page, { seed: true, hook: options.hook ?? true });
  const as = options.as === undefined ? "admin@example.com" : options.as;
  if (as) await world.signInAs(as);
  await page.goto("/en/admin/");
  if (as === "admin@example.com") await expect(page.getByTestId("admin-list")).toBeVisible();
  return world;
}
const row = (page: Page, title: string) => page.getByTestId("admin-row").filter({ hasText: title });

test("nobody sees anything before signing in; an admin signs in with an emailed link and sees the waiting list", async ({ page }) => {
  const world = await open(page, { as: null });
  await expect(page.getByRole("heading", { name: "Sign in to review listings" })).toBeVisible();
  await expect(page.getByTestId("admin-list")).toHaveCount(0);

  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByTestId("link-sent")).toBeVisible();
  await openLink(page, await linkFor(world, "admin@example.com"));
  await expect(page.getByText("Signed in as admin@example.com")).toBeVisible();
  await page.goto("/en/admin/");
  await expect(page.getByText("Signed in as admin@example.com")).toBeVisible();
  await expect(page.getByTestId("status-pending")).toContainText("4");
  await expect(page.getByTestId("status-approved")).toContainText("1");
  await expect(page.getByTestId("admin-row")).toHaveCount(4);
  await page.reload(); // the session is a cookie: it survives a reload
  await expect(page.getByText("Signed in as admin@example.com")).toBeVisible();
});

test("an email that is not an admin's is told so, and sees nothing", async ({ page }) => {
  await open(page, { as: "stranger@gmail.com" });
  await expect(page.getByRole("heading", { name: "This account is not an admin" })).toBeVisible();
  await expect(page.getByText("stranger@gmail.com is not on the admin list")).toBeVisible();
  await expect(page.getByTestId("admin-row")).toHaveCount(0);
});

test("an expired session sends the admin back to the sign-in", async ({ page }) => {
  const world = await open(page);
  await expect(page.getByTestId("admin-row")).toHaveCount(4);
  await world.clock(Date.now() + 31 * 86_400_000);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("Your sign-in expired. Please sign in again.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to review listings" })).toBeVisible();
});

test("the review screen shows what the game will look like and what to check", async ({ page }) => {
  await open(page);
  await row(page, "Neon Run").click();
  await expect(page.getByTestId("admin-detail").getByRole("heading", { level: 2, name: "Neon Run" })).toBeVisible();
  await expect(page.getByTestId("admin-checks")).toContainText("Wording that often means a scam");
  await expect(page.getByTestId("admin-checks")).toContainText("asks for OTP, PIN or passwords");
  await expect(page.getByTestId("game-details")).toContainText("Rp 75.000");
  await expect(page.getByText("+6281234567890")).toBeVisible();
  await expect(page.getByRole("link", { name: "Test the WhatsApp chat" })).toHaveAttribute("href", /^https:\/\/wa\.me\/6281234567890\?text=/);
});

test("a picture the GM uploaded is shown to the admin before it is public", async ({ page }) => {
  await open(page);
  await row(page, "Mercusuar di Pulau Kabut").click();
  const img = page.getByTestId("admin-detail").locator("img[src*='covers']").first();
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  const status = await page.evaluate(async () => {
    const el = document.querySelector("[data-testid='admin-detail'] img[src*='covers']") as HTMLImageElement;
    const key = decodeURIComponent(el.currentSrc || el.src).match(/covers\/[a-z0-9]+\.webp/)![0];
    return (await fetch(`/api/img/${key}`)).status;
  });
  expect(status, "an admin may read it").toBe(200);
});

test("approving: the game leaves the waiting list, the database changes, the GM is emailed, the site is rebuilt, and it can be undone", async ({ page }) => {
  const world = await open(page);
  await row(page, "Mercusuar di Pulau Kabut").click();
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("toast")).toContainText("Approved “Mercusuar di Pulau Kabut”.");
  await expect(row(page, "Mercusuar di Pulau Kabut")).toHaveCount(0);
  await expect(page.getByTestId("status-pending")).toContainText("3");
  await expect(page.getByTestId("publish-bar")).toContainText("waiting to go live");
  await expect.poll(() => world.status("games", "Mercusuar di Pulau Kabut")).toBe("approved");
  const after = await world.state();
  expect(after.hooks, "the first change builds the site at once").toBe(1);
  expect(after.mails.map((m) => [m.to, m.subject.split(" / ")[0]])).toEqual([["raka@example.com", "Approved: Mercusuar di Pulau Kabut"]]);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => world.status("games", "Mercusuar di Pulau Kabut")).toBe("pending");
  await expect(page.getByTestId("status-pending")).toContainText("4");
  expect((await world.state()).mails, "undoing sends no email").toHaveLength(1);
  expect((await world.state()).hooks, "a second change within two minutes waits for the timer").toBe(1);
});

test("approving is blocked while something is wrong; rejecting writes the reasons in both languages", async ({ page }) => {
  const world = await open(page);
  await row(page, "Date Unknown").click();
  await expect(page.getByTestId("approve")).toBeDisabled();
  await expect(page.getByText("Fix the problems above first")).toBeVisible();
  await page.getByTestId("reject").click();
  await page.getByLabel("The date or time is missing or has passed").check();
  await page.getByLabel("Add details for the GM (optional)").fill("Which Saturday?");
  await page.getByTestId("reject-confirm").click();
  await expect(page.getByTestId("toast")).toContainText("Rejected “Date Unknown”.");
  await expect.poll(() => world.status("games", "Date Unknown")).toBe("rejected");
  const reason = "The date or time is missing or has passed / Tanggal atau jamnya kosong atau sudah lewat — Which Saturday?";
  expect((await world.sql("SELECT reject_reason FROM games WHERE title = 'Date Unknown'"))[0].reject_reason).toBe(reason);
  const state = await world.state();
  expect(state.mails.at(-1)).toMatchObject({ to: "raka@example.com" });
  expect(state.mails.at(-1)!.subject).toContain("Not approved yet: Date Unknown");
  expect(state.mails.at(-1)!.body).toContain(reason);
  expect(state.hooks, "it was never public: no rebuild").toBe(0);
  await page.getByTestId("status-rejected").click();
  await expect(row(page, "Date Unknown")).toHaveCount(1);
});

test("several clean games can be approved together", async ({ page }) => {
  const world = await open(page);
  await page.getByRole("checkbox", { name: "Select Mercusuar di Pulau Kabut" }).check();
  await page.getByRole("checkbox", { name: "Select Naga-naga Hutan Bara" }).check();
  await expect(page.getByRole("checkbox", { name: "Select Date Unknown" })).toBeDisabled();
  await page.getByTestId("bulk-approve").click();
  await expect(page.getByTestId("toast")).toContainText("Approved 2 items.");
  await expect.poll(async () => [await world.status("games", "Mercusuar di Pulau Kabut"), await world.status("games", "Naga-naga Hutan Bara")]).toEqual(["approved", "approved"]);
});

test("the keyboard: J moves, A approves, R opens the rejection form", async ({ page }) => {
  const world = await open(page);
  await page.keyboard.press("j");
  await expect(page.getByTestId("admin-detail")).toBeVisible();
  const first = await page.getByTestId("admin-detail").getByRole("heading").first().innerText();
  await page.keyboard.press("a");
  await expect.poll(() => world.status("games", first)).toBe("approved");
  await page.keyboard.press("r");
  await expect(page.getByTestId("reject-form")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("reject-form")).toHaveCount(0);
});

test("featuring an approved game rebuilds the site; publishing now asks for one", async ({ page }) => {
  const world = await open(page);
  await page.getByTestId("status-approved").click();
  await row(page, "Panen Harapan").click();
  await page.getByRole("button", { name: "Feature", exact: true }).click();
  await expect.poll(async () => (await world.sql("SELECT featured FROM games WHERE title = 'Panen Harapan'"))[0].featured).toBe(1);
  expect((await world.state()).hooks).toBe(1);
  await page.getByTestId("publish-now").click();
  await expect(page.getByTestId("toast")).toContainText("Publishing.");
  await expect.poll(async () => (await world.state()).hooks).toBe(2);
});

test("with no build hook the admin is told the site cannot be rebuilt", async ({ page }) => {
  await open(page, { hook: false });
  await expect(page.getByText(/not set up|not configured/i).first()).toBeVisible();
  await expect(page.getByTestId("publish-now")).toBeDisabled();
});

test("marking an approved game full rebuilds the site, and it can be reopened", async ({ page }) => {
  const world = await open(page);
  await page.getByTestId("status-approved").click();
  await row(page, "Panen Harapan").click();
  const full = async () => (await world.sql("SELECT full FROM games WHERE title = 'Panen Harapan'"))[0].full;
  await page.getByTestId("toggle-full").click();
  await expect.poll(full).toBe(1);
  await expect(page.getByTestId("toggle-full")).toHaveText("Reopen");
  await page.getByTestId("toggle-full").click();
  await expect.poll(full).toBe(0);
  await expect(page.getByTestId("toggle-full")).toHaveText("Mark as full");
});

test("Game Masters are reviewed the same way", async ({ page }) => {
  const world = await open(page);
  await page.getByTestId("tab-gms").click();
  await row(page, "Dewi Lestari").click();
  await expect(page.getByTestId("gm-details")).toContainText("Dewi Lestari");
  await page.getByTestId("approve").click();
  await expect.poll(() => world.status("profiles", "Dewi Lestari")).toBe("approved");
});

test("one person with two accounts is flagged and merged: the games move and the second email opens the first account", async ({ page }) => {
  const world = await open(page);
  // The same WhatsApp number on a second profile, as a second email would make it.
  await world.exec("INSERT INTO accounts (id, email, created_at) VALUES ('acc2', 'raka.second@example.com', '2026-10-01T00:00:00.000Z')");
  await world.exec("INSERT INTO profiles (id, account_id, slug, name, whatsapp, city, consent, created_at, updated_at) VALUES ('prof2', 'acc2', 'raka-p-zz99', 'Raka P.', '6281234567890', 'Depok', 1, '2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z')");
  await page.reload();
  await page.getByTestId("tab-gms").click();
  await row(page, "Raka P.").click();
  await expect(page.getByTestId("admin-checks")).toContainText("same WhatsApp number");
  const box = page.getByTestId("merge-box");
  await box.getByRole("button", { name: "Merge into Raka Pratama" }).click();
  await box.getByRole("button", { name: /Merge this profile into Raka Pratama/ }).click();
  await expect(row(page, "Raka P.")).toHaveCount(0);
  expect(await world.sql("SELECT COUNT(*) AS n FROM profiles")).toEqual([{ n: 2 }]);
});

test("adding an admin is one email address; the owner and yourself can't be removed", async ({ page }) => {
  const world = await open(page);
  await page.getByTestId("tab-admins").click();
  const list = page.getByTestId("admins-list");
  await expect(list).toContainText("owner@example.com");
  await expect(list).toContainText("admin@example.com");
  await expect(list.getByRole("button", { name: "Remove admin@example.com" }), "you can't remove yourself").toHaveCount(0);
  await page.getByLabel("Email address").fill("New.Friend@Example.com");
  await page.getByRole("button", { name: "Add admin" }).click();
  await expect(list).toContainText("new.friend@example.com");
  expect((await world.sql("SELECT email FROM admins")).map((r) => r.email)).toContain("new.friend@example.com");
  await list.getByRole("button", { name: "Remove new.friend@example.com" }).click();
  await expect(list).not.toContainText("new.friend@example.com");
});

test("the admin page is kept out of search results and has no accessibility problems", async ({ page }) => {
  await open(page, { as: null });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const check = async () => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(await check()).toEqual([]);
  const world = await newWorld(page, { seed: true });
  await world.signInAs("admin@example.com");
  await page.goto("/en/admin/");
  await row(page, "Neon Run").click();
  expect(await check()).toEqual([]);
});

test("when the newest publish is not in the page, the admin is told to reload or check the build", async ({ page }) => {
  const world = await newWorld(page, { seed: true, hook: true });
  await world.signInAs("admin@example.com");
  await world.exec("INSERT INTO meta (key, value) VALUES ('lastDeploy', ?)", new Date().toISOString()); // after this page was built
  await page.clock.setFixedTime(new Date(Date.now() + 60 * 60_000)); // an hour later: past the build's grace
  await page.goto("/en/admin/");
  await expect(page.getByRole("status").filter({ hasText: "is not in this page yet" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Deployments in Cloudflare" })).toBeVisible();
});

test("on a phone the list and the review screen take turns", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByTestId("admin-list")).toBeVisible();
  await row(page, "Mercusuar di Pulau Kabut").click();
  await expect(page.getByTestId("admin-list")).toBeHidden();
  await page.getByRole("button", { name: "Back to the list" }).click();
  await expect(page.getByTestId("admin-list")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
