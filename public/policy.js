export const required = { Black: 3, Navy: 2 };
export const buckets = ['Tops', 'Pants', 'Long sleeves', 'Jackets'];
export const collectionKey = value => value.trim().toLowerCase().replace(/\s+/g, ' ');

export function collectionBalances(items, products) {
  const balances = { Black: Object.create(null), Navy: Object.create(null) };
  for (const item of items) {
    const product = products.find(p => p.id === item?.id);
    if (!product) continue;
    const allowance = item.allowance || product.category;
    const color = item.setColor || item.color;
    if (!balances[color] || !['Tops', 'Pants', 'Sets'].includes(allowance)) continue;
    if (allowance === 'Tops' && product.matchAnyCollection) continue;
    const key = collectionKey(product.collection);
    balances[color][key] ||= { name: product.collection, Tops: 0, Pants: 0 };
    if (allowance === 'Sets') {
      balances[color][key].Tops += item.quantity;
      balances[color][key].Pants += item.quantity;
    } else balances[color][key][allowance] += item.quantity;
  }
  return balances;
}

export function collectionError(items, products) {
  const balances = collectionBalances(items, products);
  for (const [color, collections] of Object.entries(balances)) {
    for (const counts of Object.values(collections)) {
      if (counts.Tops > counts.Pants) return `Pair your ${color.toLowerCase()} ${counts.name} tops with pants from the same collection (${counts.Tops} tops, ${counts.Pants} pants). Underscrub tops can match any collection.`;
    }
  }
  return null;
}

export function allowanceCounts(items, products) {
  const counts = Object.fromEntries(Object.keys(required).map(color => [color, Object.fromEntries(buckets.map(bucket => [bucket, 0]))]));
  for (const item of items) {
    const product = products.find(p => p.id === item?.id);
    if (!product) continue;
    const color = item.setColor || item.color;
    const allowance = item.allowance || product.category;
    if (!counts[color]) continue;
    if (allowance === 'Sets') {
      counts[color].Tops += item.quantity;
      counts[color].Pants += item.quantity;
    } else if (buckets.includes(allowance)) counts[color][allowance] += item.quantity;
  }
  return counts;
}

export function allowanceError(counts, { complete = true } = {}) {
  for (const [color, target] of Object.entries(required)) {
    for (const bucket of ['Tops', 'Pants']) {
      if (counts[color][bucket] > target) return `${color} ${bucket.toLowerCase()} exceed your allowance of ${target}.`;
      if (complete && counts[color][bucket] !== target) return `Complete your ${target} ${color.toLowerCase()} sets: choose ${target} tops and ${target} pants.`;
    }
    for (const bucket of ['Long sleeves', 'Jackets']) {
      if (counts[color][bucket] > 1) return `Choose at most 1 additional ${color.toLowerCase()} ${bucket === 'Jackets' ? 'jacket' : 'long-sleeve top'}.`;
    }
  }
  return null;
}
