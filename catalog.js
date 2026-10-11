import { supplierPrices } from './product-prices.js';
import { supplierImages } from './product-images.js';
// Initial approved catalog. Administrator changes are stored separately in data/catalog.json.
const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const ua = 'https://www.uniformadvantage.com/';
const ah = 'https://allheart.com/products/';
// Length variants listed on the supplied supplier pages.
const inseams = {CK115:['Petite','Regular'],CK105:['Petite','Regular','Tall'],CK096:['Petite','Regular','Tall'],CK272:['Petite','Regular','Tall'],CK00034:['Petite','Regular','Tall'],'UNISEX-SET':['Short','Regular','Tall']};
const style = (id, name, collection, category, url, options = {}) => ({
  id, sku: id, name, collection, category, url, gender: 'Women',
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
  style('UNISEX-SET', 'Unisex V-neck top & cargo pant set', 'Cherokee Workwear Originals Ultra', 'Sets', ah+'unisex-scrub-set-v-neck-1-pocket-scrub-top-drawstring-2-pocket-cargo-scrub-pant', {gender: 'Unisex'}),
  style('CK4881CL', 'Long-sleeve knit underscrub', 'Cherokee underscrubs', 'Tops', ah+'womens-long-sleeve-knit-underscrub-ck4881cl', {allowances: ['Tops', 'Long sleeves'], matchAnyCollection: true}),
  style('CK773', 'Long-sleeve underscrub knit tee', 'Cherokee underscrubs', 'Tops', ah+'womens-long-sleeve-underscrub-knit-tee-ckck773', {colors: ['Black', 'Navy', 'White'], allowances: ['Tops', 'Long sleeves'], matchAnyCollection: true}),
  style('CK00013', 'Crew-neck zip-front scrub jacket', 'Cherokee Workwear Originals Ultra', 'Jackets', ua+'cherokee-workwear-originals-ultra-women-s-2-pocket-crew-neck-zip-front-scrub-jacket/CK00013.html'),
  style("CK310", "Snap-front scrub jacket", "Cherokee Workwear Revolution", "Jackets", "https://www.uniformadvantage.com/cherokee-workwear-revolution-womens-3-pocket-snap-front-scrub-jacket/CK310.html", {"gender": "Women", "sizes": ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]}),
  style("CK657", "V-neck tuck-in scrub top", "Cherokee Workwear Revolution", "Tops", "https://www.uniformadvantage.com/cherokee-workwear-revolution-womens-1-pocket-v-neck-tuck-in-scrub-top/CK657.html", {"gender": "Women", "sizes": ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]}),
  style("CK610", "Mock-wrap scrub top", "Cherokee Workwear Revolution", "Tops", "https://www.uniformadvantage.com/cherokee-workwear-revolution-womens-2-pocket-mock-wrap-scrub-top/CK610.html", {"gender": "Women", "sizes": ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]}),
  style("CK00027", "Full-zip collar scrub top", "Cherokee Workwear Originals Ultra", "Tops", "https://www.uniformadvantage.com/cherokee-workwear-originals-ultra-men-s-3-pocket-full-zip-front-collar-scrub-top/CK00027.html", {"gender": "Men", "sizes": ["S", "M", "L", "XL", "2XL", "3XL"]}),
  style("CK278", "Flat-front cargo jogger scrub pants", "Cherokee Workwear Originals Ultra", "Pants", "https://www.uniformadvantage.com/cherokee-workwear-originals-ultra-men-s-4-pocket-flat-front-cargo-jogger-scrub-pants/CK278.html", {"gender": "Men", "sizes": ["S", "M", "L", "XL", "2XL", "3XL"], "inseams": ["Regular"]}),
  style("CK279", "Straight-leg drawstring cargo scrub pants", "Cherokee Workwear Originals Ultra", "Pants", "https://www.uniformadvantage.com/cherokee-workwear-originals-ultra-men-s-6-pocket-straight-leg-drawstring-cargo-scrub-pants/CK279.html", {"gender": "Men", "sizes": ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"], "inseams": ["Regular"]}),
  style("CK783", "Three-pocket V-neck scrub top", "Cherokee Workwear Originals Ultra", "Tops", "https://www.uniformadvantage.com/cherokee-workwear-originals-ultra-men-s-3-pocket-v-neck-scrub-top/CK783.html", {"gender": "Men", "sizes": ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"]}),
  style("CK963", "V-neck tuck-in scrub top", "Cherokee Achieve", "Tops", "https://www.uniformadvantage.com/cherokee-achieve-women-s-1-pocket-tuck-in-v-neck-scrub-top/CK963.html", {"gender": "Women", "sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL"]}),
  style("CK863", "Tunic V-neck knit scrub top", "Cherokee Achieve", "Tops", "https://www.uniformadvantage.com/cherokee-achieve-women-s-3-pocket--stretch-tunic-v-neck-knit-scrub-top/CK863.html", {"gender": "Women", "sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL"]}),
  style("CK832", "Two-pocket knit V-neck scrub top", "Cherokee Achieve", "Tops", "https://www.uniformadvantage.com/cherokee-achieve-women-s-2-pocket-stretch-knit-v-neck-scrub-top/CK832.html", {"gender": "Women", "sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL"]}),
  style("CK033", "Stretch cargo jogger scrub pants", "Cherokee Achieve", "Pants", "https://www.uniformadvantage.com/cherokee-achieve-women-s-5-pocket-stretch-cargo-jogger-scrub-pants/CK033.html", {"gender": "Women", "sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL"], "inseams": ["Petite", "Regular"]}),
  style("CK807", "Long-sleeve knit underscrub", "Cherokee underscrubs", "Tops", "https://www.uniformadvantage.com/cherokee-men-s-stretch-long-sleeve-knit-underscrub/CK807.html", {"gender": "Men", "colors": ["Black", "White"], "sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL"], "allowances": ["Tops", "Long sleeves"], "matchAnyCollection": true})
];
