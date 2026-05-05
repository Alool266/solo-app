/**
 * Writes minimal valid PNGs only when missing so real icons are not overwritten.
 * Run once: node scripts/write-assets.js
 */
const fs = require('fs');
const path = require('path');

const MIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const root = path.join(__dirname, '..');
const assets = path.join(root, 'assets');
fs.mkdirSync(assets, { recursive: true });

const generatedCandidates = [
  path.join(root, '..', 'assets', 'solo-rep-icon.png'),
  path.join(root, 'solo-rep-icon.png'),
];
let brand = generatedCandidates.find((p) => fs.existsSync(p));
if (brand) {
  for (const name of ['icon.png', 'splash-icon.png', 'adaptive-icon.png']) {
    fs.copyFileSync(brand, path.join(assets, name));
  }
  console.log('Applied Solo Rep icon from', path.relative(root, brand));
} else {
  for (const name of ['icon.png', 'splash-icon.png', 'adaptive-icon.png']) {
    const dest = path.join(assets, name);
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, MIN_PNG);
      console.log('Wrote placeholder', name);
    }
  }
}
console.log('Assets check done.');
