// Mocks the Ocean Basket v2 API (Vercel) so tests are fast, deterministic,
// and NEVER touch real Supabase data. /bootstrap returns the REAL catalog
// (same shape/ids the backend serves) so the app behaves like production.

// ---- real catalog (mirrors v2_03_seed.sql) ----
const PRODUCTS_BASE = [
  ['red_snapper','54RD','Red Snapper',620,true,true],
  ['jobfish','42JF','Jobfish',185,true,true],
  ['grouper','35GR','Grouper',140,true,false],
  ['emperor','51EM','Emperor',150,true,true],
  ['parrotfish','22PF','Parrotfish',135,true,false],
  ['rabbitfish','18RF','Rabbitfish',125,true,true],
  ['tuna','11TU','Tuna',150,true,true],
  ['octopus','71OC','Octopus',210,true,true],
  ['crab','72CR','Crab',120,true,false],
  ['sauce','90SC','Sauces & Marinades',50,true,false],
];
const RS_VARIANTS = [['fresh','whole',620],['fresh','fillet',680],['fresh','portions',700],['fresh','heads',120],['frozen','fillet',590],['frozen','portions',560]];
function variantsFor(id, base, frozen) {
  if (id === 'red_snapper') return RS_VARIANTS.map(([state, cut, price]) => ({ state, cut, price_per_kg: price }));
  if (id === 'sauce') return [{ state: 'fresh', cut: 'bottle', price_per_kg: 0 }];
  const v = [{ state: 'fresh', cut: 'whole', price_per_kg: base }, { state: 'fresh', cut: 'fillet', price_per_kg: base + 30 }];
  if (frozen) v.push({ state: 'frozen', cut: 'portions', price_per_kg: base - 20 });
  return v;
}
const PRODUCTS = PRODUCTS_BASE.map(([id, code, name, base, fresh, frozen], i) => ({
  id, code, name, type: id === 'sauce' ? 'bottle' : 'fish', base_price: base, fresh, frozen, sort_order: i + 1,
  variants: variantsFor(id, base, frozen),
}));
const DP = [
  ['D01','Anse Etoile','North','Blue','#2877ff'], ['D02','Beau Vallon','North','Red','#ff4a4a'],
  ['D03','Victoria','Central','Yellow','#ffd33d'], ['D04','Plaisance','Central','Orange','#ff9c2b'],
  ['D05','Takamaka','South','Green','#24d26b'], ['D06','Cascade','East','Purple','#a56dff'],
  ['D07','Anse Royale','South','Pink','#ff64c8'], ['D08','Quatre Bornes','South','Brown','#a56b45'],
  ['D09','Anse Forbans','South','Grey','#9aa4ad'], ['D10','Police Bay','South','Black','#111111'],
];
const DROP_POINTS = DP.map(([id, name, zone, color, hex], i) => ({ id, name, zone, color, hex, address: name, phone: '+248 271 51' + String(i + 1).padStart(2, '0'), sort_order: i + 1 }));
const SHOPS_SEED = [['plaisance','Plaisance'],['providence','Providence'],['beau_vallon','Beau Vallon'],['stc','STC Hypermarket']];
const SHOPS = SHOPS_SEED.map(([id, name], i) => ({ id, name, phone: '+248 282 110' + (i + 1), sort_order: i + 1 }));
const BOOTSTRAP = {
  currency: 'SCR',
  config: { delivery_threshold: 3000, door_fee: 150, service_charge_per_box: 80, certification_charge: 50, travel_max_kg: 20 },
  products: PRODUCTS, dropPoints: DROP_POINTS, shops: SHOPS,
};

// ---- available stock units returned by /availability ----
const UNITS = [
  { uid:'JF-F-FIL-101', product_id:'jobfish', state:'fresh', cut:'fillet', weight_kg:0.30, packs:1, price_per_kg:215, total:65,   status:'available' },
  { uid:'JF-F-FIL-102', product_id:'jobfish', state:'fresh', cut:'fillet', weight_kg:0.60, packs:2, price_per_kg:215, total:129,  status:'available' },
  { uid:'JF-F-FIL-103', product_id:'jobfish', state:'fresh', cut:'fillet', weight_kg:0.90, packs:3, price_per_kg:215, total:194,  status:'available' },
  { uid:'JF-F-FIL-001', product_id:'jobfish', state:'fresh', cut:'fillet', weight_kg:1.10, packs:4, price_per_kg:215, total:237,  status:'available' },
  { uid:'RS-F-WH-001',  product_id:'red_snapper', state:'fresh', cut:'whole', weight_kg:1.24, packs:2, price_per_kg:620, total:769,  status:'available' },
  { uid:'RS-F-WH-900',  product_id:'red_snapper', state:'fresh', cut:'whole', weight_kg:5.50, packs:6, price_per_kg:620, total:3410, status:'available' },
];

async function mockApi(page, opts = {}) {
  const placed = {};
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}

    if (p.endsWith('/bootstrap'))    return json(BOOTSTRAP);
    if (p.endsWith('/availability')) return json({ units: UNITS });
    if (p.endsWith('/reservation')) {
      if (body.action === 'extend')  return json({ added: 180 });
      if (body.action === 'release') return json({ released: (body.uids || []).length });
      return json({ expires_in: 480 });
    }
    if (p.endsWith('/orders')) {
      const code = (body.type === 'travel') ? 'OCB-T-TEST-1' : 'OCB-L-TEST-1';
      const order = { id: code, status: (body.type === 'travel' ? 'certificate_pending' : 'paid') };
      placed[code] = { id: code, total: body.total ?? 0, type: body.type || 'local', fulfilment: body.fulfilment || 'pickup', drop_point_id: body.drop_point_id || null, status: order.status, items: [] };
      return json({ ok: true, order_no: code, order });
    }
    if (p.endsWith('/order-status')) {
      const no = url.searchParams.get('no');
      const o = placed[no] || (opts.knownOrders && opts.knownOrders[no]);
      if (!o) return json({ error: 'not_found' }, 404);
      return json({ order: o, items: o.items || [] });
    }
    return json({});
  });
}

module.exports = { mockApi, UNITS, BOOTSTRAP };
