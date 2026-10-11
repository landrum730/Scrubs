import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { catalog } from './catalog.js';
import { allowanceCounts, allowanceError, collectionError } from './public/policy.js';
import { localStore, supabaseStore } from './storage.js';
export { catalog, allowanceCounts };

export function validateProduct(input, id) {
  if (!input || typeof input !== 'object') throw Error('Enter the style details.');
  const product = { id };
  for (const field of ['sku', 'name', 'collection', 'url']) {
    if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length > (field === 'url' ? 2000 : 150)) throw Error(`Enter a valid ${field}.`);
    product[field] = input[field].trim();
  }
  let url;
  try { url = new URL(product.url); } catch { throw Error('Enter a valid HTTPS product link.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Use an HTTPS product link without credentials.');
  if (!['Tops', 'Pants', 'Sets', 'Jackets'].includes(input.category)) throw Error('Choose a valid category.');
  product.category = input.category;
  if (!Array.isArray(input.colors) || !input.colors.length || input.colors.some(c => !['Black', 'Navy', 'White'].includes(c))) throw Error('Choose approved colors.');
  if (input.colors.includes('White') && input.category !== 'Tops') throw Error('White is allowed only for scrub tops.');
  product.colors = [...new Set(input.colors)];
  if (!Array.isArray(input.sizes) || !input.sizes.length || input.sizes.length > 30 || input.sizes.some(s => typeof s !== 'string' || !s.trim() || s.length > 30)) throw Error('Enter at least one valid size.');
  product.sizes = [...new Set(input.sizes.map(s => s.trim()))];
  const options = input.category === 'Tops' ? ['Tops', 'Long sleeves'] : [input.category];
  if (!Array.isArray(input.allowances) || !input.allowances.length || input.allowances.some(a => !options.includes(a))) throw Error('Choose an allowance supported by this category.');
  product.allowances = [...new Set(input.allowances)];
  if (product.colors.includes('White') && !product.allowances.includes('Tops')) throw Error('White requires approval for one of the five scrub tops.');
  if (product.allowances.includes('Long sleeves') && !product.colors.some(c => c === 'Black' || c === 'Navy')) throw Error('Additional long sleeves need an approved black or navy color.');
  if (typeof input.active !== 'boolean') throw Error('Choose whether the style is active.');
  product.active = input.active;
  if (input.matchAnyCollection !== undefined && typeof input.matchAnyCollection !== 'boolean') throw Error('Choose whether this is a mix-and-match underscrub.');
  product.matchAnyCollection = Boolean(input.matchAnyCollection);
  if (product.matchAnyCollection && (product.category !== 'Tops' || !product.allowances.includes('Tops'))) throw Error('Only approved scrub tops can match any collection.');
  function imageLink(value) {
    let image;
    try { image = new URL(value); } catch { throw Error('Enter a valid HTTPS image link.'); }
    if (typeof value !== 'string' || image.protocol !== 'https:' || image.username || image.password || value.length > 2000) throw Error('Use an HTTPS image link without credentials.');
    return image.href;
  }
  product.imageUrl = input.imageUrl ? imageLink(input.imageUrl) : '';
  product.images = {};
  if (input.images !== undefined) {
    if (!input.images || typeof input.images !== 'object' || Array.isArray(input.images)) throw Error('Enter valid color image links.');
    for (const [color, link] of Object.entries(input.images)) {
      if (!['Black', 'Navy', 'White', 'default'].includes(color)) throw Error('Image colors must be Black, Navy, or White.');
      if (link) product.images[color] = imageLink(link);
    }
  }
  return product;
}

export function validateOrder(input, products = catalog) {
  if (!input || typeof input !== 'object') throw Error('Invalid order.');
  const employee = {};
  for (const field of ['name', 'email', 'department']) {
    if (typeof input.employee?.[field] !== 'string' || !input.employee[field].trim() || input.employee[field].length > 150) throw Error('Enter your name, email, and department.');
    employee[field] = input.employee[field].trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) throw Error('Enter a valid email address.');
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 40) throw Error('Add items to your cart.');
  const items = input.items.map(item => {
    const product = products.find(p => p.id === item?.id && p.active);
    if (!product || !product.colors.includes(item.color) || !product.sizes.includes(item.size) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 3) throw Error('Choose an active approved style, color, size, and quantity (1–3).');
    const allowance = item.allowance || product.category;
    if (!product.allowances.includes(allowance)) throw Error('This style is not approved for the selected allowance.');
    const setColor = item.setColor || item.color;
    if (!['Black', 'Navy'].includes(setColor)) throw Error('Assign white tops to a black or navy set.');
    if (item.color === 'White') {
      if (allowance !== 'Tops') throw Error('White tops count toward the five sets only. Additional long sleeves must be black or navy.');
    } else if (setColor !== item.color) throw Error('The allowance color must match the garment color.');
    return { id: product.id, sku: product.sku, name: product.name, collection: product.collection, url: product.url, category: product.category, color: item.color, setColor, allowance, size: item.size, quantity: item.quantity, matchAnyCollection: product.matchAnyCollection };
  });
  const error = allowanceError(allowanceCounts(items, products));
  if (error) throw Error(error);
  const mismatch = collectionError(items, products);
  if (mismatch) throw Error(mismatch);
  return { id: randomUUID(), createdAt: new Date().toISOString(), status: 'Submitted', employee, items, sets: { Black: 3, Navy: 2 } };
}

