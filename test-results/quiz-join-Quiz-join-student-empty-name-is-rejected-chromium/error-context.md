# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: quiz-join.spec.ts >> Quiz join (student) >> empty name is rejected
- Location: e2e\quiz-join.spec.ts:20:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /join|start|enter/i })

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
      - paragraph [ref=e10]: sin1::1778478968-u7yhB6n9QyJT1JkwuloO2dmloPmJtrnX
```