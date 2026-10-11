import { supplierPrices } from './product-prices.js';
import { supplierImages } from './product-images.js';
// Initial approved catalog. Administrator changes are stored separately in data/catalog.json.
const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const ua = 'https://www.uniformadvantage.com/';
const ah = 'https://allheart.com/products/';
// Length variants listed on the supplied supplier pages.
const inseams = {CK115:['Petite','Regular'],CK105:['Petite','Regular','Tall'],CK096:['Petite','Regular','Tall'],CK272:['Petite','Regular','Tall'],CK00034:['Petite','Regular','Tall'],'UNISEX-SET':['Short','Regular','Tall']};
const style = (id, name, collection, category, url, options = {}) => ({
  id, sku: id, name, collection, category, url,
  colors: ['Black', 'Navy'], sizes: [...sizes], inseams: inseams[id] || [],
  price: supplierPrices[id] ?? null, allowances: [category], active: true, matchAnyCollection: false, images: supplierImages[id] || {}, imageUrl: supplierImages[id]?.default || supplierImages[id]?.Black || '', ...options
});
export const catalog = [
  style('CK00038', 'Mandarin collar scrub top', 'Cherokee Workwear Revolution', 'Tops', ua+'cherokee-workwear-revolution-women-s-2-pocket-stretch-dolman-sleeve-mandarin-collar-scrub-top/CK00038.html'),
  style('CK115', 'Cargo jogger scrub pants', 'Cherokee Workwear Revolution', 'Pants', ua+'cherokee-workwear-revolution-women-s-5-pocket-stretch-cargo-jogger-scrub-pants/CK115.html'),
  style('CK105', 'Drawstring cargo scrub pants', 'Cherokee Workwear Revolution', 'Pants', ua+'cherokee-workwear-revolution-womens-5-pocket-drawstring-cargo-scrub-pants/CK105.html'),
  style('CK096', 'Pull-on straight-leg scrub pants', 'Cherokee Achieve', 'Pants', ah+'achieve-by-cherokee-womens-pull-on-straight-leg-pant-ckck096?variant=47427314745500'),
  style('CK936', 'Raglan crew-neck knit scrub top', 'Cherokee Achieve', 'Tops', ua+'cherokee-achieve-women-s-1-pocket-stretch-raglan-sleeve-crew-neck-knit-scrub-top/CK936.html'),
  style('CK272', 'Straight-leg cargo scrub pants', 'Cherokee Workwear Originals Ultra', 'Pants', ua+'cherokee-workwear-originals-ultra-women-s-4-pocket-drawstring-cargo-straight-leg-scrub-pants/CK272.html'),
  style('CK953', 'Two-pocket V-neck scrub top', 'Cherokee Workwear Originals Ultra', 'Tops', ua+'cherokee-workwear-originals-ultra-women-s-2-pocket-v-neck-scrub-top/CK953.html'),
  style('CK954', 'Tuck-in V-neck scrub top', 'Cherokee Workwear Originals Ultra', 'Tops', ua+'cherokee-workwear-originals-ultra-women-s-1-pocket-tuck-in-v-neck-scrub-top/CK954.html'),
  style('CK00034', 'Mid-rise knit jogger scrub pants', 'Cherokee Workwear Originals Ultra', 'Pants', ah+'womens-5-pocket-mid-rise-knit-jogger-scrub-pant-ckck0034?variant=47561612263580'),
  style('CK962A', 'Two-pocket long-sleeve scrub top', 'Cherokee Workwear Originals Ultra', 'Tops', ah+'womens-2-pocket-long-sleeve-scrub-top-ckck962a', {allowances: ['Tops', 'Long sleeves']}),
  style('UNISEX-SET', 'Unisex V-neck top & cargo pant set', 'Cherokee Workwear Originals Ultra', 'Sets', ah+'unisex-scrub-set-v-neck-1-pocket-scrub-top-drawstring-2-pocket-cargo-scrub-pant'),
  style('CK4881CL', 'Long-sleeve knit underscrub', 'Cherokee underscrubs', 'Tops', ah+'womens-long-sleeve-knit-underscrub-ck4881cl', {allowances: ['Tops', 'Long sleeves'], matchAnyCollection: true}),
  style('CK773', 'Long-sleeve underscrub knit tee', 'Cherokee underscrubs', 'Tops', ah+'womens-long-sleeve-underscrub-knit-tee-ckck773', {colors: ['Black', 'Navy', 'White'], allowances: ['Tops', 'Long sleeves'], matchAnyCollection: true}),
  style('CK4350', 'Three-pocket snap-front scrub jacket', 'Cherokee Workwear', 'Jackets', ua+'cherokee-workwear-womens-3-pocket-snap-front-scrub-jacket/CK4350.html'),
  style('CK00013', 'Crew-neck zip-front scrub jacket', 'Cherokee Workwear Originals Ultra', 'Jackets', ua+'cherokee-workwear-originals-ultra-women-s-2-pocket-crew-neck-zip-front-scrub-jacket/CK00013.html')
];
