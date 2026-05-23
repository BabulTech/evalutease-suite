/**
 * Mobile responsiveness tests.
 *
 * Runs at common mobile viewport sizes and checks that key UI elements
 * are visible and usable — no horizontal overflow, sidebar accessible,
 * forms functional.
 */
import { test, expect, type Page } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "./fixtures";

const VIEWPORTS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "Android (360p)", width: 360, height: 800 },
  { name: "iPad Mini", width: 768, height: 1024 },
];

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  expect(overflow, "Page has horizontal overflow (broken layout)").toBe(false);
}

for (const vp of VIEWPORTS) {
  test.describe(`Mobile — ${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("login page fits viewport", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /log in|sign in/i })).toBeVisible();
      await noHorizontalOverflow(page);
    });

    test("quiz join page fits viewport", async ({ page }) => {
      await page.goto("/q/XXXXINVALID");
      // Invalid code — just check the error page is responsive
      await expect(page.getByText(/not found|invalid|expired|closed|join/i).first()).toBeVisible({
        timeout: 8000,
      });
      await noHorizontalOverflow(page);
    });

    test("authenticated dashboard fits viewport", async ({ page }) => {
      test.skip(!TEST_EMAIL, "TEST_EMAIL not set");

      await page.goto("/login");
      await page.getByLabel(/email/i).fill(TEST_EMAIL);
      await page.getByLabel(/password/i).fill(TEST_PASSWORD);
      await page.getByRole("button", { name: /log in|sign in/i }).click();
      await page.waitForURL(/dashboard/, { timeout: 15000 });

      await noHorizontalOverflow(page);

      // On mobile the sidebar is typically hidden behind a hamburger
      const hamburger = page.getByRole("button", { name: /menu|sidebar|open/i }).or(
        page.locator('[data-testid="sidebar-toggle"], [aria-label*="menu" i]')
      );
      const sidebarVisible = await page.getByRole("navigation").isVisible().catch(() => false);
      const hamburgerVisible = await hamburger.first().isVisible().catch(() => false);

      expect(sidebarVisible || hamburgerVisible, "Neither nav nor hamburger visible on mobile").toBe(true);
    });

    test("settings page fits viewport", async ({ page }) => {
      test.skip(!TEST_EMAIL, "TEST_EMAIL not set");

      await page.goto("/login");
      await page.getByLabel(/email/i).fill(TEST_EMAIL);
      await page.getByLabel(/password/i).fill(TEST_PASSWORD);
      await page.getByRole("button", { name: /log in|sign in/i }).click();
      await page.waitForURL(/dashboard/, { timeout: 15000 });

      await page.goto("/settings");
      await expect(page.getByText(/setting|profile/i).first()).toBeVisible({ timeout: 8000 });
      await noHorizontalOverflow(page);
    });
  });
}
