// Automation Generator agent.
// From the crawl context + structured test cases, generates a real Playwright
// Test suite (Page Object + spec files) — matching the hand-written tests/ style:
// semantic locators (role/label/placeholder), real data entry, specific
// assertions, one page object per app, test.describe/expect. No BDD/Cucumber.
const path = require('path');
const { readJson, writeFile, log, slug } = require('./lib');

// ---------- Page Object with semantic locators ----------
function pageObject(ctx) {
  const s = ctx.structure || {};
  const forms = s.forms || [];
  const fields = (forms.length ? forms[0].inputs : s.inputs || []).filter((f) => f.name);

  // For each field, emit a getter using the semantic priority order, plus a
  // fill helper. Password/email/text get the right locator strategy.
  const fieldMembers = fields
    .slice(0, 12)
    .map((f) => {
      const m = camel(f.name);
      const loc = locatorFor(f);
      return `  get ${m}(): Locator {
    return ${loc};
  }

  async fill_${m}(value: string): Promise<void> {
    await this.${m}.clear();
    await this.${m}.fill(value);
  }`;
    })
    .join('\n\n');

  return `import { Page, Locator } from '@playwright/test';

/**
 * Auto-generated Page Object for ${ctx.title || ctx.url}.
 * Semantic locators (role/label/placeholder) preferred over brittle attribute
 * selectors, mirroring the project's hand-written page-object standard.
 */
export class AppPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(process.env.TARGET_APP_URL ?? '${ctx.url}', { waitUntil: 'domcontentloaded' });
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  get submitButton(): Locator {
    return this.page
      .getByRole('button', { name: /submit|login|sign in|continue|search|go/i })
      .or(this.page.locator('input[type="submit"], button[type="submit"]'))
      .first();
  }

  get errorMessage(): Locator {
    return this.page.locator('[role="alert"], .error, .error-message, [data-test="error"]').first();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

${fieldMembers || '  // (no named form fields were discovered on the target)'}
}
`;
}

function camel(name) {
  return String(name).replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^[A-Z]/, (c) => c.toLowerCase()) || 'field';
}

// semantic locator, field-type aware
function locatorFor(f) {
  const nm = f.name;
  if (f.type === 'password') return `this.page.locator('input[type="password"], [name="${nm}"], #${nm}').first()`;
  if (f.type === 'email') return `this.page.getByRole('textbox', { name: /email/i }).or(this.page.locator('input[type="email"], [name="${nm}"], #${nm}')).first()`;
  const label = new RegExp((f.placeholder || nm).replace(/[^a-z0-9]+/gi, '|'), 'i').source;
  return `this.page.getByLabel(/${label}/i).or(this.page.getByPlaceholder(/${label}/i)).or(this.page.locator('[name="${nm}"], #${nm}')).first()`;
}

// ---------- spec generation ----------
function assertionCode(assertion) {
  const a = String(assertion).toLowerCase().trim();
  let m;
  if ((m = a.match(/^url contains (.+)$/))) {
    const frag = m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `    await expect(page).toHaveURL(/${frag}/i);`;
  }
  if ((m = a.match(/^text (.+) is visible$/))) {
    return `    await expect(page.getByText(/${escapeRe(m[1])}/i).first()).toBeVisible();`;
  }
  if ((m = a.match(/^element (.+) is visible$/))) {
    return `    await expect(page.locator(${JSON.stringify(m[1])}).first()).toBeVisible();`;
  }
  if (/error/.test(a)) return `    await expect(app.errorMessage).toBeVisible();`;
  return `    expect(await app.title()).toBeTruthy();`;
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function actionCode(act) {
  if (act.goto) return `    await app.goto();`;
  if (act.fill) {
    const v = String(act.value || '');
    const val = v.startsWith('env:') ? `process.env.${v.slice(4)} ?? ''` : JSON.stringify(v);
    return `    await app.fill_${camel(act.fill)}(${val});`;
  }
  if (act.fillInvalid) return `    await app.fill_${camel(act.fillInvalid)}('invalid_${camel(act.fillInvalid)}_value');`;
  if (act.fillEmpty) return `    await app.fill_${camel(act.fillEmpty)}('');`;
  if (act.click) return `    await app.submit();`;
  return `    // (no-op)`;
}

function specFor(storyTitle, cases) {
  const body = cases
    .map((c) => {
      const steps = (c.actions || []).map(actionCode).join('\n');
      return `  test(${JSON.stringify(`${c.id}: ${c.title}`)}, async ({ page }) => {
    const app = new AppPage(page);
${steps}
${assertionCode(c.assertion)}
  });`;
    })
    .join('\n\n');

  return `import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/AppPage';

// ${storyTitle}
test.describe(${JSON.stringify(storyTitle)}, () => {
${body}
});
`;
}

function run(runDir) {
  const ctx = readJson(path.join(runDir, 'requirements', 'crawl-context.json'));
  const { cases } = readJson(path.join(runDir, 'testcases', 'test-cases.json'));
  const { stories } = readJson(path.join(runDir, 'requirements', 'user-stories.json'));

  const scriptsDir = path.join(runDir, 'test-scripts');
  const files = [];

  // one page object for the app
  files.push(writeFile(path.join(scriptsDir, 'pages', 'AppPage.ts'), pageObject(ctx)));

  // group cases by story -> one spec per story
  const titleFor = (id) => (stories.find((s) => s.id === id) || {}).title || 'Suite';
  const byStory = {};
  cases.forEach((c) => ((byStory[c.story_id] = byStory[c.story_id] || []).push(c)));
  Object.entries(byStory).forEach(([storyId, storyCases]) => {
    const title = storyId.includes('+') ? 'End-to-end journey' : titleFor(storyId);
    const fname = storyId.includes('+') ? 'e2e-journey' : `${storyId.toLowerCase()}-${slug(title)}`;
    files.push(writeFile(path.join(scriptsDir, 'specs', `${fname}.spec.ts`), specFor(title, storyCases)));
  });

  // a local playwright config so the suite can run standalone from the run dir
  const cfg = `import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config({ path: require('path').resolve(__dirname, '..', '..', '..', '.env'), override: true });
export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  use: {
    baseURL: process.env.TARGET_APP_URL ?? '${ctx.url}',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
`;
  files.push(writeFile(path.join(scriptsDir, 'playwright.config.ts'), cfg));

  log('automation-generator', `generated Playwright suite: 1 page object + ${Object.keys(byStory).length} spec file(s)`);
  return { ok: true, files: files.map((f) => path.relative(runDir, f)), specCount: Object.keys(byStory).length };
}

module.exports = { run };
