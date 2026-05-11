/**
 * Teacher dashboard flows.
 *
 * Requires a logged-in teacher account:
 *   BASE_URL=https://evalutease-suite.vercel.app
 *   TEST_EMAIL=teacher@example.com
 *   TEST_PASSWORD=password
 */
import { test, expect, Page } from "@playwright/test";

const email    = process.env.TEST_EMAIL    || "";
const password = process.env.TEST_PASSWORD || "";

async function loginAsTeacher(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/dashboard/, { timeout: 12000 });
}

test.describe("Teacher dashboard", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!email, "TEST_EMAIL not set — skipping teacher dashboard tests");
    await loginAsTeacher(page);
  });

  test("dashboard loads with sessions list", async ({ page }) => {
    await expect(page.getByText(/session|quiz/i)).toBeVisible({ timeout: 8000 });
  });

  test("navigate to Sessions page", async ({ page }) => {
    await page.getByRole("link", { name: /sessions/i }).click();
    await expect(page).toHaveURL(/sessions/);
    await expect(page.getByRole("heading", { name: /sessions/i })).toBeVisible();
  });

  test("create new session button is visible", async ({ page }) => {
    await page.goto("/sessions");
    await expect(
      page.getByRole("button", { name: /new session|create session|add session/i })
        .or(page.getByRole("link", { name: /new session|create/i }))
    ).toBeVisible({ timeout: 8000 });
  });

  test("quiz history page loads", async ({ page }) => {
    await page.goto("/quiz-history");
    await expect(page.getByText(/history|past|attempt/i)).toBeVisible({ timeout: 8000 });
  });

  test("reports page loads", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText(/report|analytic|score/i)).toBeVisible({ timeout: 8000 });
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/setting|profile|account/i)).toBeVisible({ timeout: 8000 });
  });
});
