const { expect } = require('@playwright/test');

async function placeTestOrder(page, appUrl) {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof window.openProduct === 'function'
      && Array.isArray(window.CATALOG)
      && window.CATALOG.some((s) => s.id === 'jobfish'),
    { timeout: 30000 }
  );
  await page.evaluate(() => window.openProduct('jobfish'));
  await page.waitForFunction(() => Array.isArray(window.AVAIL), { timeout: 20000 });
  await page.evaluate(() => { window.setPCut('fillet'); window.setPacks(2); });
  await page.waitForFunction(() => { try { return window.recsFor().length > 0; } catch (e) { return false; } }, { timeout: 15000 }).catch(() => {});
  const recs = await page.evaluate(() => { try { return window.recsFor().length; } catch (e) { return 0; } });
  expect(recs, 'No online stock for jobfish/fresh/fillet on the target store — run v2_08 again.').toBeGreaterThan(0);

  await page.getByRole('button', { name: /Add to Basket/i }).click();
  await page.waitForFunction(() => window.state && window.state.screen === 'cart');
  await page.evaluate(() => { window.go('delivery'); window.setFulfil('pickup'); window.setPoint(1); window.go('payment'); });
  await page.fill('#f-name', 'Live Smoke Test');
  await page.fill('#f-phone', '+248 4000000');
  await page.locator('#payBtn').click();
  await page.waitForFunction(() => window.state && window.state.screen === 'success', { timeout: 25000 });
  return page.evaluate(() => ((window.state.orders && window.state.orders[0]) || {}).no || '');
}

async function adminLogin(page, c) {
  await page.goto(c.adminUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', c.email);
  await page.fill('#password', c.password);
  await page.locator('#loginBtn').click();
  await page.waitForSelector('.kpi', { timeout: 30000 });
}

module.exports = { placeTestOrder, adminLogin };
