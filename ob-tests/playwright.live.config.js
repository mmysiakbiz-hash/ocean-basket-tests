const { defineConfig, devices } = require('@playwright/test');
const launchOptions = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};

// Live smoke runs against REAL deployments + a real (ideally TEST) store.
// It is opt-in: without the LIVE_* / ADMIN_TEST_* env vars the specs skip.
module.exports = defineConfig({
  testDir: './live',
  timeout: 90000,
  expect: { timeout: 15000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1, // serial — these touch shared backend state
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report-live' }], ['list']],
  use: { actionTimeout: 20000, trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
