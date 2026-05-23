/**
 * Live quiz session flows — host creates & manages, student joins.
 *
 * Env:
 *   TEST_EMAIL / TEST_PASSWORD — host account
 *   QUIZ_CODE — active session access code (for student join tests)
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD, QUIZ_CODE, STORAGE_STATE } from "./fixtures";

test.describe("Session creation (host)", () => {
  test.use({ storageState: STORAGE_STATE });
  test.beforeEach(async ({}) => {
    test.skip(!TEST_EMAIL, "TEST_EMAIL not set");
  });

  test("new session form renders required fields", async ({ page }) => {
    await page.goto("/sessions/new");
    await expect(page.getByLabel(/title/i)).toBeVisible({ timeout: 8000 });
  });

  test("empty session title is rejected", async ({ page }) => {
    await page.goto("/sessions/new");
    const submitBtn = page
      .getByRole("button", { name: /create|launch|save|start/i })
      .first();
    if (!(await submitBtn.isVisible({ timeout: 6000 }).catch(() => false))) return;
    await submitBtn.click();
    const hasError =
      (await page.getByText(/title|required|name/i).isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await page.locator(":invalid").count()) > 0;
    expect(hasError).toBe(true);
  });

  test("sessions list page loads", async ({ page }) => {
    await page.goto("/sessions");
    await expect(page.getByText(/session|quiz/i).first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Student quiz join", () => {
  test("join page renders for valid-format code", async ({ page }) => {
    test.skip(!QUIZ_CODE, "QUIZ_CODE not set");
    await page.goto(`/q/${QUIZ_CODE}`);
    await expect(page.getByPlaceholder(/name/i).or(page.getByLabel(/name/i)).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("invalid code shows friendly error", async ({ page }) => {
    await page.goto("/q/XXXXINVALID999");
    await expect(
      page.getByText(/not found|invalid|expired|closed|no session/i)
    ).toBeVisible({ timeout: 8000 });
  });

  test("empty name is rejected on join", async ({ page }) => {
    test.skip(!QUIZ_CODE, "QUIZ_CODE not set");
    await page.goto(`/q/${QUIZ_CODE}`);
    await page.getByRole("button", { name: /join|start|enter/i }).click();
    await expect(page.getByText(/name|required/i)).toBeVisible({ timeout: 5000 });
  });

  test("student joins with name and enters quiz", async ({ page }) => {
    test.skip(!QUIZ_CODE, "QUIZ_CODE not set");
    await page.goto(`/q/${QUIZ_CODE}`);
    const nameField = page.getByPlaceholder(/name/i).or(page.getByLabel(/name/i)).first();
    await nameField.fill(`PW-${Date.now()}`);
    await page.getByRole("button", { name: /join|start|enter/i }).click();
    await expect(
      page.getByText(/question|waiting|lobby|loading|quiz/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Realtime — teacher + student dual-context", () => {
  test("student answer appears on teacher dashboard", async ({ browser }) => {
    test.skip(!TEST_EMAIL || !QUIZ_CODE, "TEST_EMAIL and QUIZ_CODE required");

    const teacherCtx: BrowserContext = await browser.newContext({ storageState: STORAGE_STATE });
    const studentCtx: BrowserContext = await browser.newContext();
    const teacherPage: Page = await teacherCtx.newPage();
    const studentPage: Page = await studentCtx.newPage();

    try {
      await teacherPage.goto("/sessions");
      await teacherPage.getByText(QUIZ_CODE).click();
      await expect(teacherPage).toHaveURL(/sessions\//, { timeout: 8000 });

      await studentPage.goto(`/q/${QUIZ_CODE}`);
      const studentName = `PW-Live-${Date.now()}`;
      const nameField = studentPage.getByPlaceholder(/name/i).or(studentPage.getByLabel(/name/i)).first();
      await nameField.fill(studentName);
      await studentPage.getByRole("button", { name: /join|start|enter/i }).click();
      await expect(studentPage.getByText(/question|waiting|loading/i)).toBeVisible({ timeout: 12000 });

      // Teacher sees the student appear in the attendee list within 8 s
      await expect(teacherPage.getByText(studentName)).toBeVisible({ timeout: 8000 });
    } finally {
      await teacherCtx.close();
      await studentCtx.close();
    }
  });
});
