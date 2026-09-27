import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/**
 * Sample spec — reference pattern for the Automation Generator agent.
 * - All code lives inside test() blocks (no top-level await / page).
 * - The page object is instantiated inside each test, never at module scope.
 * - Every test has an explicit expect() assertion.
 * - Credentials come from process.env with a ?? '' fallback (TS-safe).
 *
 * Traces to: REQ-001 (valid login), REQ-002 (locked-out / invalid credentials).
 */
test.describe('Login', () => {
  test('TC-001: Verify user logs in successfully with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(process.env.USERNAME ?? '', process.env.PASSWORD ?? '');

    // Expected: the user reaches the inventory page after a successful login.
    await expect(page).toHaveURL(/inventory/i);
  });

  test('TC-002: Verify login fails with an invalid password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(process.env.USERNAME ?? '', 'definitely_wrong_password');

    // Expected: an error is shown and the user remains on the login page.
    await expect(loginPage.errorMessage).toBeVisible();
  });

  test('TC-003: Verify login fails when the username field is left empty', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('', process.env.PASSWORD ?? '');

    await expect(loginPage.errorMessage).toBeVisible();
  });
});