async function jsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 16384) { const error = Error('Request is too large.'); error.status = 413; throw error; }
  }
  try { return JSON.parse(body); } catch { const error = Error('Request must contain valid JSON.'); error.status = 400; throw error; }
}

export function createServer({ dataDir = process.env.SCRUBS_DATA_DIR || path.resolve('data'), adminToken = process.env.SCRUBS_ADMIN_TOKEN, storage = process.env.SCRUBS_STORAGE || 'local', store } = {}) {
  if (!['local', 'supabase'].includes(storage)) throw Error('SCRUBS_STORAGE must be local or supabase.');
  store ||= storage === 'supabase' ? supabaseStore({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }) : localStore(dataDir);
  const { loadCatalog: readCatalog, saveCatalog, saveOrder, loadOrders } = store;
  async function loadCatalog() {
    return (await readCatalog()).map(product => {
      const initial = catalog.find(p => p.id === product.id);
      // Upgrade older saved catalogs without replacing administrator changes.
      const result = { ...product, matchAnyCollection: product.matchAnyCollection ?? initial?.matchAnyCollection ?? false, images: product.images ?? initial?.images ?? {}, imageUrl: product.imageUrl ?? initial?.imageUrl ?? '' };
      if (product.id === 'CK962A' && product.collection === 'Cherokee' || product.id === 'UNISEX-SET' && product.collection === 'AllHeart') result.collection = initial.collection;
      return result;
    });
  }
  let mutation = Promise.resolve();
  const mutate = operation => {
    const next = mutation.then(operation);
    mutation = next.catch(() => {});
    return next;
  };
  return http.createServer(async (req, res) => {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/admin/')) {
        if (!adminToken) return send(503, { error: 'Administrator access has not been configured.' });
        const actual = Buffer.from(req.headers.authorization || ''), expected = Buffer.from('Bearer ' + adminToken);
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return send(401, { error: 'Invalid administrator access token.' });
      }
      if (req.method === 'GET' && url.pathname === '/api/catalog') return send(200, (await loadCatalog()).filter(p => p.active));
      if (req.method === 'GET' && url.pathname === '/api/admin/catalog') return send(200, await loadCatalog());
      if (req.method === 'POST' && url.pathname === '/api/admin/catalog' || req.method === 'PUT' && /^\/api\/admin\/catalog\/[^/]+$/.test(url.pathname)) {
        const input = await jsonBody(req);
        const editing = req.method === 'PUT';
        const id = editing ? decodeURIComponent(url.pathname.split('/').pop()) : randomUUID();
        let product;
        try { product = validateProduct(input, id); } catch (error) { return send(400, { error: error.message }); }
        const result = await mutate(async () => {
          const products = await loadCatalog();
          const index = products.findIndex(p => p.id === id);
          if (editing && index === -1) return { status: 404, error: 'Style not found.' };
          if (!editing && products.length >= 500) return { status: 400, error: 'Catalog supports up to 500 styles.' };
          if (products.some(p => p.id !== id && p.sku.toLowerCase() === product.sku.toLowerCase())) return { status: 409, error: 'This style number already exists. Edit the existing style instead.' };
          if (editing) products[index] = product; else products.push(product);
          await saveCatalog(products);
          return { status: editing ? 200 : 201 };
        });
        return send(result.status, result.error ? { error: result.error } : product);
      }
      if (req.method === 'POST' && url.pathname === '/api/orders') {
        const input = await jsonBody(req);
        const result = await mutate(async () => {
          let order;
          const products = await loadCatalog();
          try { order = validateOrder(input, products); }
          catch (error) { return { error: error.message }; }
          await saveOrder(order);
          return { id: order.id };
        });
        return send(result.error ? 400 : 201, result);
      }
      if (req.method === 'GET' && url.pathname === '/api/admin/orders') {
        return send(200, await loadOrders());
      }
      const files = { '/': 'index.html', '/admin': 'admin.html', '/style.css': 'style.css', '/app.js': 'app.js', '/admin.js': 'admin.js', '/policy.js': 'policy.js', '/assets/landrum-logo.svg': 'assets/landrum-logo.svg' };
      if (req.method !== 'GET' || !files[url.pathname]) return send(404, { error: 'Not found.' });
      const filename = files[url.pathname];
      const content = await readFile(new URL('./public/' + filename, import.meta.url));
      res.writeHead(200, { 'Content-Type': filename.endsWith('.css') ? 'text/css' : filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.svg') ? 'image/svg+xml' : 'text/html', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' https:; frame-ancestors 'none'; base-uri 'self'" });
      res.end(content);
    } catch (error) { send(error.status || 500, { error: error.status ? error.message : 'Unable to save or retrieve your changes. Please try again.' }); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) createServer().listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Scrubs server listening on port ' + (process.env.PORT || 3000)));
