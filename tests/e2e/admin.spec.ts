import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fakeToken, installAdminStubs, seedBackend, type Backend } from "../support/admin-stubs.ts";

// The admin page, with Google's sign-in and the Sheet's script replaced (tests/support/admin-stubs.ts). The Sheet's
// script is the real Code.gs logic, so a decision here really changes the in-memory sheet that is checked afterwards.

async function open(page: Page, email = "admin@example.com", token = fakeToken(email)): Promise<Backend> {
  const backend = seedBackend();
  await installAdminStubs(page, backend, token);
  await page.goto("/en/admin/");
  return backend;
}
async function signIn(page: Page) {
  await page.getByRole("button", { name: "Sign in with Google" }).click();
}
const row = (page: Page, title: string) => page.getByTestId("admin-row").filter({ hasText: title });
const statusOf = (b: Backend, title: string) => b.store.load("game").find((r) => r.cells["Game title"] === title)?.cells.Status;

test("nobody sees anything before signing in; an admin sees the waiting list", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Sign in to review listings" })).toBeVisible();
  await expect(page.getByTestId("admin-list")).toHaveCount(0);
  await signIn(page);
  await expect(page.getByText("Signed in as admin@example.com")).toBeVisible();
  await expect(page.getByTestId("status-pending")).toContainText("4");
  await expect(page.getByTestId("status-approved")).toContainText("1");
  await expect(page.getByTestId("admin-row")).toHaveCount(4);
  await page.reload(); // the sign-in lasts for this tab
  await expect(page.getByText("Signed in as admin@example.com")).toBeVisible();
});

test("a Google account that is not an admin is told so, and sees nothing", async ({ page }) => {
  await open(page, "stranger@gmail.com");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "This account is not an admin" })).toBeVisible();
  await expect(page.getByText("stranger@gmail.com is not on the admin list")).toBeVisible();
  await expect(page.getByTestId("admin-row")).toHaveCount(0);
});

test("an expired sign-in sends the admin back to the button", async ({ page }) => {
  await open(page, "admin@example.com", fakeToken("admin@example.com", -10));
  await signIn(page);
  await expect(page.getByText("Your sign-in expired. Please sign in again.")).toBeVisible();
});

test("the review screen shows what the game will look like and what to check", async ({ page }) => {
  await open(page);
  await signIn(page);
  await row(page, "Neon Run").click();
  await expect(page.getByTestId("admin-detail").getByRole("heading", { name: "Neon Run" })).toBeVisible();
  await expect(page.getByTestId("admin-checks")).toContainText("Wording that often means a scam");
  await expect(page.getByTestId("admin-checks")).toContainText("asks for OTP, PIN or passwords");
  await expect(page.getByTestId("game-details")).toContainText("Rp 75.000");
  await expect(page.getByText("+6281234567890")).toBeVisible();
  await expect(page.getByRole("link", { name: "Test the WhatsApp chat" })).toHaveAttribute("href", /^https:\/\/wa\.me\/6281234567890\?text=/);
});

test("approving: the game leaves the waiting list, the sheet changes, the site is queued to rebuild, and it can be undone", async ({ page }) => {
  const backend = await open(page);
  await signIn(page);
  await row(page, "Mercusuar di Pulau Kabut").click();
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("toast")).toContainText("Approved “Mercusuar di Pulau Kabut”.");
  await expect(row(page, "Mercusuar di Pulau Kabut")).toHaveCount(0);
  await expect(page.getByTestId("status-pending")).toContainText("3");
  await expect(page.getByTestId("publish-bar")).toContainText("waiting to go live");
  await expect.poll(() => statusOf(backend, "Mercusuar di Pulau Kabut")).toBe("approved");
  expect(backend.calls.dirty).toBe(1);
  expect(backend.calls.notified.map((n) => [n.status, n.title])).toEqual([["approved", "Mercusuar di Pulau Kabut"]]);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => statusOf(backend, "Mercusuar di Pulau Kabut")).toBe("pending");
  await expect(page.getByTestId("status-pending")).toContainText("4");
  expect(backend.calls.notified).toHaveLength(1); // undoing sends no email
});

