const { test, expect } = require('@playwright/test');
const { liveConfigured, skipReason, cfg } = require('./helpers/env');
const { adminLogin } = require('./helpers/flow');

test.describe('LIVE — admin login (real Supabase Auth)', () => {
  test.skip(!liveConfigured(), skipReason());

  test('signs in with the test admin and loads the dashboard', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await adminLogin(page, cfg());
    await expect(page.locator('.kpi').first()).toBeVisible();
    await expect(page.locator('#login')).toBeHidden();
    expect(errors, 'No uncaught JS errors after a real login').toEqual([]);
  });
});
