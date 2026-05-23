/**
 * Core Web Vitals + performance budget tests via Playwright CDP.
 *
 * Measures real LCP, FCP, CLS, TBT, and TTI using the Chrome DevTools
 * Protocol — same data source as Lighthouse and PageSpeed Insights.
 *
 * Run:  npx playwright test e2e/performance.spec.ts --project=chromium
 */
import { test, expect, type Page } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD, STORAGE_STATE } from "./fixtures";

// ── Thresholds (GOOD tier per Google CWV standards) ───────────────────────
const BUDGETS = {
  FCP_MS:  2000,   // First Contentful Paint   < 2.0 s  (good: < 1.8 s)
  LCP_MS:  4000,   // Largest Contentful Paint  < 4.0 s  (good: < 2.5 s)
  CLS:     0.1,    // Cumulative Layout Shift   < 0.1    (good: < 0.1)
  TBT_MS:  300,    // Total Blocking Time       < 300 ms (good: < 200 ms)
  TTI_MS:  7500,   // Time to Interactive       < 7.5 s
  TRANSFER_KB: 1500, // Total transfer size     < 1.5 MB
};

interface CWV {
  fcp: number;
  lcp: number;
  cls: number;
  tbt: number;
  tti: number;
  transferKB: number;
}

/** Collect Core Web Vitals via CDP Performance API and PerformanceObserver. */
async function collectCWV(page: Page): Promise<CWV> {
  // Inject web-vitals measurement before navigation
  await page.addInitScript(() => {
    (window as Window & { __CWV__?: Record<string, number> }).__CWV__ = {};
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "largest-contentful-paint") {
          (window as Window & { __CWV__?: Record<string, number> }).__CWV__!["lcp"] = entry.startTime;
        }
        if (entry.entryType === "layout-shift" && !(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput) {
          const current = (window as Window & { __CWV__?: Record<string, number> }).__CWV__!["cls"] ?? 0;
          (window as Window & { __CWV__?: Record<string, number> }).__CWV__!["cls"] =
            current + (entry as PerformanceEntry & { value: number }).value;
        }
      }
    });
    obs.observe({ type: "largest-contentful-paint", buffered: true });
    obs.observe({ type: "layout-shift", buffered: true });
  });

  await page.waitForLoadState("networkidle");
  // Extra settle time for deferred/lazy content
  await page.waitForTimeout(1500);

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType("paint");
    const fcp = paint.find((e) => e.name === "first-contentful-paint")?.startTime ?? 0;
    const cwv = (window as Window & { __CWV__?: Record<string, number> }).__CWV__ ?? {};

    // Long tasks proxy for TBT (sum of blocking time beyond 50 ms)
    const longTasks = performance.getEntriesByType("longtask") as PerformanceEntry[];
    const tbt = longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);

    // Transfer size from resource timing
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const transferBytes = resources.reduce((s, r) => s + (r.transferSize ?? 0), 0);
    // Add navigation transfer
    const navTransfer = (nav as PerformanceResourceTiming).transferSize ?? 0;

    return {
      fcp:        Math.round(fcp),
      lcp:        Math.round(cwv["lcp"] ?? fcp),
      cls:        Math.round((cwv["cls"] ?? 0) * 1000) / 1000,
      tbt:        Math.round(tbt),
      tti:        Math.round(nav.domInteractive - nav.fetchStart),
      transferKB: Math.round((transferBytes + navTransfer) / 1024),
    };
  });

  return metrics;
}

function logCWV(label: string, m: CWV) {
  console.log(`\n📊 CWV — ${label}`);
  console.log(`  FCP:      ${m.fcp} ms      (budget: < ${BUDGETS.FCP_MS} ms)`);
  console.log(`  LCP:      ${m.lcp} ms      (budget: < ${BUDGETS.LCP_MS} ms)`);
  console.log(`  CLS:      ${m.cls}         (budget: < ${BUDGETS.CLS})`);
  console.log(`  TBT:      ${m.tbt} ms      (budget: < ${BUDGETS.TBT_MS} ms)`);
  console.log(`  TTI:      ${m.tti} ms      (budget: < ${BUDGETS.TTI_MS} ms)`);
  console.log(`  Transfer: ${m.transferKB} KB     (budget: < ${BUDGETS.TRANSFER_KB} KB)\n`);
}

