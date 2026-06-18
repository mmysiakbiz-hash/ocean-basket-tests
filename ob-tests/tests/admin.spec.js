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

  test('4-Shop Stock editor: barcode resolves, prefill, save upserts ob_shop_stock', async ({ page }) => {
    await page.evaluate(() => window.tab('shops'));
    await page.waitForSelector('#ss-shop');
    const prod = await page.evaluate(() => { el('ss-barcode').value = '54RD'; window.ssResolve(); return el('ss-prod').value; });
    expect(prod).toBe('red_snapper'); // product code -> product
    const prefill = await page.evaluate(() => {
      window.state.shopStock = [{ shop_id: 'plaisance', product_id: 'red_snapper', fresh_kg: 12.5, frozen_kg: 4 }];
      el('ss-shop').value = 'plaisance'; el('ss-prod').value = 'red_snapper'; window.ssPrefill();
      return { fresh: el('ss-fresh').value, frozen: el('ss-frozen').value };
    });
    expect(prefill).toEqual({ fresh: '12.5', frozen: '4' });
    const up = await page.evaluate(() => {
      el('ss-shop').value = 'beau_vallon'; el('ss-prod').value = 'tuna'; el('ss-fresh').value = '8.5'; el('ss-frozen').value = '3';
      window.__calls = []; window.ssSave();
      return (window.__calls || []).filter((c) => c.op === 'upsert' && c.table === 'ob_shop_stock')[0];
    });
    expect(up.payload).toMatchObject({ shop_id: 'beau_vallon', product_id: 'tuna', fresh_kg: 8.5, frozen_kg: 3 });
  });

  test('permissions gate the tabs by role', async ({ page }) => {
    const vis = await page.evaluate(() => {
      window.state.me = { role: 'staff', can_scan: true, can_edit_stock: false, can_view_orders: false, can_manage_routes: false, can_manage_users: false };
      window.applyGating();
      const v = (t) => { const b = document.querySelector('.tabs button[data-tab="' + t + '"]'); return !!(b && b.style.display !== 'none'); };
      return { scan: v('scan'), shops: v('shops'), orders: v('orders'), users: v('users'), dashboard: v('dashboard') };
    });
    expect(vis).toEqual({ scan: true, shops: false, orders: false, users: false, dashboard: true });
  });

  test('4-Shop editor is limited to the assigned shops', async ({ page }) => {
    const opts = await page.evaluate(() => {
      window.state.me = { role: 'staff', can_edit_stock: true, shop_ids: ['plaisance'] };
      window.renderShops();
      const s = document.getElementById('ss-shop');
      return s ? [...s.options].map((o) => o.value) : null;
    });
    expect(opts).toEqual(['plaisance']);
  });

  test('Users: a manager adds staff (upserts ob_staff); a non-manager gets no access', async ({ page }) => {
    const r = await page.evaluate(() => {
      window.state.me = { role: 'manager', can_manage_users: true };
      window.state.staff = [];
      window.renderUsers();
      const hasAdd = /\+ Add staff/.test(document.getElementById('p-users').innerHTML);
      window.userForm(null);
      el('u-email').value = 'nina@oceanbasket.sc'; el('u-name').value = 'Nina'; el('u-role').value = 'manager';
      el('u-can_view_orders').checked = true;
      window.__calls = []; window.userSave(null);
      const up = (window.__calls || []).filter((c) => c.op === 'upsert' && c.table === 'ob_staff')[0];
      return { hasAdd, payload: up ? up.payload : null };
    });
    expect(r.hasAdd).toBeTruthy();
    expect(r.payload).toMatchObject({ email: 'nina@oceanbasket.sc', role: 'manager', can_view_orders: true });

    const noAccess = await page.evaluate(() => {
      window.state.me = { role: 'staff', can_manage_users: false };
      window.renderUsers();
      return /permission to manage users/.test(document.getElementById('p-users').innerHTML);
    });
    expect(noAccess).toBeTruthy();
  });

  test('Pick & Stickers shows the customer phone', async ({ page }) => {
    const html = await page.evaluate(() => {
      window.state.orders = [{ id: 'OCB-L-77', status: 'paid', customer_name: 'Jan Kowalski', phone: '+248 251 5101', total: 900, type: 'local', fulfilment: 'pickup', drop_point_id: 'D01' }];
      window.state.units = [];
      return window.pickStickers();
    });
    expect(html).toContain('Jan Kowalski');
    expect(html).toContain('+248 251 5101');
    expect(html).toMatch(/stk-phone/);
  });

  test('no uncaught JS errors on load', async () => {
    expect(errors).toEqual([]);
  });
});
