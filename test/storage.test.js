import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supabaseStore } from '../storage.js';
import { catalog, createServer, validateOrder } from '../server.js';
const validOrder = () => validateOrder({ employee: { name: 'Test Employee', email: 'test@example.com', department: 'Nursing' }, items: [{ id: 'UNISEX-SET', color: 'Black', size: 'M', inseam: 'Regular', quantity: 3 }, { id: 'UNISEX-SET', color: 'Navy', size: 'M', inseam: 'Regular', quantity: 2 }] });

test('copied Data API URLs and project URLs use the same REST endpoint', async () => {
  for (const suffix of ['', '/', '/rest/v1', '/rest/v1/']) {
    const store = supabaseStore({ url: 'https://test-project.supabase.co' + suffix, key: 'test', fetchImpl: async address => {
      assert.equal(address, 'https://test-project.supabase.co/rest/v1/scrubs_catalog?id=eq.approved&select=payload');
      return Response.json([]);
    } });
    assert.equal((await store.loadCatalog()).length, 25);
  }
  for (const suffix of ['/rest/v1/orders', '/dashboard', '/?key=test']) assert.throws(() => supabaseStore({ url: 'https://test-project.supabase.co' + suffix, key: 'test' }), /SUPABASE_URL/);
});

test('Supabase storage preserves catalog and orders across adapter restarts with server-only authentication', async () => {
  const rows = new Map();
  const calls = [];
  const fetchImpl = async (address, options) => {
    calls.push({ address, options });
    assert.equal(options.headers.apikey, 'test-server-secret');
    assert.equal(options.headers.Authorization, 'Bearer test-server-secret');
    const url = new URL(address), table = url.pathname.split('/').pop();
    if (options.method === 'POST') {
      const record = JSON.parse(options.body);
      if (table === 'scrubs_catalog') assert.equal(options.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
      rows.set(table + ':' + record.id, record);
      return new Response(null, { status: 204 });
    }
    const result = [...rows.entries()].filter(([key]) => key.startsWith(table + ':')).map(([, row]) => ({ payload: row.payload }));
    return Response.json(result);
  };
  const make = () => supabaseStore({ url: 'https://test-project.supabase.co', key: 'test-server-secret', fetchImpl });
  let store = make();
  assert.deepEqual(await store.loadCatalog(), catalog);
  const updated = structuredClone(catalog); updated[0].active = false;
  await store.saveCatalog(updated);
  const order = validOrder(); await store.saveOrder(order);
  store = make();
  assert.deepEqual(await store.loadCatalog(), updated);
  assert.deepEqual(await store.loadOrders(), [order]);
  assert.ok(calls.every(call => call.address.startsWith('https://test-project.supabase.co/rest/v1/')));
});

test('missing configuration fails closed; database errors do not fall back to temporary local files', async () => {
  assert.throws(() => supabaseStore({}), /SUPABASE_URL/);
  assert.throws(() => supabaseStore({ url: 'https://test-project.supabase.co' }), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.throws(() => supabaseStore({ url: 'http://test-project.supabase.co', key: 'test' }), /HTTPS/);
  assert.throws(() => supabaseStore({ url: 'https://example.com', key: 'test' }), /Supabase/);
  const store = supabaseStore({ url: 'https://test-project.supabase.co', key: 'test', fetchImpl: async () => Response.json({ error: 'private database diagnostic' }, { status: 403 }) });
  const server = createServer({ store, storage: 'supabase', adminToken: 'test' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const response = await fetch(base + '/api/orders', { method: 'POST', body: JSON.stringify(validOrder()) });
    assert.equal(response.status, 503);
    const body = await response.json(); assert.match(body.error, /storage is unavailable/); assert.ok(!body.error.includes('private database diagnostic'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('failed order inserts never acknowledge a successful submission', async () => {
  const store = supabaseStore({ url: 'https://test-project.supabase.co', key: 'sb_secret_test_only', fetchImpl: async (address, options) => {
    assert.equal(options.headers.Authorization, undefined);
    if (options.method === 'POST') return new Response(null, { status: 500 });
    return Response.json([]);
  } });
  const server = createServer({ store, storage: 'supabase', adminToken: 'test' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/orders', { method: 'POST', body: JSON.stringify(validOrder()) });
    assert.equal(response.status, 503); assert.equal((await response.json()).id, undefined);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
