import { readFile, mkdir, appendFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { catalog } from './catalog.js';

export function localStore(dataDir) {
  return {
    async loadCatalog() {
      try { return JSON.parse(await readFile(path.join(dataDir, 'catalog.json'), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return structuredClone(catalog); throw error; }
    },
    async saveCatalog(products) {
      await mkdir(dataDir, { recursive: true, mode: 0o700 });
      const temporary = path.join(dataDir, `catalog-${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(products, null, 2), { mode: 0o600 });
      await rename(temporary, path.join(dataDir, 'catalog.json'));
    },
    async saveOrder(order) {
      await mkdir(dataDir, { recursive: true, mode: 0o700 });
      await appendFile(path.join(dataDir, 'orders.jsonl'), JSON.stringify(order) + '\n', { mode: 0o600 });
    },
    async loadOrders() {
      let content = '';
      try { content = await readFile(path.join(dataDir, 'orders.jsonl'), 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      return content.trim() ? content.trim().split('\n').map(JSON.parse).reverse() : [];
    }
  };
}

export function supabaseStore({ url, key, fetchImpl = fetch }) {
  let parsed;
  try { parsed = new URL(url); } catch { throw Error('Set SUPABASE_URL to your project URL before starting the site.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.username || parsed.password || parsed.port || !['/', '/rest/v1', '/rest/v1/'].includes(parsed.pathname) || parsed.search || parsed.hash) throw Error('SUPABASE_URL must be your HTTPS Supabase project URL or the API URL copied from Data API.');
  if (!key) throw Error('Set SUPABASE_SERVICE_ROLE_KEY securely before starting the site.');
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // Legacy service_role JWTs need a bearer header. New secret keys use apikey only.
  if (!key.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + key;
  async function request(resource, options = {}) {
    try {
      const response = await fetchImpl(parsed.origin + '/rest/v1/' + resource, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Error('Database request failed.');
      return response.status === 204 || options.method ? undefined : await response.json();
    } catch {
      const error = Error('Order storage is unavailable. Please try again later or contact your administrator.');
      error.status = 503;
      throw error;
    }
  }
  return {
    async loadCatalog() {
      const rows = await request('scrubs_catalog?id=eq.approved&select=payload');
      return rows.length ? rows[0].payload : structuredClone(catalog);
    },
    async saveCatalog(products) {
      await request('scrubs_catalog?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 'approved', payload: products }) });
    },
    async saveOrder(order) {
      await request('scrubs_orders', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ id: order.id, created_at: order.createdAt, payload: order }) });
    },
    async loadOrders() {
      const orders = [];
      for (let offset = 0; ; offset += 500) {
        const rows = await request(`scrubs_orders?select=payload&order=created_at.desc,id.desc&limit=500&offset=${offset}`);
        orders.push(...rows.map(row => row.payload));
        if (rows.length < 500) return orders;
      }
    }
  };
}
