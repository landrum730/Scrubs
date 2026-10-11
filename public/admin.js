const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = '', products = [], editId = null;
const form = $('#style-form');
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Request failed.');
  return result;
}
async function loadOrders() {
  const orders = await api('/api/admin/orders');
  $('#orders').innerHTML = orders.length ? orders.map(order => `<article class="admin-order"><h3>${esc(order.employee.name)}</h3><p>${esc(order.employee.email)}</p><p>${esc(new Date(order.createdAt).toLocaleString())} · ${esc(order.status)}</p><ul>${order.items.map(item => `<li>${item.quantity} × ${esc(item.name)} (${esc(item.sku || item.id)}) — ${esc(item.color)}, size ${esc(item.size)}${item.inseam ? ' · Inseam: ' + esc(item.inseam) : ''} · ${esc(item.collection || 'Collection not recorded')}${item.allowance ? ' · ' + esc(item.allowance) : ''}${!['Black','Navy'].includes(item.color) ? ' · counts toward ' + esc(item.setColor) + ' set' : ''}</li>`).join('')}</ul><p>${order.estimatedValue == null ? "" : "Estimated total value: $" + order.estimatedValue.toFixed(2)}</p><p>Email notification: ${esc(order.emailNotification?.status || 'not sent')}${order.emailNotification?.to ? ' · '+esc(order.emailNotification.to) : ''}</p>${order.emailNotification?.status === 'uncertain' ? '<p>Microsoft may have accepted this email. Check the manager mailbox before retrying.</p>' : ''}${order.emailNotification?.status !== 'sent' ? `<button class="outline" data-email="${esc(order.id)}">Send order email</button>` : ''}<p class="reference">${esc(order.id)}</p></article>`).join('') : '<p>No orders submitted yet.</p>';
  document.querySelectorAll('[data-email]').forEach(button=>button.onclick=()=>sendOrderEmail(button));
}
async function sendOrderEmail(button) {
  button.disabled = true;
  try {
    const result = await api('/api/admin/orders/'+encodeURIComponent(button.dataset.email)+'/email', {method:'POST'});
    $('#status').textContent = result.emailStatus === 'sent' ? 'Order email accepted for delivery.' : 'Email could not be sent. Your order is saved; try again later.';
    await loadOrders();
  } catch (error) { $('#status').textContent = error.message;button.disabled = false; }
}
async function loadCatalog() {
  products = await api('/api/admin/catalog');
  $('#admin-catalog').innerHTML = products.map(p => `<article class="catalog-row"><div><strong>${esc(p.name)}</strong><p>${esc(p.collection)} · ${esc(p.sku)} · ${esc(p.category)} · ${esc(p.gender)}</p><small>${esc(p.colors.join(', '))} · ${esc(p.sizes.join(', '))}</small></div><span class="state ${p.active ? '' : 'retired'}">${p.active ? 'Active' : 'Retired'}</span><button class="outline" data-edit="${esc(p.id)}">Edit <span class="sr-only">${esc(p.name)}</span></button></article>`).join('');
  document.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => openEditor(products.find(p => p.id === button.dataset.edit)));
}
$('#login').onsubmit = async event => {
  event.preventDefault(); token = $('#token').value; $('#status').textContent = 'Loading…';
  try {
    await Promise.all([loadOrders(), loadCatalog()]);
    $('#workspace').hidden = false; $('#logout').hidden = false; $('#login').hidden = true;
    $('#token').value = ''; $('#status').textContent = 'Signed in. Manage orders and approved styles below.';
  } catch (error) { token = ''; $('#orders').replaceChildren(); $('#admin-catalog').replaceChildren(); $('#status').textContent = error.message; }
};
$('#logout').onclick = () => {
  token = ''; products = []; editId = null; form.reset(); $('#workspace').hidden = true; $('#editor').hidden = true;
  $('#orders').replaceChildren(); $('#admin-catalog').replaceChildren(); $('#login').hidden = false; $('#logout').hidden = true; $('#status').textContent = 'Signed out.';
};
$('#refresh-orders').onclick = async () => {
  try { await loadOrders(); $('#status').textContent = 'Orders refreshed.'; } catch (error) { $('#status').textContent = error.message; }
};
function categoryChanged() {
  const tops = form.elements.category.value === 'Tops';
  const needsInseam = ['Pants','Sets'].includes(form.elements.category.value);
  $('#inseam-options').hidden = !needsInseam;form.elements.inseams.required=needsInseam;
  $('#top-allowances').hidden = !tops; $('#white-option').hidden = !tops; $('#mix-option').hidden = !tops;
  if (!tops) form.elements.matchAnyCollection.checked = false;
  $('#neutral-options').hidden = !tops;
  if (!tops) form.querySelectorAll('[name="colors"]').forEach(input=>{if(!['Black','Navy'].includes(input.value)) input.checked=false;});
}
form.elements.category.onchange = categoryChanged;
function openEditor(product = null) {
  form.reset(); editId = product?.id || null;
  $('#editor-title').textContent = product ? 'Edit approved style' : 'Add approved style';
  $('#catalog-status').textContent = '';
  if (product) {
    for (const key of ['sku', 'name', 'collection', 'url', 'category', 'gender']) form.elements[key].value = product[key];
    form.elements.price.value = product.price ?? '';
    form.elements.sizes.value = product.sizes.join(', ');
    form.elements.inseams.value = (product.inseams || []).join(', '); form.elements.active.checked = product.active;
    form.elements.imageUrl.value = product.imageUrl || '';
    form.elements.blackImage.value = product.images?.Black || '';
    form.elements.navyImage.value = product.images?.Navy || '';
    form.elements.whiteImage.value = product.images?.White || '';
    form.elements.ivoryImage.value = product.images?.Ivory || '';
    form.elements.greyImage.value = product.images?.Grey || '';
    form.elements.darkGreyImage.value = product.images?.['Dark grey'] || '';
    form.elements.matchAnyCollection.checked = Boolean(product.matchAnyCollection);
    form.querySelectorAll('[name="colors"]').forEach(input => input.checked = product.colors.includes(input.value));
    form.querySelectorAll('[name="topAllowance"]').forEach(input => input.checked = product.allowances.includes(input.value));
  }
  categoryChanged(); $('#editor').hidden = false; $('#editor').scrollIntoView({ behavior: 'smooth' });
}
$('#new-style').onclick = () => openEditor();
$('#cancel-style').onclick = () => { $('#editor').hidden = true; editId = null; };
form.onsubmit = async event => {
  event.preventDefault();
  const data = new FormData(form), category = data.get('category');
  const product = { gender: data.get('gender'), price: data.get('price') === '' ? null : Number(data.get('price')), sku: data.get('sku'), name: data.get('name'), collection: data.get('collection'), category, url: data.get('url'), sizes: data.get('sizes').split(',').map(s => s.trim()).filter(Boolean), inseams: ['Pants','Sets'].includes(category) ? data.get('inseams').split(',').map(s=>s.trim()).filter(Boolean) : [], colors: data.getAll('colors'), allowances: category === 'Tops' ? data.getAll('topAllowance') : [category], active: form.elements.active.checked, matchAnyCollection: form.elements.matchAnyCollection.checked, imageUrl: data.get('imageUrl'), images: { Black: data.get('blackImage'), Navy: data.get('navyImage'), White: data.get('whiteImage'), Ivory: data.get('ivoryImage'), Grey: data.get('greyImage'), 'Dark grey': data.get('darkGreyImage') } };
  $('#save-style').disabled = true; $('#catalog-status').textContent = 'Saving…';
  try {
    const saved = await api('/api/admin/catalog' + (editId ? '/' + encodeURIComponent(editId) : ''), { method: editId ? 'PUT' : 'POST', body: JSON.stringify(product) });
    editId = saved.id; $('#editor-title').textContent = 'Edit approved style';
    $('#catalog-status').textContent = 'Style saved. Employee selections will use the updated catalog.';
    try { await loadCatalog(); } catch { $('#catalog-status').textContent = 'Style saved, but the list could not refresh. Sign in again to reload it.'; }
  } catch (error) { $('#catalog-status').textContent = error.message; }
  finally { $('#save-style').disabled = false; }
};
