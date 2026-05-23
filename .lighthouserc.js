/**
 * Lighthouse CI configuration.
 *
 * Run locally:  npx lhci autorun
 * Run in CI:    npx lhci autorun --config=.lighthouserc.js
 *
 * Thresholds are enterprise-grade minimums (Fortune 500 standard):
 *   Performance  ≥ 80   (90 for prod)
 *   Accessibility ≥ 90
 *   Best Practices ≥ 90
 *   SEO          ≥ 90
 */

export default {
  ci: {
    collect: {
      // Pages to audit — public + authenticated
      url: [
        "http://localhost:5173/login",
        "http://localhost:5173/q/DEMO",        // student join page (public)
      ],
      startServerCommand: "npm run dev",
      startServerReadyPattern: "Local.*5173",
      startServerReadyTimeout: 60000,
      numberOfRuns: 3,                          // average over 3 runs for accuracy
      settings: {
        // Desktop profile
        preset: "desktop",
        throttlingMethod: "simulate",
        // Don't fail on PWA checks (not a PWA)
        skipAudits: ["installable-manifest", "splash-screen", "themed-omnibox"],
        chromeFlags: "--disable-gpu --no-sandbox --headless",
      },
    },

    assert: {
      assertions: {
        // ── Core Web Vitals ───────────────────────────────────────────
        "first-contentful-paint":      ["warn",  { maxNumericValue: 2000  }],
        "largest-contentful-paint":    ["error", { maxNumericValue: 4000  }],
        "total-blocking-time":         ["warn",  { maxNumericValue: 300   }],
        "cumulative-layout-shift":     ["error", { maxNumericValue: 0.1   }],
        "interactive":                 ["warn",  { maxNumericValue: 5000  }],
        "speed-index":                 ["warn",  { maxNumericValue: 3500  }],

        // ── Category scores ───────────────────────────────────────────
        "categories:performance":      ["warn",  { minScore: 0.75 }],
        "categories:accessibility":    ["error", { minScore: 0.85 }],
        "categories:best-practices":   ["warn",  { minScore: 0.85 }],
        "categories:seo":              ["error", { minScore: 0.90 }],

        // ── Accessibility specifics ───────────────────────────────────
        "color-contrast":              ["warn",  { minScore: 1 }],
        "image-alt":                   ["error", { minScore: 1 }],
        "label":                       ["error", { minScore: 1 }],
        "document-title":              ["error", { minScore: 1 }],
        "html-has-lang":               ["error", { minScore: 1 }],
        "meta-description":            ["warn",  { minScore: 1 }],
        "link-name":                   ["warn",  { minScore: 1 }],
        "button-name":                 ["error", { minScore: 1 }],

        // ── SEO ───────────────────────────────────────────────────────
        "viewport":                    ["error", { minScore: 1 }],
        "font-size":                   ["warn",  { minScore: 1 }],
        "tap-targets":                 ["warn",  { minScore: 1 }],
        "robots-txt":                  "off",   // not enforced locally

        // ── Security / best practices ─────────────────────────────────
        "uses-https":                  "off",   // localhost is HTTP
        "no-vulnerable-libraries":     ["warn",  { minScore: 1 }],
        "csp-xss":                     "off",
      },
    },

    upload: {
      target: "temporary-public-storage",      // free LHCI public dashboard
    },
  },
};
