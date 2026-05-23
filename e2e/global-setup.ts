/**
 * Global setup: logs in once and saves browser storage state to
 * e2e/.auth/teacher.json. All authenticated tests reuse this state
 * instead of re-running the login flow.
 *
 * Skipped automatically when TEST_EMAIL is not set.
 */
import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORAGE_STATE = path.join(__dirname, ".auth", "teacher.json");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export default async function globalSetup() {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    console.log("[global-setup] TEST_EMAIL/TEST_PASSWORD not set — skipping auth setup.");
    return;
  }

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 15000 });

  await context.storageState({ path: STORAGE_STATE });
  await browser.close();

  console.log("[global-setup] Auth state saved to", STORAGE_STATE);
}
