import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env if present (TARGET_APP_URL, USERNAME, PASSWORD).
// override: true is REQUIRED because Windows defines a built-in USERNAME env var
// (the OS account name). Without override, dotenv leaves that OS value in place and
// the .env USERNAME is silently ignored — logins then run with the wrong username.
dotenv.config({ override: true });

export default defineConfig({
  testDir: './tests/specs',
  // Every test is independent; fail fast on accidental shared state.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // list for humans, json for the Execution Agent to parse machine-readable results.
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.TARGET_APP_URL ?? 'https://www.saucedemo.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
