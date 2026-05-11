import { defineConfig, devices } from "@playwright/test";

// Against production: set BASE_URL=https://evalutease-suite.vercel.app
// Note: Vercel WAF blocks headless browsers on production.
// Run against local dev server (npm run dev) for full test coverage.
const baseURL = process.env.BASE_URL || "http://localhost:3000";
const isProd  = baseURL.includes("vercel.app") || baseURL.includes("evalutease");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  // Auto-start local dev server unless pointing at a remote URL
  webServer: isProd ? undefined : {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Bypass bot-detection heuristics
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Non-headless when running locally for better bot-detection bypass
        headless: !!process.env.CI || !isProd,
        launchOptions: { args: ["--disable-blink-features=AutomationControlled"] },
      },
    },
  ],
});
