# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Teacher dashboard >> navigate to Sessions page
- Location: e2e\dashboard.spec.ts:32:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel(/email/i)

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - main [ref=e3]:
    - paragraph [ref=e4]: Failed to verify your browser
    - paragraph [ref=e5]: Code 21
  - contentinfo [ref=e6]:
    - generic [ref=e7]:
      - paragraph [ref=e8]: Vercel Security Checkpoint
      - paragraph [ref=e9]: "|"
      - paragraph [ref=e10]: sin1::1778478933-gQ7WfbBPzI5LkUJaqVujJBr13xHBaR59
```

# Test source

```ts
  1  | /**
  2  |  * Teacher dashboard flows.
  3  |  *
  4  |  * Requires a logged-in teacher account:
  5  |  *   BASE_URL=https://evalutease-suite.vercel.app
  6  |  *   TEST_EMAIL=teacher@example.com
  7  |  *   TEST_PASSWORD=password
  8  |  */
  9  | import { test, expect, Page } from "@playwright/test";
  10 | 
  11 | const email    = process.env.TEST_EMAIL    || "";
  12 | const password = process.env.TEST_PASSWORD || "";
  13 | 
  14 | async function loginAsTeacher(page: Page) {
  15 |   await page.goto("/login");
> 16 |   await page.getByLabel(/email/i).fill(email);
     |                                   ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  17 |   await page.getByLabel(/password/i).fill(password);
  18 |   await page.getByRole("button", { name: "Log in" }).click();
  19 |   await page.waitForURL(/dashboard/, { timeout: 12000 });
  20 | }
  21 | 
  22 | test.describe("Teacher dashboard", () => {
  23 |   test.beforeEach(async ({ page }) => {
  24 |     test.skip(!email, "TEST_EMAIL not set — skipping teacher dashboard tests");
  25 |     await loginAsTeacher(page);
  26 |   });
  27 | 
  28 |   test("dashboard loads with sessions list", async ({ page }) => {
  29 |     await expect(page.getByText(/session|quiz/i)).toBeVisible({ timeout: 8000 });
  30 |   });
  31 | 
  32 |   test("navigate to Sessions page", async ({ page }) => {
  33 |     await page.getByRole("link", { name: /sessions/i }).click();
  34 |     await expect(page).toHaveURL(/sessions/);
  35 |     await expect(page.getByRole("heading", { name: /sessions/i })).toBeVisible();
  36 |   });
  37 | 
  38 |   test("create new session button is visible", async ({ page }) => {
  39 |     await page.goto("/sessions");
  40 |     await expect(
  41 |       page.getByRole("button", { name: /new session|create session|add session/i })
  42 |         .or(page.getByRole("link", { name: /new session|create/i }))
  43 |     ).toBeVisible({ timeout: 8000 });
  44 |   });
  45 | 
  46 |   test("quiz history page loads", async ({ page }) => {
  47 |     await page.goto("/quiz-history");
  48 |     await expect(page.getByText(/history|past|attempt/i)).toBeVisible({ timeout: 8000 });
  49 |   });
  50 | 
  51 |   test("reports page loads", async ({ page }) => {
  52 |     await page.goto("/reports");
  53 |     await expect(page.getByText(/report|analytic|score/i)).toBeVisible({ timeout: 8000 });
  54 |   });
  55 | 
  56 |   test("settings page loads", async ({ page }) => {
  57 |     await page.goto("/settings");
  58 |     await expect(page.getByText(/setting|profile|account/i)).toBeVisible({ timeout: 8000 });
  59 |   });
  60 | });
  61 | 
```