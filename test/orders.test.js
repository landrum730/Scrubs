import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer, validateOrder, catalog, validateProduct } from '../server.js';
const employee = { name: 'Test Employee', email: 'employee@example.com', department: 'Nursing' };
const item = (id, color, quantity, extra = {}) => ({ id, color, size: 'M', quantity, ...(catalog.find(p=>p.id===id)?.inseams.length ? {inseam:'Regular'} : {}), ...extra });
const items = [item('CK00038', 'Black', 3), item('CK00038', 'Navy', 2), item('CK115', 'Black', 3), item('CK105', 'Navy', 2)];
const auth = { Authorization: 'Bearer test-only-token', 'Content-Type': 'application/json' };
async function withServer(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'scrubs-test-'));
  let server;
  const start = async () => {
    server = createServer({ dataDir: dir, adminToken: 'test-only-token', storage: 'local' });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return 'http://127.0.0.1:' + server.address().port;
  };
  const restart = async () => { await new Promise(resolve => server.close(resolve)); return start(); };
  try { await run(await start(), restart); }
  finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
}
const post = (base, payload) => fetch(base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

test('all supplied styles are included once with their approved colors', () => {
  assert.equal(catalog.length, 15);
  assert.equal(new Set(catalog.map(p => p.id)).size, 15);
  assert.deepEqual(catalog.filter(p => p.colors.includes('White')).map(p => p.id), ['CK773']);
  assert.equal(catalog.filter(p => p.category === 'Sets').length, 1);
  assert.equal(catalog.filter(p => p.category === 'Jackets').length, 2);
  assert.ok(catalog.every(p => p.imageUrl.startsWith('https://')));
  assert.equal(catalog.find(p => p.id === 'CK962A').collection, 'Cherokee Workwear Originals Ultra');
  assert.equal(catalog.find(p => p.id === 'UNISEX-SET').collection, 'Cherokee Workwear Originals Ultra');
});

test('required five sets reject incomplete, excess, duplicate, and invalid selections', () => {
  assert.ok(validateOrder({ employee, items }).id);
  for (let index = 0; index < items.length; index++) {
    for (const change of [-1, 1]) {
      const copy = structuredClone(items); copy[index].quantity += change;
      assert.throws(() => validateOrder({ employee, items: copy }));
    }
  }
  assert.throws(() => validateOrder({ employee, items: [...items, items[0]] }));
  assert.throws(() => validateOrder({ employee, items: [null] }), /approved style/);
  assert.throws(() => validateOrder({ employee, items: items.map(i => ({ ...i, color: 'Royal' })) }), /approved style/);
  assert.throws(() => validateOrder({ employee, items: items.map(i => ({ ...i, size: 'Unapproved' })) }), /approved style/);
  assert.throws(() => validateOrder({ employee, items: items.map(i => ({ ...i, setColor: i.color === 'Black' ? 'Navy' : 'Black' })) }), /must match/);
});

test('white underscrubs count toward either set color, never twice or toward extras', () => {
  const whiteItems = [item('CK773', 'White', 3, { setColor: 'Black' }), item('CK773', 'White', 2, { setColor: 'Navy' }), items[2], items[3]];
  const order = validateOrder({ employee, items: whiteItems });
  assert.deepEqual(order.items.slice(0, 2).map(i => i.setColor), ['Black', 'Navy']);
  assert.throws(() => validateOrder({ employee, items: [item('CK773', 'White', 3), ...items.slice(1)] }), /Assign white/);
  assert.throws(() => validateOrder({ employee, items: [...items, item('CK773', 'White', 1, { setColor: 'Black', allowance: 'Long sleeves' })] }), /five sets only/);
  assert.throws(() => validateOrder({ employee, items: [item('CK00038', 'White', 3, { setColor: 'Black' }), ...items.slice(1)] }), /approved style/);
});

test('complete sets supply both pieces; long sleeves and jackets are separate optional allowances', () => {
  assert.ok(validateOrder({ employee, items: [item('UNISEX-SET', 'Black', 3), item('UNISEX-SET', 'Navy', 2)] }).id);
  assert.ok(validateOrder({ employee, items: [item('UNISEX-SET', 'Black', 2), item('CK953', 'Black', 1), item('CK272', 'Black', 1), item('UNISEX-SET', 'Navy', 2)] }).id);
  const extras = [item('CK962A', 'Black', 1, { allowance: 'Long sleeves' }), item('CK4881CL', 'Navy', 1, { allowance: 'Long sleeves' }), item('CK4350', 'Black', 1), item('CK00013', 'Navy', 1)];
  assert.equal(validateOrder({ employee, items: [...items, ...extras] }).items.length, 8);
  for (const extra of extras) assert.throws(() => validateOrder({ employee, items: [...items, ...extras, extra] }), /at most 1/);
  assert.throws(() => validateOrder({ employee, items: [...items, item('CK00038', 'Black', 1, { allowance: 'Long sleeves' })] }), /not approved/);
  assert.throws(() => validateOrder({ employee, items: [...extras, items[2], items[3]] }), /Complete/);
});

test('tops and pants match their collection per color; underscrubs may fill any collection', () => {
  const mismatch = structuredClone(items); mismatch[2].id = 'CK096';
  assert.throws(() => validateOrder({ employee, items: mismatch }), /same collection/);
  const mixed = [item('CK00038', 'Black', 2), item('CK936', 'Black', 1), item('CK115', 'Black', 2), item('CK096', 'Black', 1), item('CK953', 'Navy', 2), item('CK272', 'Navy', 2)];
  assert.ok(validateOrder({ employee, items: mixed }).id);
  mixed[2].quantity = 1; mixed[3].quantity = 2;
  assert.throws(() => validateOrder({ employee, items: mixed }), /same collection/);
  mixed[0].quantity = 1; mixed[1].quantity = 1; mixed.push(item('CK773', 'White', 1, { setColor: 'Black' }));
  assert.ok(validateOrder({ employee, items: mixed }).id);
  const crossColor = [item('CK00038', 'Black', 3), item('CK936', 'Navy', 2), item('CK096', 'Black', 3), item('CK115', 'Navy', 2)];
  assert.throws(() => validateOrder({ employee, items: crossColor }), /same collection/);
  const spoof = mismatch.map(i => ({ ...i, matchAnyCollection: true }));
  assert.throws(() => validateOrder({ employee, items: spoof }), /same collection/);
  const longSleeve = [item('CK962A', 'Black', 3), item('CK953', 'Navy', 2), item('CK272', 'Black', 3), item('CK00034', 'Navy', 2)];
  assert.ok(validateOrder({ employee, items: longSleeve }).id);
});

test('orders persist with original style details and administrator access is protected', async () => withServer(async (base, restart) => {
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/policy.js')).status, 200);
  const response = await post(base, { employee, items }); assert.equal(response.status, 201);
  const { id } = await response.json(); assert.ok(id);
  assert.equal((await fetch(base + '/api/admin/orders')).status, 401);
  const invalid = await post(base, { employee, items: [...items, items[0]] }); assert.equal(invalid.status, 400);
  base = await restart();
  const stored = await (await fetch(base + '/api/admin/orders', { headers: auth })).json();
  assert.equal(stored.length, 1); assert.equal(stored[0].id, id); assert.equal(stored[0].items[0].sku, 'CK00038');
  assert.deepEqual(stored[0].sets, { Black: 3, Navy: 2 });
}));

test('administrator can add, edit, and retire styles; changes persist and orders use current approvals', async () => withServer(async (base, restart) => {
  const newStyle = { ...structuredClone(catalog[0]), sku: 'NEW-TOP', name: 'New approved top', sizes: ['M', 'L'], url: 'https://example.com/scrub-top' };
  assert.equal((await fetch(base + '/api/admin/catalog', { method: 'POST', body: JSON.stringify(newStyle) })).status, 401);
  assert.equal((await fetch(base + '/api/admin/catalog')).status, 401);
  const add = await fetch(base + '/api/admin/catalog', { method: 'POST', headers: auth, body: JSON.stringify(newStyle) }); assert.equal(add.status, 201);
  const saved = await add.json(); assert.ok(saved.id);
  assert.equal((await fetch(base + '/api/admin/catalog', { method: 'POST', headers: auth, body: JSON.stringify(newStyle) })).status, 409);
  const selected = [{ ...items[0], id: saved.id }, ...items.slice(1)];
  assert.equal((await post(base, { employee, items: selected })).status, 201);
  base = await restart();
  let publicCatalog = await (await fetch(base + '/api/catalog')).json(); assert.equal(publicCatalog.length, 16); assert.ok(publicCatalog.some(p => p.id === saved.id));
  const edited = { ...saved, name: 'Updated top', sizes: ['L'] };
  assert.equal((await fetch(base + '/api/admin/catalog/' + saved.id, { method: 'PUT', headers: auth, body: JSON.stringify(edited) })).status, 200);
  assert.equal((await post(base, { employee, items: selected })).status, 400);
  selected[0].size = 'L'; assert.equal((await post(base, { employee, items: selected })).status, 201);
  assert.equal((await fetch(base + '/api/admin/catalog/' + saved.id, { method: 'PUT', headers: auth, body: JSON.stringify({ ...edited, active: false }) })).status, 200);
  base = await restart();
  publicCatalog = await (await fetch(base + '/api/catalog')).json(); assert.equal(publicCatalog.length, 15);
  assert.equal((await post(base, { employee, items: selected })).status, 400);
  const adminCatalog = await (await fetch(base + '/api/admin/catalog', { headers: auth })).json(); assert.equal(adminCatalog.find(p => p.id === saved.id).active, false);
  const orders = await (await fetch(base + '/api/admin/orders', { headers: auth })).json();
  assert.equal(orders.length, 2); assert.equal(orders[1].items[0].name, 'New approved top'); assert.equal(orders[0].items[0].name, 'Updated top');
}));

test('catalog validation rejects unsafe links and incompatible garment allowances', () => {
  const product = structuredClone(catalog[0]);
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://secret:password@example.com']) assert.throws(() => validateProduct({ ...product, url }, 'new'));
  assert.throws(() => validateProduct({ ...product, category: 'Pants', colors: ['White'], allowances: ['Pants'] }, 'new'), /White/);
  assert.throws(() => validateProduct({ ...product, allowances: ['Jackets'] }, 'new'), /supported/);
  assert.throws(() => validateProduct({ ...product, colors: ['Red'] }, 'new'), /approved colors/);
  assert.throws(() => validateProduct({ ...product, sizes: [] }, 'new'), /size/);
  assert.throws(() => validateProduct({ ...product, colors: ['White'], allowances: ['Long sleeves'] }, 'new'), /White requires/);
  assert.throws(() => validateProduct({ ...product, imageUrl: 'javascript:alert(1)' }, 'new'), /HTTPS/);
  assert.throws(() => validateProduct({ ...product, images: { Black: 'http://example.com/image.jpg' } }, 'new'), /HTTPS/);
  assert.throws(() => validateProduct({ ...product, category: 'Pants', allowances: ['Pants'], inseams: ['Regular'], matchAnyCollection: true }, 'new'), /Only approved scrub tops/);
});

test('older saved catalogs receive photos and collection corrections without overwriting administrator changes', async () => {
  const old = structuredClone(catalog).map(p => { delete p.images; delete p.imageUrl; delete p.matchAnyCollection; delete p.inseams; return p; });
  old.find(p => p.id === 'CK962A').collection = 'Cherokee';
  old.find(p => p.id === 'UNISEX-SET').collection = 'AllHeart';
  Object.assign(old.find(p => p.id === 'CK096'), { url: 'https://www.uniformadvantage.com/cherokee-achieve-women-s-5-pocket-stretch-elastic-waist-drawstring-straight-leg-cargo-scrub-pants/CK096.html', name: 'Old pants', images: { Black: 'https://example.com/old.jpg' }, inseams: ['Regular'], sizes: ['M'] });
  Object.assign(old.find(p => p.id === 'CK00034'), {url: 'https://www.uniformadvantage.com/cherokee-workwear-originals-ultra-women-s-5-pocket-drawstring-jogger-scrub-pants/CK00034.html', images: {Black:'https://example.com/old-jogger.jpg'}, inseams:['Regular'], price:20});
  old[0].collection = 'Administrator customized collection';
  old[0].imageUrl = 'https://example.com/custom-photo.jpg';
  let saved;
  const store = { loadCatalog: async () => structuredClone(old), saveOrder: async order => { saved = order; } };
  const server = createServer({ store, storage: 'local' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const response = await fetch(base + '/api/catalog');
    const products = await response.json();
    assert.equal(products[0].collection, 'Administrator customized collection');
    assert.equal(products[0].imageUrl, 'https://example.com/custom-photo.jpg');
    assert.equal(products.find(p => p.id === 'CK962A').collection, 'Cherokee Workwear Originals Ultra');
    assert.equal(products.find(p => p.id === 'CK773').matchAnyCollection, true);
    assert.ok(products.every(p => Object.keys(p.images).length));
    const jogger = products.find(p=>p.id==='CK00034');
    assert.match(jogger.url, /allheart.com.*ckck0034/);
    assert.match(jogger.images.Black, /ck-ck0034-blk/);
    assert.deepEqual(jogger.inseams,['Petite','Regular','Tall']);
    assert.equal(jogger.price,25);
    const replacement = products.find(p => p.id === 'CK096');
    assert.match(replacement.url, /allheart.com/);
    assert.match(replacement.images.Black, /ck-ck096--blk/);
    assert.deepEqual(replacement.inseams, ['Petite', 'Regular', 'Tall']);
    assert.deepEqual(replacement.sizes, ['M']);
    const selection = [item('CK962A', 'Black', 3), item('CK272', 'Black', 3), item('CK773', 'White', 2, { setColor: 'Navy' }), item('CK096', 'Navy', 2)];
    assert.equal((await post(base, { employee, items: selection })).status, 201);
    assert.equal(saved.items[0].collection, 'Cherokee Workwear Originals Ultra');
    assert.equal((await fetch(base + '/assets/landrum-logo.svg')).headers.get('content-type'), 'image/svg+xml');
  } finally { await new Promise(resolve => server.close(resolve)); }
});


test('inseam is required, approved, and retained on pants and complete sets', () => {
 const selection=structuredClone(items);
 selection[2].inseam='Petite';
 assert.equal(validateOrder({employee,items:selection}).items[2].inseam,'Petite');
 delete selection[2].inseam;
 assert.throws(()=>validateOrder({employee,items:selection}),/approved inseam/);
 selection[2].inseam='Tall';
 assert.throws(()=>validateOrder({employee,items:selection}),/approved inseam/);
 const sets=[item('UNISEX-SET','Black',3,{inseam:'Short'}),item('UNISEX-SET','Navy',2,{inseam:'Tall'})];
 assert.deepEqual(validateOrder({employee,items:sets}).items.map(i=>i.inseam),['Short','Tall']);
 const product=catalog.find(p=>p.id==='CK115');
 assert.throws(()=>validateProduct({...product,inseams:[]},product.id),/approved inseam/);
 const crossColor=structuredClone(items);crossColor[2].color='Navy';crossColor[3].color='Black';
 assert.throws(()=>validateOrder({employee,items:crossColor}),/allowance|Complete/);
});

test('orders need no department and capture catalog values rather than client prices', () => {
  const order = validateOrder({employee: {name: 'Employee', email: 'employee@example.com'}, items: items.map(i=>({...i, unitPrice: 0})), estimatedValue:0});
  assert.deepEqual(order.employee, {name:'Employee',email:'employee@example.com'});
  assert.equal(order.estimatedValue, 298.90);
  assert.equal(order.items[0].unitPrice, 27.99);
  assert.equal(order.items[0].lineValue, 83.97);
  const changed = structuredClone(catalog);changed[0].price=30;
  assert.equal(validateOrder({employee,items},changed).estimatedValue,308.95);
  changed[0].price=null;
  assert.equal(validateOrder({employee,items},changed).estimatedValue,null);
  assert.throws(()=>validateProduct({...catalog[0],price:-1},'test'),/retail price/);
  assert.throws(()=>validateProduct({...catalog[0],price:Infinity},'test'),/retail price/);
  assert.throws(()=>validateProduct({...catalog[0],price:1.234},'test'),/retail price/);
});
