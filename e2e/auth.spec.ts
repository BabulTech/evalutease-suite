/**
 * Auth flows: login, signup, logout.
 *
 * Set env vars to run against production:
 *   BASE_URL=https://evalutease-suite.vercel.app
 *   TEST_EMAIL=yourteacher@example.com
 *   TEST_PASSWORD=yourpassword
 */
import { test, expect } from "@playwright/test";

const email    = process.env.TEST_EMAIL    || "test@example.com";
const password = process.env.TEST_PASSWORD || "password123";

test.describe("Auth", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/");
    // Should land on login or redirect to login
    await expect(page).toHaveURL(/\/(login|auth|$)/);
    await expect(page.locator('button[type="submit"]').or(page.getByRole("button", { name: "Log in" }))).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("definitely-wrong-password-xyz");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText(/invalid|incorrect|wrong|error/i)).toBeVisible({ timeout: 8000 });
  });

  test("successful login reaches dashboard", async ({ page }) => {
    test.skip(!process.env.TEST_EMAIL, "TEST_EMAIL not set — skipping live auth test");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 12000 });
  });

  test("logout returns to login", async ({ page }) => {
    test.skip(!process.env.TEST_EMAIL, "TEST_EMAIL not set — skipping live auth test");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/dashboard/, { timeout: 12000 });
    // Open user menu and click logout
    await page.getByRole("button", { name: /account|profile|menu|avatar/i }).first().click();
    await page.getByRole("menuitem", { name: /log out|sign out/i }).click();
    await expect(page).toHaveURL(/\/(login|auth|$)/, { timeout: 8000 });
  });
});
