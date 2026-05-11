/**
 * Live session flow: teacher starts session → student joins → answers appear on teacher screen.
 *
 * This is the most critical integration test — it touches realtime, RLS, and the quiz engine.
 *
 * Requires:
 *   TEST_EMAIL / TEST_PASSWORD   — teacher account
 *   QUIZ_CODE                    — an active session code (or the test creates one)
 */
import { test, expect, Page, BrowserContext } from "@playwright/test";

const email    = process.env.TEST_EMAIL    || "";
const password = process.env.TEST_PASSWORD || "";
const quizCode = process.env.QUIZ_CODE     || "";

test.skip(!email || !quizCode, "TEST_EMAIL and QUIZ_CODE required for live session tests");

test("student answer appears on teacher dashboard in realtime", async ({ browser }) => {
  // Open two browser contexts — one teacher, one student
  const teacherCtx: BrowserContext = await browser.newContext();
  const studentCtx: BrowserContext = await browser.newContext();

  const teacherPage: Page = await teacherCtx.newPage();
  const studentPage: Page = await studentCtx.newPage();

  try {
    // Teacher: login and navigate to session
    await teacherPage.goto("/login");
    await teacherPage.getByLabel(/email/i).fill(email);
    await teacherPage.getByLabel(/password/i).fill(password);
    await teacherPage.getByRole("button", { name: "Log in" }).click();
    await teacherPage.waitForURL(/dashboard/, { timeout: 12000 });
    await teacherPage.goto("/sessions");
    // Find and open the session matching QUIZ_CODE
    await teacherPage.getByText(quizCode).click();
    await expect(teacherPage).toHaveURL(/sessions\//, { timeout: 8000 });

    // Student: join quiz
    await studentPage.goto(`/q/${quizCode}`);
    const nameField = studentPage.getByPlaceholder(/name/i).or(studentPage.getByLabel(/name/i)).first();
    const studentName = `PW-Live-${Date.now()}`;
    await nameField.fill(studentName);
    await studentPage.getByRole("button", { name: /join|start|enter/i }).click();
    await expect(studentPage.getByText(/question|waiting|loading/i)).toBeVisible({ timeout: 12000 });

    // Teacher: student appears in the attendee list within 5s
    await expect(teacherPage.getByText(studentName)).toBeVisible({ timeout: 8000 });
  } finally {
    await teacherCtx.close();
    await studentCtx.close();
  }
});
