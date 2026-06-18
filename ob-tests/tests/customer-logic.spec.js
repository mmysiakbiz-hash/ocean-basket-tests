const { test, expect } = require('@playwright/test');
const { mockApi, UNITS } = require('./helpers/mockApi');

// Tests the pack-fit recommendation engine (recsFor) directly: set the available
// units + selection, call the app's own function, assert exact / combination / closest.
test.describe('Pack-fit engine (recsFor)', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('ocean-basket-app.html');
    await page.waitForFunction(() => typeof window.recsFor === 'function' && typeof window.speciesById === 'function');
  });

  async function recsFor(page, cut, packs) {
    return page.evaluate(({ units, cut, packs }) => {
      window.AVAIL = units;
      window.state.cart = [];
      window.state.product = window.speciesById('jobfish');
      window.state.cfg = { state: 'fresh', cut, packs };
      return window.recsFor().map(r => r.title);
    }, { units: UNITS, cut, packs });
  }

  test('exact match when a single pack equals the quantity', async ({ page }) => {
    const titles = await recsFor(page, 'fillet', 2);
    expect(titles.some(t => t.includes('Exact match') && t.includes('2 pack'))).toBeTruthy();
  });

  test('combination when two packs sum to the quantity (fillet)', async ({ page }) => {
    const titles = await recsFor(page, 'fillet', 3);
    expect(titles.some(t => t.includes('Combination') && t.includes('1+2'))).toBeTruthy();
  });

  test('closest only when nothing matches or combines', async ({ page }) => {
    const titles = await recsFor(page, 'fillet', 8); // max single is 4, max pair 3+4=7
    expect(titles.some(t => t.includes('Closest'))).toBeTruthy();
    expect(titles.some(t => t.includes('Exact match'))).toBeFalsy();
    expect(titles.some(t => t.includes('Combination'))).toBeFalsy();
  });
});
