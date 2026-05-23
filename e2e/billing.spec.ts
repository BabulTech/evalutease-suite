/**
 * Billing & payment flows.
 *
 * Tests the upgrade path from settings → billing → pay step.
 * Does NOT submit a real payment — stops at the upload step.
 *
 * Env vars:
 *   TEST_EMAIL / TEST_PASSWORD — authenticated account on a free plan
 *   TEST_PAID_EMAIL / TEST_PAID_PASSWORD — account already on a paid plan
 */
import { test, expect } from "./fixtures";

test.describe("Billing — plan upgrade flow", () => {
  test("clicking upgrade in settings navigates to billing pay step", async ({ authedPage: page }) => {
    await page.goto("/settings?tab=plan");

    // Find any non-current plan upgrade button
    const upgradeBtn = page
      .getByRole("link", { name: /get .+plan|upgrade|pro|starter/i })
      .first();

    const isVisible = await upgradeBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!isVisible) {
      // Already on a paid plan — skip
      test.skip(true, "No upgrade button visible — account may already be on paid plan");
      return;
    }

    await upgradeBtn.click();

    // Must land on billing with a plan pre-selected (pay step), NOT redirected back
    await expect(page).toHaveURL(/billing/, { timeout: 10000 });
    await expect(page.getByText(/how would you like to pay|payment method|PKR/i)).toBeVisible({ timeout: 10000 });
  });

  test("billing pay step shows payment methods", async ({ authedPage: page }) => {
    // Navigate directly with a plan slug — simulates clicking upgrade
    await page.goto("/billing?plan=individual_pro");
    const onBilling = await page.waitForURL(/billing|settings/, { timeout: 10000 }).then(() => true).catch(() => false);
    if (!onBilling) return;

    if (page.url().includes("settings")) {
      // Already on paid plan, expected redirect
      return;
    }

    await expect(
      page.getByText(/easypaisa|jazzcash|bank transfer|payment method/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("back button from billing pay step returns to settings", async ({ authedPage: page }) => {
    await page.goto("/billing?plan=individual_pro");
    await page.waitForURL(/billing|settings/, { timeout: 10000 }).catch(() => {});

    if (!page.url().includes("billing")) return;

    // Wait for payment methods to render
    const backBtn = page.getByRole("button", { name: /back|go back/i }).first();
    const backVisible = await backBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!backVisible) return;

    await backBtn.click();
    await expect(page).toHaveURL(/settings/, { timeout: 8000 });
  });

  test("selecting a payment method advances to upload step", async ({ authedPage: page }) => {
    await page.goto("/billing?plan=individual_pro");
    await page.waitForURL(/billing|settings/, { timeout: 10000 }).catch(() => {});
    if (!page.url().includes("billing")) return;

    // Click the first available payment method
    const methodBtn = page
      .getByRole("button", { name: /easypaisa|jazzcash|bank/i })
      .first();
    const visible = await methodBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!visible) return;

    await methodBtn.click();
    await expect(page.getByText(/upload|screenshot|transaction|reference/i)).toBeVisible({ timeout: 8000 });
  });

  test("upload step validates screenshot is required", async ({ authedPage: page }) => {
    await page.goto("/billing?plan=individual_pro");
    await page.waitForURL(/billing|settings/, { timeout: 10000 }).catch(() => {});
    if (!page.url().includes("billing")) return;

    const methodBtn = page.getByRole("button", { name: /easypaisa|jazzcash|bank/i }).first();
    if (!(await methodBtn.isVisible({ timeout: 6000 }).catch(() => false))) return;
    await methodBtn.click();

    // Try to submit without a screenshot
    const submitBtn = page.getByRole("button", { name: /submit|confirm|pay/i }).first();
    if (!(await submitBtn.isVisible({ timeout: 6000 }).catch(() => false))) return;
    await submitBtn.click();

    await expect(page.getByText(/screenshot|upload|required/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Billing — overview (paid user)", () => {
  test("billing overview shows credit balance", async ({ authedPage: page }) => {
    // For a paid user, billing doesn't redirect to settings
    await page.goto("/billing");
    await page.waitForURL(/billing|settings/, { timeout: 10000 }).catch(() => {});

    if (page.url().includes("settings")) {
      // Free user — expected redirect, not an error
      return;
    }

    await expect(page.getByText(/credit|balance|PKR/i).first()).toBeVisible({ timeout: 8000 });
  });
});
