const { test, expect } = require('@playwright/test');
const { mockApi } = require('./helpers/mockApi');

// Drives the real UI (with the API mocked) through the flows that matter:
// product → cart hold/extend/remove → checkout → confirmation, delivery pricing, order lookup.

async function openApp(page, opts) {
  await mockApi(page, opts);
  await page.goto('ocean-basket-app.html');
  await page.waitForFunction(() => typeof window.openProduct === 'function' && Array.isArray(window.CATALOG) && window.CATALOG.length > 0);
}

async function addToCart(page, speciesId, cut, packs) {
  await page.evaluate((id) => window.openProduct(id), speciesId);
  await page.waitForFunction(() => Array.isArray(window.AVAIL) && window.AVAIL.length > 0);
  await page.evaluate(({ cut, packs }) => { window.setPCut(cut); window.setPacks(packs); }, { cut, packs });
  await page.waitForFunction(() => { try { return window.recsFor().length > 0; } catch (e) { return false; } });
  await page.getByRole('button', { name: /Add to (Basket|Travel Box)/i }).click();
  await page.waitForFunction(() => window.state && window.state.screen === 'cart');
}

test('home shows the two entry tiles', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('button', { name: /Start order/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start box/i })).toBeVisible();
});

test('add to cart shows a stock hold + countdown', async ({ page }) => {
  await openApp(page);
  await addToCart(page, 'jobfish', 'fillet', 3);
  await expect(page.locator('.hold-bar')).toBeVisible();
  await expect(page.getByText(/Stock is held/i)).toBeVisible();
  await expect(page.locator('.hold-bar .cd')).toHaveText(/\d+:\d{2}/);
});

test('extend once hides the Extend button', async ({ page }) => {
  await openApp(page);
  await addToCart(page, 'jobfish', 'fillet', 3);
  const extend = page.getByRole('button', { name: 'Extend' });
  await expect(extend).toBeVisible();
  await extend.click();
  await expect(extend).toHaveCount(0); // second extend not possible
});

test('remove empties the cart', async ({ page }) => {
  await openApp(page);
  await addToCart(page, 'jobfish', 'fillet', 3);
  await expect(page.locator('.cart-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('.cart-item')).toHaveCount(0);
});

test('door-to-door is SILVER (150) under the free-delivery threshold', async ({ page }) => {
  await openApp(page);
  await addToCart(page, 'jobfish', 'fillet', 3); // 194 < 3000
  await page.evaluate(() => { window.go('delivery'); window.setFulfil('delivery'); });
  const fee = page.locator('.fee', { hasText: 'SILVER' });
  await expect(fee).toBeVisible();
  await expect(fee).toContainText('150');
});

test('door-to-door is GOLD + free above the threshold', async ({ page }) => {
  await openApp(page);
  await addToCart(page, 'red_snapper', 'whole', 6); // RS-F-WH-900 = 3410 > 3000
  await page.evaluate(() => { window.go('delivery'); window.setFulfil('delivery'); });
  await expect(page.locator('.fee', { hasText: 'GOLD' })).toBeVisible();
});

test('checkout (drop-off) reaches confirmation with QR + order code', async ({ page }) => {
  await openApp(page);
  await addToCart(page, 'jobfish', 'fillet', 3);
  await page.evaluate(() => { window.go('delivery'); window.setFulfil('pickup'); window.setPoint(1); window.go('payment'); });
  await page.fill('#f-name', 'Playwright Test');
  await page.fill('#f-phone', '+248 4000000');
  await page.locator('#payBtn').click();
  await page.waitForFunction(() => window.state && window.state.screen === 'success');
  await expect(page.locator('#s-success svg').first()).toBeVisible();           // QR
  await expect(page.locator('#s-success')).toContainText(/OCB-L/);              // order code
});

test('order lookup by code shows the order', async ({ page }) => {
  await openApp(page, { knownOrders: {
    'OCB-L-260618-1002': { id:'OCB-L-260618-1002', total:302, type:'local', fulfilment:'dropoff', drop_point_id:'D01', status:'paid', items:[] }
  }});
  await page.evaluate(() => window.go('orders'));
  const box = page.locator('#order-lookup');
  await expect(box).toBeVisible();
  await box.fill('OCB-L-260618-1002');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.locator('#orders-host')).toContainText('OCB-L-260618-1002');
});
