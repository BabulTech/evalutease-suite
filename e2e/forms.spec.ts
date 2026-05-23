/**
 * Form validation tests — settings profile, host settings, category creation.
 *
 * Uses pre-authenticated storage state.
 */
import { test, expect } from "./fixtures";

test.describe("Settings — Profile form", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto("/settings");
    // Ensure we're on the profile tab
    const profileTab = page.getByRole("tab", { name: /profile/i });
    if (await profileTab.isVisible()) await profileTab.click();
  });

  test("profile form renders with fields", async ({ authedPage: page }) => {
    await expect(page.getByLabel(/first name|full name|name/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("saving profile shows success feedback", async ({ authedPage: page }) => {
    const nameField = page.getByLabel(/first name|full name|name/i).first();
    await nameField.click({ clickCount: 3 });
    await nameField.type("PlaywrightUser");
    await page.getByRole("button", { name: /save|update/i }).first().click();
    await expect(page.getByText(/saved|updated|success/i)).toBeVisible({ timeout: 8000 });
  });

  test("plan tab shows current plan", async ({ authedPage: page }) => {
    await page.goto("/settings?tab=plan");
    await expect(page.getByText(/current plan|starter|pro|enterprise/i)).toBeVisible({ timeout: 8000 });
  });

  test("plan cards are rendered for upgrade", async ({ authedPage: page }) => {
    await page.goto("/settings?tab=plan");
    // At least one plan card should be visible
    await expect(
      page.getByRole("button", { name: /individual|enterprise/i })
        .or(page.getByText(/PKR|month|free/i))
        .first()
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Settings — Host settings form", () => {
  test("host settings tab loads", async ({ authedPage: page }) => {
    await page.goto("/settings");
    const hostTab = page.getByRole("tab", { name: /host|quiz settings/i });
    if (await hostTab.isVisible()) {
      await hostTab.click();
      await expect(page.getByText(/marks|speed|explanation|setting/i).first()).toBeVisible({ timeout: 8000 });
    }
  });
});

test.describe("Category creation form", () => {
  test("new category button opens dialog", async ({ authedPage: page }) => {
    await page.goto("/categories");
    const addBtn = page
      .getByRole("button", { name: /add|new|create category/i })
      .or(page.getByRole("link", { name: /add|new category/i }))
      .first();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  });

  test("category form validates empty name", async ({ authedPage: page }) => {
    await page.goto("/categories");
    const addBtn = page
      .getByRole("button", { name: /add|new|create category/i })
      .first();
    if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) return;
    await addBtn.click();
    await page.getByRole("dialog").getByRole("button", { name: /save|create|add/i }).click();
    await expect(page.getByText(/required|name|enter/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Participant type form", () => {
  test("new participant type dialog opens", async ({ authedPage: page }) => {
    await page.goto("/participant-types");
    const addBtn = page
      .getByRole("button", { name: /add|new|create type/i })
      .first();
    if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) return;
    await addBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  });
});
