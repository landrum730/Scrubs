import { allowanceCounts, allowanceError, required } from './policy.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { Tops: 'Top for a scrub set', Pants: 'Pants for a scrub set', Sets: 'Complete scrub set', 'Long sleeves': 'Additional long-sleeve top', Jackets: 'Additional jacket' };
let catalog = [], cart = [], sending = false;
try { cart = JSON.parse(localStorage.getItem('scrubs-cart') || '[]'); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }
function persist() { try { localStorage.setItem('scrubs-cart', JSON.stringify(cart)); } catch {} renderCart(); }
function renderProducts(filter = 'All') {
  const products = catalog.filter(p => filter === 'All' || (filter === 'Long sleeves' ? p.allowances.includes(filter) : p.category === filter));
  $('#product-count').textContent = products.length + ' approved options';
  $('#products').innerHTML = products.map(p => `<article class="product"><div class="product-art ${p.category === 'Pants' ? 'pants' : p.category === 'Jackets' ? 'jacket' : p.category === 'Sets' ? 'set' : 'top'}"><div class="garment" aria-hidden="true"></div><span class="badge">APPROVED</span></div><div class="product-info"><span class="category">${escape(p.category)}</span><h3>${escape(p.name)}</h3><p class="price">${escape(p.collection)} · ${escape(p.sku)}</p><a class="product-link" href="${escape(p.url)}" target="_blank" rel="noopener noreferrer">View style details ↗</a><form data-product="${escape(p.id)}"><label>Use toward<select name="allowance">${p.allowances.map(a => `<option value="${escape(a)}">${escape(labels[a])}</option>`).join('')}</select></label><label>Color<select name="color"></select></label><label class="white-assignment" hidden>Count this white top toward<select name="setColor"><option value="Black">Black set</option><option value="Navy">Navy set</option></select></label><div class="choices"><label>${p.category === 'Sets' ? 'Set size' : 'Size'}<select name="size" required><option value="">Select size</option>${p.sizes.map(s => `<option>${escape(s)}</option>`).join('')}</select></label><label>Qty<input name="quantity" type="number" min="1" max="3" value="1" required></label></div><button class="add" type="submit">Add to cart <span>+</span></button><p class="product-status" role="status"></p></form></div></article>`).join('');
  document.querySelectorAll('[data-product]').forEach(form => {
    const product = catalog.find(p => p.id === form.dataset.product);
    const allowance = form.elements.allowance, color = form.elements.color;
    const updateAssignment = () => { form.querySelector('.white-assignment').hidden = color.value !== 'White'; };
    const updateColors = () => {
      const previous = color.value;
      color.innerHTML = product.colors.filter(c => c !== 'White' || allowance.value === 'Tops').map(c => `<option>${escape(c)}</option>`).join('');
      if ([...color.options].some(o => o.value === previous)) color.value = previous;
      updateAssignment();
    };
    allowance.onchange = updateColors; color.onchange = updateAssignment; updateColors();
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form), status = form.querySelector('.product-status');
      const item = { id: product.id, size: data.get('size'), color: data.get('color'), allowance: data.get('allowance'), quantity: Number(data.get('quantity')) };
      item.setColor = item.color === 'White' ? data.get('setColor') : item.color;
      if (!item.size || !item.color || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 3) { status.textContent = 'Please choose a size, color, and quantity (1–3).'; return; }
      const candidate = structuredClone(cart);
      const existing = candidate.find(i => ['id', 'size', 'color', 'allowance', 'setColor'].every(key => i[key] === item[key]));
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
    return `<div class="cart-row"><div><strong>${escape(p.name)}</strong><p>${escape(item.color)} · Size ${escape(item.size)} · ${escape(labels[item.allowance])}${item.color === 'White' ? ' (' + escape(item.setColor) + ' set)' : ''}</p><small>${escape(p.sku)}</small></div><label>Qty<input type="number" min="1" max="3" value="${item.quantity}" data-quantity="${index}"></label><button class="remove" data-remove="${index}" aria-label="Remove ${escape(p.name)}">Remove</button></div>`;
  }).join('') : '<p class="empty">Choose your styles above to build your five scrub sets.</p>';
  const counts = allowanceCounts(cart, catalog);
  const error = allowanceError(counts);
  $('#allowance').innerHTML = Object.entries(required).map(([color, target]) => `<div class="allowance-line"><strong>${color}: ${target} required sets</strong><span>${counts[color].Tops}/${target} tops · ${counts[color].Pants}/${target} pants</span></div><div class="allowance-line optional"><span>${color} extras (optional)</span><span>${counts[color]['Long sleeves']}/1 long sleeve · ${counts[color].Jackets}/1 jacket</span></div>`).join('');
  $('#submit-order').disabled = sending || Boolean(error);
  $('#allowance-help').textContent = error || 'Your five sets are complete. Add optional long sleeves or jackets, or send your order.';
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
  document.querySelector('.filters .active').classList.remove('active'); button.classList.add('active'); renderProducts(button.dataset.filter);
});
$('#cart-link').onclick = () => $('#cart').scrollIntoView({ behavior: 'smooth' });
$('#order-form').onsubmit = async event => {
  event.preventDefault();
  if (sending || allowanceError(allowanceCounts(cart, catalog))) return;
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
    item.allowance ||= p.category; item.setColor ||= item.color;
    return p.colors.includes(item.color) && p.sizes.includes(item.size) && p.allowances.includes(item.allowance) && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 3 && ['Black', 'Navy'].includes(item.setColor) && (item.color === 'White' ? item.allowance === 'Tops' : item.setColor === item.color);
  });
  if (previousCount !== cart.length) $('#message').textContent = 'Some previously saved items are no longer approved and were removed from your cart.';
  renderProducts(); persist();
}).catch(() => { $('#products').textContent = 'Unable to load the collection. Please refresh to try again.'; $('#checkout').hidden = true; });
