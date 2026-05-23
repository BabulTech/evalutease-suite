/**
 * Accessibility audit using axe-core via @axe-core/playwright.
 *
 * Checks WCAG 2.1 AA compliance on every major page.
 * Violations are printed with exact element selectors and fix guidance.
 *
 * Run:  npx playwright test e2e/accessibility.spec.ts --project=chromium
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TEST_EMAIL, TEST_PASSWORD, STORAGE_STATE } from "./fixtures";

/** Helper: run axe and assert zero violations, printing details if any. */
async function expectNoViolations(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    // Skip known decorative/animation elements that axe over-reports
    .exclude("[aria-hidden='true']")
    .analyze();

  if (results.violations.length > 0) {
    const summary = results.violations.map((v) =>
      `\n[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
      v.nodes.slice(0, 2).map((n) => `  → ${n.html}`).join("\n")
    ).join("\n");
    console.error(`\nAxe violations on "${label}":${summary}\n`);
  }

  expect(results.violations, `Accessibility violations on "${label}"`).toHaveLength(0);
}

// ── Public pages (no auth needed) ──────────────────────────────────────────
test.describe("Accessibility — public pages", () => {
  test("login page — WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page, "Login");
  });

  test("invalid quiz code error page — WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/q/XXXXINVALID");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page, "Quiz join error");
  });
});

// ── Authenticated pages ─────────────────────────────────────────────────────
test.describe("Accessibility — authenticated pages", () => {
  test.use({ storageState: STORAGE_STATE });
  test.beforeEach(async ({}) => {
    test.skip(!TEST_EMAIL, "TEST_EMAIL not set — skipping auth-required accessibility tests");
  });

  test("dashboard — WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page, "Dashboard");
  });

  test("sessions list — WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/sessions");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page, "Sessions");
  });

  test("settings profile tab — WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/settings?tab=profile");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page, "Settings / Profile");
  });

  test("settings plan tab — WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/settings?tab=plan");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page, "Settings / Plan");
  });

  test("categories page — WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/categories");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page, "Categories");
  });

  test("quiz history — WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/quiz-history");
    await page.waitForLoadState("networkidle");
    await expectNoViolations(page, "Quiz History");
  });
});
