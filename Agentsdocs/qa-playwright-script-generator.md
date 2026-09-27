---
name: qa-playwright-script-generator
description: "Convert manual/structured test cases into executable Playwright TypeScript automation using the Page Object Model — with strict TypeScript-safety rules and a semantic-locator priority order that survives DOM changes better than brittle selectors. Use when test cases already exist and need to become runnable automation. Trigger phrases: automate these test cases, write Playwright scripts, generate page objects, convert to automation."
argument-hint: "[paste test cases, ideally qa-test-case-generator's JSON output, plus the target app URL]"
license: MIT
metadata:
  author: QA Orchestrator (Palkit Rathod)
  version: "1.0.0"
  source: extracted from the QA Orchestrator multi-agent pipeline's Script Generator agent
---

# QA Playwright Script Generator

Converts human-readable (or `qa-test-case-generator`-produced) test cases into real, runnable Playwright TypeScript — Page Object Model pages plus spec files, not pseudo-code. The rules here exist because they were learned the hard way: locators that don't survive a DOM change, TypeScript that doesn't compile, preconditions that quietly assume state from a previous test.

## When to use this

- Test cases already exist (manual or from `qa-test-case-generator`) and need to become real automation.
- Trigger phrases: "automate this test case", "write the Playwright script for this", "generate a page object for this flow".

## Mandatory rules

1. **Use the Page Object Model.** Page classes (e.g. `LoginPage.ts`) encapsulate locators and actions; spec files (e.g. `login.spec.ts`) import the page classes and hold the assertions. Don't mix the two.
2. **All spec code lives inside `test()` blocks**: `test('description', async ({ page }) => { ... })`. Never top-level `await`, never a top-level `page` reference outside a test/hook.
3. **Preconditions must be automated, not assumed.** If a test case's precondition says "user must be logged in," the test performs the actual login as its first steps:
   ```ts
   const loginPage = new LoginPage(page);
   await page.goto(process.env.TARGET_APP_URL ?? '');
   await loginPage.login(process.env.USERNAME ?? '', process.env.PASSWORD ?? '');
   ```
   Every test is independent and starts from scratch — never assume state carries over from a previous test. The `LoginPage` class needs a `login(username, password)` helper that fills and submits credentials.
4. **Locator strategy — semantic, in this priority order** (never app-specific attribute selectors like `[data-test="..."]`, since the target app changes per run):
   1. `getByRole('button', { name: /submit|login|sign in/i })` — for buttons.
   2. `getByLabel(/username|email/i)` — for labelled inputs.
   3. `getByPlaceholder(/username|email/i)` — for placeholder-based inputs.
   4. `input[type="password"]` — for password fields (reliably present, structurally).
   5. `input[type="email"]`, `input[type="text"]:first-of-type` — for generic text inputs.
   6. `[role="alert"], .error, .error-message` — for error/validation messages.
5. **Every test has explicit assertions** (`expect()`). Never leave a placeholder comment like `// Add assertion` — that's not a test, it's a stub pretending to be one.
6. **No hardcoded credentials, URLs, or app-specific selectors.** Use `process.env` (`TARGET_APP_URL`, `USERNAME`, `PASSWORD`).
7. **Output must compile.** Valid TypeScript, no syntax errors — see the strict-safety rules below, which exist specifically because violating them breaks `tsc --noEmit`.

## TypeScript strict-safety rules

These aren't style preferences — breaking them fails compilation.

| Rule | Wrong | Right |
|---|---|---|
| **Env vars are `string \| undefined`** | `process.env.USERNAME` | `process.env.USERNAME ?? ''` |
| **Page-object members used from spec files must be accessible** | `private usernameInput: Locator` | `public get usernameInput() { return this.page.locator(...); }` |
| **Never instantiate a page object at module scope** | `const loginPage = new LoginPage(page);` at the top of the file | Instantiate inside `test()` or `test.beforeEach()`, where `page` actually exists |
| **Import page classes by exact relative path** | — | `import { LoginPage } from '../pages/LoginPage';` |
| **Every method a spec calls must exist on the page object** | Spec calls `clickLogout()`, page object has no such method | Implement it: `public async clickLogout() { await this.page.getByRole('button', { name: /menu/i }).click(); await this.page.getByRole('link', { name: /logout/i }).click(); }` |

## Process

1. Read the test cases. Group by the flow they exercise (login, checkout, etc.) so shared page objects get reused rather than redefined per test.
2. Identify the page objects needed and their actions/locators, following the semantic-locator priority order.
3. Write the page object files first, then the spec files that import them.
4. Map each test case's `steps` to concrete Playwright actions and each `expected_result` to a concrete `expect()` assertion — don't lose fidelity between the test case's intent and the code's behavior.
5. If a test case's precondition requires setup this skill can't know how to automate generically (e.g. seeding specific backend data), say so explicitly in a comment rather than silently skipping it or faking it.

## Output format

Return a JSON structure (or write files directly, if working in a real project) with file paths and full content:

```json
{
  "files": [
    { "path": "tests/pages/LoginPage.ts", "content": "..." },
    { "path": "tests/specs/login.spec.ts", "content": "..." }
  ]
}
```

## After generating

Flag anything that couldn't be fully automated (e.g. a test case marked `automatable: false` in `qa-test-case-generator`'s output) rather than forcing brittle automation onto something that genuinely needs a human — a false-positive automated test that doesn't test what it claims is worse than an honestly-manual one.

---

## License & attribution

MIT License — © 2026 Palkit Rathod. Free to use, modify, and redistribute, including commercially, provided this notice is retained.

Part of the [QA Orchestrator](https://qa-orchestrator-backend-vwvm.onrender.com) skills pack, extracted from its live multi-agent QA pipeline — built by [Palkit Rathod](https://github.com/palkitrathod).
