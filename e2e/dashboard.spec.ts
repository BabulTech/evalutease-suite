/**
 * Teacher dashboard — navigation, widgets, sidebar, quick actions.
 *
 * Uses pre-authenticated storage state (set TEST_EMAIL + TEST_PASSWORD).
 */
import { test, expect } from "./fixtures";

test.describe("Dashboard", () => {
  test("loads with key widgets", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/session|quiz|question/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("sidebar navigation links are present", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    const links = ["Sessions", "Categories", "Participants", "History", "Settings"];
    for (const name of links) {
      await expect(
        page.getByRole("link", { name: new RegExp(name, "i") }).first()
      ).toBeVisible({ timeout: 6000 });
    }
  });

  test("Sessions page loads via sidebar", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /sessions/i }).first().click();
    await expect(page).toHaveURL(/sessions/);
    await expect(page.getByRole("heading", { name: /sessions/i })).toBeVisible({ timeout: 8000 });
  });

  test("Categories page loads", async ({ authedPage: page }) => {
    await page.goto("/categories");
    await expect(page.getByText(/categor/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("Participants page loads", async ({ authedPage: page }) => {
    await page.goto("/participant-types");
    await expect(page.getByText(/participant|type/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("Quiz history page loads", async ({ authedPage: page }) => {
    await page.goto("/quiz-history");
    await expect(page.getByText(/history|attempt|session/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("Reports page loads", async ({ authedPage: page }) => {
    await page.goto("/reports");
    await expect(page.getByText(/report|analytic|score/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("notification bell is visible", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await expect(
      page.locator('[data-testid="notification-bell"]').or(page.getByLabel(/notification/i))
    ).toBeVisible({ timeout: 6000 });
  });

  test("New Session button navigates to session creator", async ({ authedPage: page }) => {
    await page.goto("/sessions");
    const btn = page
      .getByRole("button", { name: /new session|create/i })
      .or(page.getByRole("link", { name: /new session|create/i }))
      .first();
    await expect(btn).toBeVisible({ timeout: 8000 });
    await btn.click();
    await expect(page).toHaveURL(/sessions.*new|new.*session/, { timeout: 8000 });
  });
});
