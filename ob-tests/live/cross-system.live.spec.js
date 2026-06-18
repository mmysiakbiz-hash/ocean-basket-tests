const { test, expect } = require('@playwright/test');
const { liveConfigured, skipReason, cfg } = require('./helpers/env');
const { placeTestOrder, adminLogin } = require('./helpers/flow');

// The real cross-system check the mocked suite cannot do: an order placed in the
// customer app must appear in the admin Order Monitor (same real backend).
test.describe('LIVE — cross-system (order in app -> visible in admin)', () => {
  test.skip(!liveConfigured(), skipReason());

  test('an order placed in the app shows up in the admin Order Monitor', async ({ browser }) => {
    const c = cfg();
    const ctxApp = await browser.newContext();
    const app = await ctxApp.newPage();
    const code = await placeTestOrder(app, c.appUrl);
    expect(code).toMatch(/^OCB-/);

    const ctxAdmin = await browser.newContext();
    const admin = await ctxAdmin.newPage();
    await adminLogin(admin, c);
    await admin.evaluate(() => window.tab('orders'));
    await admin.evaluate(() => window.loadOrders && window.loadOrders({ render: true }));
    await expect(admin.locator('#p-orders')).toContainText(code, { timeout: 20000 });

    await ctxApp.close();
    await ctxAdmin.close();
  });
});
