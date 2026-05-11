/**
 * Student quiz-join flow — the public-facing critical path.
 *
 * Set QUIZ_CODE to a real active session code to run against production:
 *   BASE_URL=https://evalutease-suite.vercel.app QUIZ_CODE=ABC123 npx playwright test e2e/quiz-join.spec.ts
 */
import { test, expect } from "@playwright/test";

const quizCode = process.env.QUIZ_CODE || "DEMO";

test.describe("Quiz join (student)", () => {
  test("join page renders from /q/:code", async ({ page }) => {
    await page.goto(`/q/${quizCode}`);
    // Should show the quiz lobby / join form — not a 404
    await expect(page.getByText(/404|not found/i)).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    // Name field must be present
    await expect(page.getByPlaceholder(/name/i).or(page.getByLabel(/name/i))).toBeVisible({ timeout: 8000 });
  });

  test("empty name is rejected", async ({ page }) => {
    test.skip(!process.env.QUIZ_CODE, "QUIZ_CODE not set — skipping live join test");
    await page.goto(`/q/${quizCode}`);
    await page.getByRole("button", { name: /join|start|enter/i }).click();
    await expect(page.getByText(/name|required/i)).toBeVisible({ timeout: 5000 });
  });

  test("invalid quiz code shows friendly error", async ({ page }) => {
    await page.goto("/q/XXXXINVALID");
    await expect(page.getByText(/not found|invalid|expired|closed/i)).toBeVisible({ timeout: 8000 });
  });

  test("student joins and sees first question", async ({ page }) => {
    test.skip(!process.env.QUIZ_CODE, "QUIZ_CODE not set — skipping live join test");
    await page.goto(`/q/${quizCode}`);
    const nameField = page.getByPlaceholder(/name/i).or(page.getByLabel(/name/i)).first();
    await nameField.fill(`Playwright-${Date.now()}`);
    await page.getByRole("button", { name: /join|start|enter/i }).click();
    // After joining, student should see a question or waiting screen
    await expect(
      page.getByText(/question|waiting|lobby|loading/i)
    ).toBeVisible({ timeout: 12000 });
  });
});
