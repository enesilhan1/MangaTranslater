// Tesseract.js dosyalarını node_modules'tan vendor/tesseract'a kopyalar.
// Manifest V3 dışarıdan kod yüklemeye izin vermediği için OCR motoru
// eklentiyle birlikte gelir. Sürüm yükseltmek için:
//   npm install && npm run tesseract
// Yalnızca gerekenler alınır: LSTM motoru (eski motor değil) için üç
// çekirdek (Tesseract tarayıcının desteğine göre relaxed-SIMD / SIMD /
// düz olanı kendisi seçer) ve küçük "best_int" İngilizce verisi.

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const kok = new URL('..', import.meta.url);
const nm = (yol) => new URL(`node_modules/${yol}`, kok);
const hedef = (yol) => new URL(`vendor/tesseract/${yol}`, kok);

rmSync(hedef(''), { recursive: true, force: true });
mkdirSync(hedef('cekirdek'), { recursive: true });
mkdirSync(hedef('dil'), { recursive: true });

const dosyalar = [
  ['tesseract.js/dist/tesseract.esm.min.js', 'tesseract.esm.min.js'],
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js/LICENSE.md', 'LICENSE-tesseract.js.md'],
  ['tesseract.js-core/LICENSE', 'LICENSE-tesseract.js-core'],
  ...['', 'simd-', 'relaxedsimd-'].map((t) => [
    `tesseract.js-core/tesseract-core-${t}lstm.wasm.js`,
    `cekirdek/tesseract-core-${t}lstm.wasm.js`,
  ]),
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'dil/eng.traineddata.gz'],
];
for (const [kaynak, ad] of dosyalar) copyFileSync(nm(kaynak), hedef(ad));

const surum = (p) => JSON.parse(readFileSync(nm(`${p}/package.json`), 'utf8')).version;
const not = `Tesseract.js ${surum('tesseract.js')}, tesseract.js-core ${surum('tesseract.js-core')}, ` +
  `@tesseract.js-data/eng ${surum('@tesseract.js-data/eng')} (4.0.0_best_int). Apache-2.0.\n` +
  'scripts/tesseract_kopyala.mjs ile üretildi; elle değiştirmeyin.\n';
writeFileSync(hedef('SURUM.txt'), not);
console.log('vendor/tesseract hazır:\n' + not);
