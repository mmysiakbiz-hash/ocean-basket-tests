const { defineConfig, devices } = require('@playwright/test');

// Where the app is served. Default = live GitHub Pages. For local validation:
//   BASE_URL=file:///tmp/site npx playwright test
let BASE = process.env.BASE_URL || 'https://mmysiakbiz-hash.github.io/storefront';
if (!BASE.endsWith('/')) BASE += '/';

// In CI we use the browser from `npx playwright install chromium`.
// For sandboxes without download access, set CHROME_PATH to an existing Chromium.
const launchOptions = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 8000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE,
    actionTimeout: 10000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
