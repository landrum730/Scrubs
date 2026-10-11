import { allowanceCounts, allowanceError, collectionError, collectionBalances, collectionKey, required } from './policy.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = value => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(value);
const labels = { Tops: 'Top for a scrub set', Pants: 'Pants for a scrub set', Sets: 'Complete scrub set', 'Long sleeves': 'Additional long-sleeve top', Jackets: 'Additional jacket' };
let catalog = [], cart = [], sending = false, gender = 'All';
try { cart = JSON.parse(localStorage.getItem('scrubs-cart') || '[]'); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }
function persist() { try { localStorage.setItem('scrubs-cart', JSON.stringify(cart)); } catch {} renderCart(); }
function renderProducts(filter = 'All') {
  const products = catalog.filter(p => (gender === 'All' || p.gender === gender) && (filter === 'All' || (filter === 'Long sleeves' ? p.allowances.includes(filter) : p.category === filter)));
  $('#product-count').textContent = products.length + ' approved options';
  const groups = new Map();
  for (const p of products) {
    const separateUnderscrubs = p.matchAnyCollection && !p.displayCollection;
    const section = p.displayCollection || p.collection;
    const key = p.gender + ':' + (separateUnderscrubs ? 'underscrubs' : collectionKey(section));
    if (!groups.has(key)) groups.set(key, { gender: p.gender, name: separateUnderscrubs ? 'Mix-and-match underscrub tops' : section, items: [], wildcard: separateUnderscrubs });
    groups.get(key).items.push(p);
  }
  for (const group of groups.values()) group.items.sort((a,b)=>['Tops','Pants','Sets','Jackets'].indexOf(a.category)-['Tops','Pants','Sets','Jackets'].indexOf(b.category));
  let previousGender;
  const sortedGroups = [...groups.values()].sort((a,b)=>['Women','Men','Unisex'].indexOf(a.gender)-['Women','Men','Unisex'].indexOf(b.gender));
  $('#products').innerHTML = sortedGroups.map(group => {
    const heading = previousGender !== group.gender ? `<h2 class="fit-heading">${group.gender === 'Women' ? 'Women’s styles' : group.gender === 'Men' ? 'Men’s styles' : 'Unisex styles'}</h2>` : '';
    previousGender = group.gender;
    return `${heading}<section class="collection-group"><div class="collection-heading"><div><h3>${escape(group.name)}</h3><p>${group.wildcard ? 'These tops can pair with pants from any approved collection.' : catalog.some(p => ['Pants','Sets'].includes(p.category) && collectionKey(p.collection) === collectionKey(group.name)) ? 'Choose your top and pants from this collection for a matching set. Long-sleeve and jacket extras are separate.' : 'Matching pants from this collection have not been approved yet. Add matching pants before submitting an order with this top.'}</p></div><span>${group.items.length} ${group.items.length === 1 ? 'style' : 'styles'}</span></div><div class="products">${group.items.map(p => `<article class="product"><div class="product-art"><img class="supplier-photo" alt="${escape(p.name)} — supplier photograph" loading="lazy" referrerpolicy="no-referrer"><span class="badge">APPROVED</span><span class="photo-unavailable" hidden>Product photo unavailable</span></div><div class="product-info"><span class="category">${escape(p.category)}</span><h3>${escape(p.name)}</h3><p class="price">${escape(p.collection)} · ${escape(p.sku)}</p><p class="retail-price">${p.price == null ? "Price not yet added" : "Estimated value: " + money(p.price) + " each"}</p><p class="photo-caption"></p><a class="product-link" href="${escape(p.url)}" target="_blank" rel="noopener noreferrer">View style details ↗</a><form data-product="${escape(p.id)}"><select name="allowance" hidden aria-label="Order category">${p.allowances.map(a => `<option value="${escape(a)}">${escape(labels[a])}</option>`).join('')}</select>${p.allowances.includes("Long sleeves") && p.allowances.includes("Tops") ? `<label class="check"><input type="checkbox" name="extraLongSleeve"${filter === "Long sleeves" ? " checked" : ""}> Optional long-sleeve extra</label>` : ""}<label>Color<select name="color"></select></label><label class="white-assignment" hidden>Count this white top toward<select name="setColor"><option value="Black">Black set</option><option value="Navy">Navy set</option></select></label><div class="choices"><label>${p.category === 'Sets' ? 'Set size' : 'Size'}<select name="size" required><option value="">Select size</option>${p.sizes.map(s => `<option>${escape(s)}</option>`).join('')}</select></label>${p.inseams?.length ? `<label>Inseam<select name="inseam" required><option value="">Select inseam</option>${p.inseams.map(value => `<option>${escape(value)}</option>`).join('')}</select></label>` : ''}<label>Qty<input name="quantity" type="number" min="1" max="3" value="1" required></label></div><button class="add" type="submit">Add to cart <span>+</span></button><p class="product-status" role="status"></p></form></div></article>`).join('')}</div></section>`; }).join('');
  document.querySelectorAll('[data-product]').forEach(form => {
    const product = catalog.find(p => p.id === form.dataset.product);
    const allowance = form.elements.allowance, color = form.elements.color;
    const card = form.closest('.product'), photo = card.querySelector('.supplier-photo');
    const updateAssignment = () => {
      form.querySelector('.white-assignment').hidden = color.value !== 'White';
      const source = product.images?.[color.value] || product.imageUrl || product.images?.default;
      photo.hidden = !source;
      card.querySelector('.photo-unavailable').hidden = Boolean(source);
      card.querySelector('.photo-caption').textContent = product.images?.[color.value] ? color.value + ' · supplier photo' : 'Supplier style photo · photo color may vary';
      if (source) photo.src = source;
    };
    photo.onerror = () => { photo.hidden = true; card.querySelector('.photo-unavailable').hidden = false; };
    photo.onload = () => { photo.hidden = false; card.querySelector('.photo-unavailable').hidden = true; };
    const updateColors = () => {
      const previous = color.value;
      color.innerHTML = product.colors.filter(c => c !== 'White' || allowance.value === 'Tops').map(c => `<option>${escape(c)}</option>`).join('');
      if ([...color.options].some(o => o.value === previous)) color.value = previous;
      updateAssignment();
    };
    const extra = form.elements.extraLongSleeve;
    if (extra) {
      const updateExtra = () => {allowance.value = extra.checked ? "Long sleeves" : "Tops"; updateColors();};
      extra.onchange = updateExtra; updateExtra();
    }
    allowance.onchange = updateColors; color.onchange = updateAssignment; updateColors();
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form), status = form.querySelector('.product-status');
      const item = { id: product.id, size: data.get('size'), color: data.get('color'), allowance: data.get('allowance'), quantity: Number(data.get('quantity')), inseam: data.get('inseam') || '' };
      item.setColor = item.color === 'White' ? data.get('setColor') : item.color;
      if (product.inseams?.length && !product.inseams.includes(item.inseam)) { status.textContent = 'Please select an inseam.'; return; }
      if (!item.size || !item.color || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 3) { status.textContent = 'Please choose a size, color, and quantity (1–3).'; return; }
      const candidate = structuredClone(cart);
      const existing = candidate.find(i => ['id', 'size', 'inseam', 'color', 'allowance', 'setColor'].every(key => i[key] === item[key]));
      if (existing) existing.quantity += item.quantity; else candidate.push(item);
      const error = allowanceError(allowanceCounts(candidate, catalog), { complete: false });
      if (error) { status.textContent = error + ' Remove or adjust items in your cart first.'; return; }
      cart = candidate; persist(); status.textContent = 'Added to your cart.';
    });
  });
}
function renderCart() {
  $('#count').textContent = cart.reduce((n, item) => n + item.quantity, 0);
  $('#checkout').hidden = !cart.length;
  $('#cart-items').innerHTML = cart.length ? cart.map((item, index) => {
    const p = catalog.find(p => p.id === item.id);
    return `<div class="cart-row"><div><strong>${escape(p.name)}</strong><p>${escape(item.color)} · Size ${escape(item.size)} · ${escape(labels[item.allowance])}${item.color === 'White' ? ' (' + escape(item.setColor) + ' set)' : ''}</p><small>${escape(p.collection)} · ${escape(p.sku)}</small><p>${p.price == null ? "Value unavailable" : money(p.price) + " each · " + money(Math.round(p.price*100)*item.quantity/100)}</p></div>${p.inseams?.length ? `<label class="inseam-choice">Inseam<select data-inseam="${index}"><option value="">Select inseam</option>${p.inseams.map(value => `<option${value === item.inseam ? ' selected' : ''}>${escape(value)}</option>`).join('')}</select></label>` : ''}<label>Qty<input type="number" min="1" max="3" value="${item.quantity}" data-quantity="${index}"></label><button class="remove" data-remove="${index}" aria-label="Remove ${escape(p.name)}">Remove</button></div>`;
  }).join('') : '<p class="empty">Choose your styles above to build your five scrub sets.</p>';
  const unpriced = cart.some(item => catalog.find(p=>p.id===item.id).price == null);
  const value = cart.reduce((sum,item)=>sum+Math.round((catalog.find(p=>p.id===item.id).price ?? 0)*100)*item.quantity,0)/100;
  $("#cart-value").textContent = (unpriced ? "Estimated subtotal: " : "Estimated total value: ") + money(value) + (unpriced ? " · Some items have no price yet" : "");
  const counts = allowanceCounts(cart, catalog);
  const missingInseam = cart.some(item => {const p=catalog.find(p=>p.id===item.id);return p.inseams?.length && !p.inseams.includes(item.inseam);});
  const error = missingInseam ? 'Choose an inseam for each pair of pants or complete set in your cart.' : allowanceError(counts) || collectionError(cart, catalog);
  const balances = collectionBalances(cart, catalog);
  $('#collection-check').innerHTML = Object.entries(balances).flatMap(([color, collections]) => Object.values(collections).map(group => `<p class="collection-balance">${escape(color)} · ${escape(group.name)}: ${group.Tops} tops / ${group.Pants} pants${group.Pants > group.Tops ? ' (underscrubs can fill the remaining tops)' : ''}</p>`)).join('');
  $('#allowance').innerHTML = Object.entries(required).map(([color, target]) => `<div class="allowance-line"><strong>${color}: ${target} required sets</strong><span>${counts[color].Tops}/${target} tops · ${counts[color].Pants}/${target} pants</span></div><div class="allowance-line optional"><span>${color} extras (optional)</span><span>${counts[color]['Long sleeves']}/1 long sleeve · ${counts[color].Jackets}/1 jacket</span></div>`).join('');
  $('#submit-order').disabled = sending || Boolean(error);
  $('#allowance-help').textContent = error || 'Your five sets are complete. Add optional long sleeves or jackets, or send your order.';
  document.querySelectorAll('[data-inseam]').forEach(input => input.onchange = () => {cart[Number(input.dataset.inseam)].inseam=input.value;persist();});
  document.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { cart.splice(Number(button.dataset.remove), 1); persist(); });
  document.querySelectorAll('[data-quantity]').forEach(input => input.onchange = () => {
    const quantity = Number(input.value), candidate = structuredClone(cart);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 3) { renderCart(); return; }
    candidate[Number(input.dataset.quantity)].quantity = quantity;
    const error = allowanceError(allowanceCounts(candidate, catalog), { complete: false });
    if (error) { $('#message').textContent = error; renderCart(); return; }
    cart = candidate; persist();
  });
}
document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => {
  document.querySelector('[data-filter].active').classList.remove('active'); button.classList.add('active'); renderProducts(button.dataset.filter);
});
document.querySelectorAll('[data-gender]').forEach(button => button.onclick = () => {
  gender = button.dataset.gender;
  document.querySelectorAll('[data-gender]').forEach(b=>b.classList.toggle('active',b===button));
  renderProducts(document.querySelector('[data-filter].active')?.dataset.filter || 'All');
});
$('#cart-link').onclick = () => $('#cart').scrollIntoView({ behavior: 'smooth' });
$('#order-form').onsubmit = async event => {
  event.preventDefault();
  if (sending || cart.some(item => {const p=catalog.find(p=>p.id===item.id);return p.inseams?.length && !p.inseams.includes(item.inseam);}) || allowanceError(allowanceCounts(cart, catalog)) || collectionError(cart, catalog)) return;
  sending = true; renderCart(); $('#message').textContent = 'Sending your order…';
  try {
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee: Object.fromEntries(new FormData(event.target)), items: cart }) });
    const result = await response.json();
    if (!response.ok) throw Error(result.error);
    cart = []; persist(); event.target.reset();
    $('#message').textContent = 'Order submitted! Your administrator can now review it. Reference: ' + result.id;
  } catch (error) { $('#message').textContent = error.message || 'Could not submit your order. Please try again.'; }
  finally { sending = false; renderCart(); }
};
fetch('/api/catalog').then(response => { if (!response.ok) throw Error(); return response.json(); }).then(data => {
  catalog = data;
  const previousCount = cart.length;
  cart = cart.filter(item => {
    const p = catalog.find(p => p.id === item?.id);
    if (!p) return false;
    item.allowance ||= p.category; item.setColor ||= item.color; item.inseam ||= '';
    if (p.inseams?.length && !p.inseams.includes(item.inseam)) item.inseam='';
    if (!p.inseams?.length) item.inseam='';
    return p.colors.includes(item.color) && p.sizes.includes(item.size) && p.allowances.includes(item.allowance) && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 3 && ['Black', 'Navy'].includes(item.setColor) && (item.color === 'White' ? item.allowance === 'Tops' : item.setColor === item.color);
  });
  if (previousCount !== cart.length) $('#message').textContent = 'Some previously saved items are no longer approved and were removed from your cart.';
  renderProducts(); persist();
}).catch(() => { $('#products').textContent = 'Unable to load the collection. Please refresh to try again.'; $('#checkout').hidden = true; });
