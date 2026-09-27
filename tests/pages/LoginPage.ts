import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the login screen.
 *
 * Reference implementation for the Automation Generator agent:
 * - Locators are exposed as PUBLIC GETTERS (usable from spec files, TS-safe).
 * - Locator strategy follows the semantic priority order (role > label > placeholder
 *   > structural type selectors), never app-specific attribute selectors.
 * - No credentials or URLs are hardcoded; they come from process.env at call time.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  public get usernameInput(): Locator {
    // Priority: label -> placeholder -> generic text input.
    return this.page
      .getByLabel(/username|email/i)
      .or(this.page.getByPlaceholder(/username|email/i))
      .or(this.page.locator('input[type="text"]'))
      .first();
  }

  public get passwordInput(): Locator {
    return this.page.locator('input[type="password"]');
  }

  public get loginButton(): Locator {
    return this.page
      .getByRole('button', { name: /submit|login|sign in/i })
      .or(this.page.locator('input[type="submit"]'))
      .first();
  }

  public get errorMessage(): Locator {
    return this.page.locator('[role="alert"], .error, .error-message, [data-test="error"]').first();
  }

  /** Navigate to the app under test (baseURL is set in playwright.config.ts). */
  public async goto(): Promise<void> {
    await this.page.goto(process.env.TARGET_APP_URL ?? '/');
  }

  /** Precondition helper: perform a real login. Every test starts from scratch. */
  public async login(username: string, password: string): Promise<void> {
    // clear() guards against browser autofill leaking a value into the field
    // before we type (fill() replaces content, but clearing first is explicit).
    await this.usernameInput.clear();
    await this.usernameInput.fill(username);
    await this.passwordInput.clear();
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
