export const required = { Black: 3, Navy: 2 };
export const buckets = ['Tops', 'Pants', 'Long sleeves', 'Jackets'];

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
