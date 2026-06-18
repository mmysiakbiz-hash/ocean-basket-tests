const { test, expect } = require('@playwright/test');
const { liveConfigured, skipReason, cfg } = require('./helpers/env');
const { placeTestOrder } = require('./helpers/flow');

test.describe('LIVE — customer order (real API + Supabase)', () => {
  test.skip(!liveConfigured(), skipReason());

  test('places a real order and returns a confirmation code', async ({ page }) => {
    const code = await placeTestOrder(page, cfg().appUrl);
    expect(code).toMatch(/^OCB-/);
    await expect(page.locator('#s-success svg').first()).toBeVisible(); // QR
    await expect(page.locator('#s-success')).toContainText(code);
  });
});
