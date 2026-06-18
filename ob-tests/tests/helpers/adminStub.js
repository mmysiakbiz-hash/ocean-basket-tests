// Stubs Supabase for the admin panel so tests run with no real login/data.
// We block the real supabase-js CDN + the Supabase host so our stub (installed
// via addInitScript before page scripts) is the one the panel uses.

const S = '11111111-1111-1111-1111-111111111111';
const MOCK = {
  ob_products: [
    { id:'red_snapper', store_id:S, code:'54RD', name:'Red Snapper', type:'fish', base_price:620, fresh:true, frozen:true, sort_order:1 },
    { id:'jobfish',     store_id:S, code:'42JF', name:'Jobfish',     type:'fish', base_price:185, fresh:true, frozen:true, sort_order:2 },
    { id:'grouper',     store_id:S, code:'35GR', name:'Grouper',     type:'fish', base_price:140, fresh:true, frozen:false, sort_order:3 },
    { id:'tuna',        store_id:S, code:'11TU', name:'Tuna',        type:'fish', base_price:150, fresh:true, frozen:true, sort_order:7 },
  ],
  ob_variants: [
    { product_id:'red_snapper', state:'fresh', cut:'whole',  price_per_kg:620, sku:'54RD-F-WHO' },
    { product_id:'red_snapper', state:'fresh', cut:'fillet', price_per_kg:680, sku:'54RD-F-FIL' },
    { product_id:'jobfish',     state:'fresh', cut:'fillet', price_per_kg:215, sku:'42JF-F-FIL' },
    { product_id:'jobfish',     state:'fresh', cut:'whole',  price_per_kg:185, sku:'42JF-F-WHO' },
  ],
  ob_drop_points: [
    { id:'D01', store_id:S, name:'Anse Etoile', zone:'North', color:'Blue',  hex:'#2877ff', sort_order:1 },
    { id:'D05', store_id:S, name:'Takamaka',    zone:'South', color:'Green', hex:'#24d26b', sort_order:5 },
  ],
  ob_shops: [
    { id:'plaisance', store_id:S, name:'Plaisance', sort_order:1 },
    { id:'beau_vallon', store_id:S, name:'Beau Vallon', sort_order:3 },
  ],
  ob_config: [{ store_id:S, currency:'SCR', delivery_threshold:3000, door_fee:150, service_charge_per_box:80, certification_charge:50, travel_max_kg:20 }],
  ob_shop_stock: [],
  ob_stock_units: [
    { uid:'JF-F-WH-001', store_id:S, product_id:'jobfish',     state:'fresh', cut:'whole',  weight_kg:1.80, packs:3, status:'available', source:'manual' },
    { uid:'RS-F-WH-001', store_id:S, product_id:'red_snapper', state:'fresh', cut:'whole',  weight_kg:1.24, packs:2, status:'available', source:'manual' },
    { uid:'JF-F-FIL-101',store_id:S, product_id:'jobfish',     state:'fresh', cut:'fillet', weight_kg:0.30, packs:1, status:'held',      source:'manual' },
    { uid:'RS-F-WH-900', store_id:S, product_id:'red_snapper', state:'fresh', cut:'whole',  weight_kg:5.50, packs:6, status:'sold',      source:'manual' },
  ],
  ob_orders: [
    { id:'OCB-L-260618-1001', store_id:S, status:'paid', total:279, type:'local', fulfilment:'dropoff', created_at:new Date().toISOString() },
  ],
  ob_stock_minimums: [],
};

async function stubSupabase(page) {
  await page.route('**/cdn.jsdelivr.net/**', (r) => r.abort());
  await page.route('**xhhwyyrbdhxgtcbpvges.supabase.co/**', (r) => r.abort());
  await page.addInitScript((MOCK) => {
    function builder(table) {
      const b = { _single: false };
      ['select','eq','neq','order','limit','in','gte','lte','lt','gt','is','contains','range','filter','match','not','or','ilike','like'].forEach((m) => { b[m] = () => b; });
      window.__calls = window.__calls || [];
      b.update = (payload) => { window.__calls.push({ op: 'update', table, payload }); return b; };
      b.insert = (payload) => { window.__calls.push({ op: 'insert', table, payload }); return b; };
      b.upsert = (payload) => { window.__calls.push({ op: 'upsert', table, payload }); return b; };
      b.delete = () => { window.__calls.push({ op: 'delete', table }); return b; };
      b.maybeSingle = () => { b._single = true; return b; };
      b.single = () => { b._single = true; return b; };
      b.then = (resolve) => {
        let data = MOCK[table] ? MOCK[table].slice() : [];
        if (b._single) data = data.length ? data[0] : null;
        resolve({ data, error: null });
      };
      return b;
    }
    const auth = {
      getSession: () => Promise.resolve({ data: { session: { user: { email: 'admin@oceanbasket.sc' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
      signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    };
    window.supabase = {
      createClient: () => ({ auth, from: (t) => builder(t), rpc: (fn, args) => { window.__calls = window.__calls || []; window.__calls.push({ op: 'rpc', fn, args }); return Promise.resolve({ data: true, error: null }); } }),
    };
  }, MOCK);
}

module.exports = { stubSupabase, MOCK };