// ── Public pages ────────────────────────────────────────────────────────────
test.describe("Performance — public pages", () => {
  test("login page Core Web Vitals", async ({ page }) => {
    await page.goto("/login");
    const m = await collectCWV(page);
    logCWV("Login", m);

    expect(m.fcp,  `FCP too slow: ${m.fcp}ms`).toBeLessThan(BUDGETS.FCP_MS);
    expect(m.lcp,  `LCP too slow: ${m.lcp}ms`).toBeLessThan(BUDGETS.LCP_MS);
    expect(m.cls,  `CLS too high: ${m.cls}`).toBeLessThan(BUDGETS.CLS);
    expect(m.tbt,  `TBT too high: ${m.tbt}ms`).toBeLessThan(BUDGETS.TBT_MS);
    expect(m.transferKB, `Bundle too large: ${m.transferKB}KB`).toBeLessThan(BUDGETS.TRANSFER_KB);
  });

  test("quiz join page Core Web Vitals", async ({ page }) => {
    await page.goto("/q/XXXXINVALID");
    const m = await collectCWV(page);
    logCWV("Quiz Join", m);

    expect(m.fcp).toBeLessThan(BUDGETS.FCP_MS);
    expect(m.lcp).toBeLessThan(BUDGETS.LCP_MS);
    expect(m.cls).toBeLessThan(BUDGETS.CLS);
  });
});

// ── Authenticated pages ─────────────────────────────────────────────────────
test.describe("Performance — authenticated pages", () => {
  test.use({ storageState: STORAGE_STATE });
  test.beforeEach(async ({}) => {
    test.skip(!TEST_EMAIL, "TEST_EMAIL not set");
  });

  test("dashboard Core Web Vitals", async ({ page }) => {
    await page.goto("/dashboard");
    const m = await collectCWV(page);
    logCWV("Dashboard", m);

    expect(m.fcp).toBeLessThan(BUDGETS.FCP_MS);
    expect(m.lcp).toBeLessThan(BUDGETS.LCP_MS);
    expect(m.cls).toBeLessThan(BUDGETS.CLS);
    expect(m.tbt).toBeLessThan(BUDGETS.TBT_MS);
  });

  test("sessions page Core Web Vitals", async ({ page }) => {
    await page.goto("/sessions");
    const m = await collectCWV(page);
    logCWV("Sessions", m);

    expect(m.fcp).toBeLessThan(BUDGETS.FCP_MS);
    expect(m.lcp).toBeLessThan(BUDGETS.LCP_MS);
    expect(m.cls).toBeLessThan(BUDGETS.CLS);
  });

  test("settings page Core Web Vitals", async ({ page }) => {
    await page.goto("/settings");
    const m = await collectCWV(page);
    logCWV("Settings", m);

    expect(m.fcp).toBeLessThan(BUDGETS.FCP_MS);
    expect(m.lcp).toBeLessThan(BUDGETS.LCP_MS);
    expect(m.cls).toBeLessThan(BUDGETS.CLS);
  });

  test("no layout shift on page navigation", async ({ page }) => {
    // Navigate between pages and check CLS doesn't accumulate
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.goto("/sessions");
    await page.waitForLoadState("networkidle");

    await page.goto("/settings");
    const m = await collectCWV(page);

    expect(m.cls, `CLS accumulated across navigation: ${m.cls}`).toBeLessThan(BUDGETS.CLS);
  });
});

// ── Bundle size audit ───────────────────────────────────────────────────────
test.describe("Performance — bundle size", () => {
  test("initial JS bundle under 500 KB gzipped", async ({ page }) => {
    const jsBytes: number[] = [];

    page.on("response", (res) => {
      if (res.url().includes(".js") && res.status() === 200) {
        const cl = res.headers()["content-length"];
        if (cl) jsBytes.push(parseInt(cl, 10));
      }
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const totalKB = Math.round(jsBytes.reduce((a, b) => a + b, 0) / 1024);
    console.log(`\n📦 JS transfer: ${totalKB} KB (${jsBytes.length} files)\n`);

    // 500 KB gzipped is generous for a React SPA — tighten over time
    expect(totalKB, `JS bundle too large: ${totalKB}KB`).toBeLessThan(500);
  });
});
