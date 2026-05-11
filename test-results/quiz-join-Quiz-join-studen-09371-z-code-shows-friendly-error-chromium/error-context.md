# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: quiz-join.spec.ts >> Quiz join (student) >> invalid quiz code shows friendly error
- Location: e2e\quiz-join.spec.ts:27:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/not found|invalid|expired|closed/i)
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for getByText(/not found|invalid|expired|closed/i)

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
      - paragraph [ref=e10]: sin1::1778478974-6YsB42OKvnDf6OlpabzW5KAB3Sp9cyu7
```