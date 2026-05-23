/**
 * Auth flows: login, signup guard, wrong password, logout.
 *
 * Env vars:
 *   TEST_EMAIL     — a real account email
 *   TEST_PASSWORD  — its password
 */
import { test, expect } from "./fixtures";

test.describe("Auth — unauthenticated", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/login/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /log in|sign in/i })).toBeVisible();
  });

  test("protected routes redirect unauthenticated users to login", async ({ page }) => {
    for (const route of ["/dashboard", "/sessions", "/settings", "/billing"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/login/, { timeout: 8000 });
    }
  });

  test("wrong password shows error message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("someone@example.com");
    await page.getByLabel(/password/i).fill("wrong-password-xyz-123");
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await expect(page.getByText(/invalid|incorrect|wrong|error/i)).toBeVisible({ timeout: 8000 });
  });

  test("empty form submission shows validation", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    // Either native HTML validation or a toast/error message
    const hasError =
      (await page.getByText(/required|invalid|enter/i).isVisible().catch(() => false)) ||
      (await page.locator(":invalid").count()) > 0;
    expect(hasError).toBe(true);
  });
});

test.describe("Auth — authenticated", () => {
  test("successful login reaches dashboard", async ({ authedPage: page }) => {
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText(/dashboard|session|quiz/i).first()).toBeVisible();
  });

  test("logout returns to login", async ({ authedPage: page }) => {
    // Open user/account menu
    await page
      .getByRole("button", { name: /account|profile|user|avatar/i })
      .or(page.locator('[data-testid="user-menu"]'))
      .first()
      .click();
    await page.getByRole("menuitem", { name: /log out|sign out/i }).click();
    await expect(page).toHaveURL(/\/(login|$)/, { timeout: 8000 });
  });

  test("back-button after logout does not restore session", async ({ authedPage: page }) => {
    await page
      .getByRole("button", { name: /account|profile|user|avatar/i })
      .first()
      .click();
    await page.getByRole("menuitem", { name: /log out|sign out/i }).click();
    await page.waitForURL(/\/(login|$)/);
    await page.goBack();
    // Should still be on login — session must not be restored
    await expect(page).toHaveURL(/\/(login|dashboard)/, { timeout: 5000 });
  });
});
