import { defineConfig, devices } from "@playwright/test";
import path from "path";

const STORAGE_STATE = path.join("e2e", ".auth", "teacher.json");

const baseURL = process.env.BASE_URL || "http://localhost:5173";
const isProd = baseURL.includes("vercel.app") || baseURL.includes("evalutease");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  globalSetup: "./e2e/global-setup.ts",

  webServer: isProd
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 120_000,
      },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Bypass bot-detection heuristics
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  },

  projects: [
    // ── Unauthenticated setup project ─────────────────────────────────────────
    // Runs global-setup only; other projects depend on the saved storage state.
    {
      name: "setup",
      testMatch: /global-setup\.ts/,
    },

    // ── Desktop browsers ───────────────────────────────────────────────────────
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: !!process.env.CI,
        launchOptions: { args: ["--disable-blink-features=AutomationControlled"] },
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },

    // ── Mobile viewports ───────────────────────────────────────────────────────
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
      // Only run mobile.spec.ts in mobile projects to avoid duplication
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 14"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
      testMatch: /mobile\.spec\.ts/,
    },

    // ── Student / unauthenticated paths (no storageState needed) ──────────────
    {
      name: "quiz-join",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /quiz-join\.spec\.ts/,
    },
  ],
});
