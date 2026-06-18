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
    el('tb-cdt').value = d + 'T08:00';
    el('tb-fdt').value = d + 'T10:00';
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

test('regression: adding a fish updates the weight meter on tb-shop (no stale 0 kg)', async ({ page }) => {
  await openApp(page);
  await startFlight(page, 1);
  await page.waitForFunction(() => window.state.screen === 'tb-shop');

  // meter starts empty
  const before = await page.evaluate(() => {
    const m = document.getElementById('tb-meter');
    return { now: m.querySelector('.wm-now').textContent.trim(), reviewDisabled: m.querySelector('.wm-btn').disabled };
  });
  expect(before.now).toMatch(/0\.00 kg/);
  expect(before.reviewDisabled).toBe(true);

  // add a 2-pack jobfish fillet (0.60 kg) via the REAL product-screen button + navigation
  await page.evaluate(() => window.openProduct('jobfish', true));
  await page.waitForFunction(() => Array.isArray(window.AVAIL) && window.AVAIL.length > 0);
  await page.evaluate(() => { window.setPCut('fillet'); window.setPacks(2); });
  await page.getByRole('button', { name: /Add to Travel Box/i }).click();
  await page.waitForFunction(() => window.state.tb.items.length > 0 && window.state.screen === 'tb-shop');

  // the meter on tb-shop MUST now reflect the added weight (this is exactly what the bug broke)
  const after = await page.evaluate(() => {
    const m = document.getElementById('tb-meter');
    return {
      now: m.querySelector('.wm-now').textContent.trim(),
      pct: m.querySelector('.wm-cap').textContent.trim(),
      barWidth: m.querySelector('.bar i').style.width,
      reviewDisabled: m.querySelector('.wm-btn').disabled,
      tbWeight: window.tbWeight(),
    };
  });
  expect(after.tbWeight).toBeGreaterThan(0);
  expect(after.now).toMatch(/0\.60 kg/);
  expect(after.pct).not.toBe('0%');
  expect(after.barWidth).not.toBe('0%');
  expect(after.reviewDisabled).toBe(false);
});

test('collection date/time rules (separate collection & flight dates)', async ({ page }) => {
  await openApp(page);
  function trip(cDays, fDays, ctime, ftime) {
    return page.evaluate(({ cDays, fDays, ctime, ftime }) => {
      window.tbStart();
      window.state.tb.shop = 'plaisance';
      const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
      el('tb-cdt').value = day(cDays) + 'T' + ctime;
      el('tb-fdt').value = day(fDays) + 'T' + ftime;
      window.tbValidateFlight();
      return window.state.screen;
    }, { cDays, fDays, ctime, ftime });
  }
  expect(await trip(1, 1, '11:00', '10:00')).toBe('tb-flight'); // same day, collection AFTER flight -> blocked
  expect(await trip(1, 1, '09:30', '10:00')).toBe('tb-flight'); // same day, only 30 min before -> blocked
  expect(await trip(1, 1, '08:00', '10:00')).toBe('tb-shop');   // same day, 2h before -> accepted
  expect(await trip(1, 2, '23:00', '06:00')).toBe('tb-shop');   // collect day before, fly next morning -> accepted
  expect(await trip(2, 1, '08:00', '10:00')).toBe('tb-flight'); // flight date before collection -> blocked
  expect(await trip(0, 0, '08:00', '10:00')).toBe('tb-flight'); // collection date today -> blocked
});
