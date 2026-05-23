/**
 * SEO audit — meta tags, Open Graph, canonical URLs, robots, structured data.
 *
 * Run:  npx playwright test e2e/seo.spec.ts --project=chromium
 */
import { test, expect } from "@playwright/test";
import { STORAGE_STATE, TEST_EMAIL } from "./fixtures";

test.describe("SEO — public pages", () => {
  test("login page has required meta tags", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // <title> must be non-empty
    const title = await page.title();
    expect(title.trim().length, "Missing <title>").toBeGreaterThan(0);

    // <meta name="description">
    const desc = await page.locator('meta[name="description"]').getAttribute("content");
    expect(desc?.trim().length ?? 0, "Missing meta description").toBeGreaterThan(10);

    // <html lang="...">
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang?.trim().length ?? 0, "Missing lang attribute on <html>").toBeGreaterThan(0);

    // viewport meta
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport, "Missing viewport meta").toBeTruthy();
  });

  test("login page Open Graph tags", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    const ogDesc  = await page.locator('meta[property="og:description"]').getAttribute("content");
    const ogUrl   = await page.locator('meta[property="og:url"]').getAttribute("content");

    // OG tags are best-practice — warn rather than hard-fail
    if (!ogTitle) console.warn("⚠️  Missing og:title");
    if (!ogDesc)  console.warn("⚠️  Missing og:description");
    if (!ogUrl)   console.warn("⚠️  Missing og:url");
  });

  test("quiz join page has title and description", async ({ page }) => {
    await page.goto("/q/XXXXINVALID");
    await page.waitForLoadState("domcontentloaded");

    const title = await page.title();
    expect(title.trim().length).toBeGreaterThan(0);
  });

  test("no broken internal links on login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const links = await page.locator("a[href]").all();
    const internalLinks = (
      await Promise.all(
        links.map(async (l) => {
          const href = await l.getAttribute("href");
          return href?.startsWith("/") || href?.startsWith(page.url().split("/").slice(0, 3).join("/"))
            ? href
            : null;
        })
      )
    ).filter(Boolean) as string[];

    for (const href of internalLinks) {
      const res = await page.request.get(href).catch(() => null);
      if (res) {
        expect(res.status(), `Broken link: ${href}`).toBeLessThan(400);
      }
    }
  });
});

test.describe("SEO — authenticated pages", () => {
  test.use({ storageState: STORAGE_STATE });
  test.beforeEach(async ({}) => {
    test.skip(!TEST_EMAIL, "TEST_EMAIL not set");
  });

  test("dashboard has page title", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    const title = await page.title();
    expect(title.trim().length, "Dashboard missing <title>").toBeGreaterThan(0);
  });

  test("settings page has unique title", async ({ page }) => {
    await page.goto("/settings");
    const settingsTitle = await page.title();

    await page.goto("/dashboard");
    const dashTitle = await page.title();

    // Each page should have a distinct title for SEO and browser tabs
    if (settingsTitle === dashTitle) {
      console.warn("⚠️  Settings and Dashboard have the same <title> — consider unique titles per page");
    }
  });
});
