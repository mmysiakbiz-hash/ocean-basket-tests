const { test, expect } = require('@playwright/test');
const { mockApi } = require('./helpers/mockApi');

// Travel Box: next-day date rule, 20 kg cap, box charges, certificate → confirmation.
async function openApp(page) {
  await mockApi(page);
  await page.goto('ocean-basket-app.html');
  await page.waitForFunction(() => typeof window.tbStart === 'function' && Array.isArray(window.CATALOG) && window.CATALOG.length > 0);
}
async function startFlight(page, dateDaysFromToday) {
  await page.evaluate((days) => {
    window.tbStart();
    window.state.tb.shop = 'plaisance';
    const d = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    el('tb-date').value = d;
    el('tb-ftime').value = '10:00';
    el('tb-ctime').value = '08:00';
    window.tbValidateFlight();
  }, dateDaysFromToday);
}

test('date rule: today is blocked, next-day is accepted', async ({ page }) => {
  await openApp(page);
  await startFlight(page, 0); // today
  await expect(page.locator('#tb-rej')).toBeVisible();        // rejected
  await startFlight(page, 1); // tomorrow
  await page.waitForFunction(() => window.state && window.state.screen === 'tb-shop');
  expect(await page.evaluate(() => window.state.screen)).toBe('tb-shop');
});

test('20 kg cap blocks an add that would exceed it', async ({ page }) => {
  await openApp(page);
  await startFlight(page, 1);
  await page.waitForFunction(() => window.state.screen === 'tb-shop');
  await page.evaluate(() => window.openProduct('red_snapper', true));
  await page.waitForFunction(() => Array.isArray(window.AVAIL) && window.AVAIL.length > 0);
  const lenAfter = await page.evaluate(() => {
    window.setPState('fresh'); window.setPCut('whole'); window.setPacks(6); // RS-F-WH-900 = 5.5 kg
    window.state.tb.items = [{ uid:'X', weight:16, price:100, packs:1, grams:16000, name:'pre', speciesId:'jobfish', state:'fresh', cut:'whole', exp:Date.now()+600000, extended:false }];
    window.tbAddFromProduct(); // 16 + 5.5 = 21.5 > 20 -> blocked synchronously, no fetch
    return window.state.tb.items.length;
  });
  expect(lenAfter).toBe(1); // the 5.5 kg item was NOT added
});

test('box charges: allocation tier + service-per-box + certificate', async ({ page }) => {
  await openApp(page);
  const small = await page.evaluate(() => {
    window.state.tb.items = [{ weight: 3, price: 600 }];
    return { label: window.tbBoxPreview(3).label, boxes: window.tbBoxPreview(3).boxes, svc: window.tbServiceCharge(), cert: window.tbCertCharge(), total: window.tbTotal() };
  });
  expect(small.label).toMatch(/Small/);
  expect(small.svc).toBe(80);     // 1 box x 80
  expect(small.cert).toBe(50);
  expect(small.total).toBe(730);  // 600 + 80 + 50

  const big = await page.evaluate(() => {
    window.state.tb.items = [{ weight: 16, price: 1000 }];
    return { boxes: window.tbBoxPreview(16).boxes, svc: window.tbServiceCharge() };
  });
  expect(big.boxes).toBe(2);      // >15 kg -> two boxes
  expect(big.svc).toBe(160);      // 2 x 80
});

test('certificate flow reaches confirmation with QR + certificate-pending order', async ({ page }) => {
  await openApp(page);
  await startFlight(page, 1);
  await page.waitForFunction(() => window.state.screen === 'tb-shop');
  // add one fish to the box
  await page.evaluate(() => window.openProduct('jobfish', true));
  await page.waitForFunction(() => Array.isArray(window.AVAIL) && window.AVAIL.length > 0);
  await page.evaluate(() => { window.setPCut('fillet'); window.setPacks(2); });
  await page.getByRole('button', { name: /Add to Travel Box/i }).click();
  await page.waitForFunction(() => window.state.tb.items.length > 0);
  // go to box -> certificate
  await page.evaluate(() => { if (window.tbToBox) window.tbToBox(); else { window.renderTbBox(); window.go('tb-box'); } });
  await page.evaluate(() => { window.renderTbCollect(); window.go('tb-collect'); });
  await page.fill('#tb-tname', 'Test Traveller');
  await page.fill('#tb-tpass', 'P1234567');
  await page.locator('#tbPayBtn').click();
  await page.waitForFunction(() => window.state.screen === 'tb-success');
  await expect(page.locator('#tb-success-host svg').first()).toBeVisible();  // QR
  await expect(page.locator('#tb-success-host')).toContainText(/OCB-T/);     // travel order code
  expect(await page.evaluate(() => (window.state.orders[0] || {}).status)).toBe('certificate_pending');
});
