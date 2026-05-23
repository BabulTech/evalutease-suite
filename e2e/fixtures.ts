/**
 * Shared Playwright fixtures and helpers.
 *
 * Authenticated state is stored in e2e/.auth/teacher.json after the first
 * login so subsequent tests skip the login flow entirely (global setup).
 */
import { test as base, expect, type Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export { expect };

export const STORAGE_STATE = path.join(__dirname, ".auth", "teacher.json");

export const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";
export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
export const QUIZ_CODE = process.env.QUIZ_CODE ?? "";

/** Login helper — fills the form and waits for dashboard. */
export async function loginViaUI(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 15000 });
}

/** Extend base test with a pre-authenticated `authedPage` fixture. */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ browser }, use) => {
    base.skip(!TEST_EMAIL, "TEST_EMAIL not set — skipping authenticated test");
    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