test("approving is blocked while something is wrong; rejecting writes the reasons in both languages", async ({ page }) => {
  const backend = await open(page);
  await signIn(page);
  await row(page, "Date Unknown").click();
  await expect(page.getByTestId("approve")).toBeDisabled();
  await expect(page.getByText("Fix the problems above first")).toBeVisible();
  await page.getByTestId("reject").click();
  await page.getByLabel("The date or time is missing or has passed").check();
  await page.getByLabel("Add details for the GM (optional)").fill("Which Saturday?");
  await page.getByTestId("reject-confirm").click();
  await expect(page.getByTestId("toast")).toContainText("Rejected “Date Unknown”.");
  await expect.poll(() => statusOf(backend, "Date Unknown")).toBe("rejected");
  const reason = String(backend.store.load("game").find((r) => r.cells["Game title"] === "Date Unknown")?.cells.RejectReason);
  expect(reason).toBe("The date or time is missing or has passed / Tanggal atau jamnya kosong atau sudah lewat — Which Saturday?");
  expect(backend.calls.notified.at(-1)).toMatchObject({ status: "rejected", reason });
  expect(backend.calls.dirty, "it was never public").toBe(0);
  await page.getByTestId("status-rejected").click();
  await expect(row(page, "Date Unknown")).toHaveCount(1);
});

test("several clean games can be approved together", async ({ page }) => {
  const backend = await open(page);
  await signIn(page);
  await page.getByRole("checkbox", { name: "Select Mercusuar di Pulau Kabut" }).check();
  await page.getByRole("checkbox", { name: "Select Naga-naga Hutan Bara" }).check();
  await expect(page.getByRole("checkbox", { name: "Select Date Unknown" })).toBeDisabled();
  await page.getByTestId("bulk-approve").click();
  await expect(page.getByTestId("toast")).toContainText("Approved 2 items.");
  await expect.poll(() => [statusOf(backend, "Mercusuar di Pulau Kabut"), statusOf(backend, "Naga-naga Hutan Bara")]).toEqual(["approved", "approved"]);
});

test("the keyboard: J moves, A approves, R opens the rejection form", async ({ page }) => {
  const backend = await open(page);
  await signIn(page);
  await page.keyboard.press("j");
  await expect(page.getByTestId("admin-detail")).toBeVisible();
  const first = await page.getByTestId("admin-detail").getByRole("heading").first().innerText();
  await page.keyboard.press("a");
  await expect.poll(() => statusOf(backend, first)).toBe("approved");
  await page.keyboard.press("r");
  await expect(page.getByTestId("reject-form")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("reject-form")).toHaveCount(0);
});

test("featuring an approved game queues a rebuild; publishing now asks for one", async ({ page }) => {
  const backend = await open(page);
  await signIn(page);
  await page.getByTestId("status-approved").click();
  await row(page, "Panen Harapan").click();
  await page.getByRole("button", { name: "Feature", exact: true }).click();
  await expect.poll(() => backend.store.load("game").find((r) => r.cells["Game title"] === "Panen Harapan")?.cells.Featured).toBe("yes");
  expect(backend.calls.dirty).toBe(1);
  await page.getByTestId("publish-now").click();
  await expect(page.getByTestId("toast")).toContainText("Publishing.");
  expect(backend.calls.deploys).toBe(1);
});

test("Game Masters are reviewed the same way", async ({ page }) => {
  const backend = await open(page);
  await signIn(page);
  await page.getByTestId("tab-gms").click();
  await row(page, "Dewi Lestari").click();
  await expect(page.getByTestId("gm-details")).toContainText("Dewi Lestari");
  await page.getByTestId("approve").click();
  await expect.poll(() => backend.store.load("gm").find((r) => r.cells["Display name"] === "Dewi Lestari")?.cells.Status).toBe("approved");
});

test("adding an admin is one email address; the owner and yourself can't be removed", async ({ page }) => {
  const backend = await open(page);
  await signIn(page);
  await page.getByTestId("tab-admins").click();
  const list = page.getByTestId("admins-list");
  await expect(list).toContainText("owner@example.com");
  await expect(list).toContainText("admin@example.com");
  await expect(list.getByRole("button", { name: "Remove admin@example.com" }), "you can't remove yourself").toHaveCount(0);
  await page.getByLabel("Google account email").fill("New.Friend@gmail.com");
  await page.getByRole("button", { name: "Add admin" }).click();
  await expect(list).toContainText("new.friend@gmail.com");
  expect(backend.store.admins().map((a) => a.email)).toContain("new.friend@gmail.com");
  await list.getByRole("button", { name: "Remove new.friend@gmail.com" }).click();
  await expect(list).not.toContainText("new.friend@gmail.com");
});

test("the admin page is kept out of search results and has no accessibility problems", async ({ page }) => {
  await open(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const check = async () => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(await check()).toEqual([]);
  await signIn(page);
  await row(page, "Neon Run").click();
  expect(await check()).toEqual([]);
});

test("on a phone the list and the review screen take turns", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await signIn(page);
  await expect(page.getByTestId("admin-list")).toBeVisible();
  await row(page, "Mercusuar di Pulau Kabut").click();
  await expect(page.getByTestId("admin-list")).toBeHidden();
  await page.getByRole("button", { name: "Back to the list" }).click();
  await expect(page.getByTestId("admin-list")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
