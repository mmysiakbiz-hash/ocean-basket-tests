const { test, expect } = require('@playwright/test');
const { stubSupabase } = require('./helpers/adminStub');

test.describe('Admin panel', () => {
  let errors;
  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await stubSupabase(page);
    await page.goto('ocean-basket-admin.html');
    await page.waitForSelector('.kpi', { timeout: 10000 }); // dashboard rendered = logged in
  });

  test('logs in (stubbed) and renders dashboard KPIs', async ({ page }) => {
    await expect(page.locator('.kpi').first()).toBeVisible();
    await expect(page.locator('#login')).toBeHidden();
  });

  test('Scan-In barcode auto-fills product / cut / price', async ({ page }) => {
    const filled = await page.evaluate(() => {
      el('sc-barcode').value = '54RD-F-WHO';
      resolveBarcode();
      return { prod: el('sc-prod').value, cut: el('sc-cut').value, price: el('sc-price').value };
    });
    expect(filled.prod).toBe('red_snapper');
    expect(filled.cut).toBe('whole');
    expect(String(filled.price)).toBe('620');
  });

  test('Order Monitor: "Packed" triggers ob_mark_packed', async ({ page }) => {
    await page.evaluate(() => window.tab('orders'));
    await page.getByRole('button', { name: 'Packed' }).first().click();
    const calls = await page.evaluate(() => window.__calls || []);
    expect(calls.some((c) => c.op === 'rpc' && c.fn === 'ob_mark_packed')).toBeTruthy();
  });

  test('Order Monitor: changing the status issues an update on ob_orders', async ({ page }) => {
    await page.evaluate(() => window.tab('orders'));
    const sel = page.locator('select.statpill').first();
    const target = await sel.evaluate((s) => [...s.options].map((o) => o.value).find((v) => v !== s.value));
    await sel.selectOption(target);
    const calls = await page.evaluate(() => window.__calls || []);
    expect(calls.some((c) => c.op === 'update' && c.table === 'ob_orders')).toBeTruthy();
  });

  test('no uncaught JS errors on load', async () => {
    expect(errors).toEqual([]);
  });
});
