import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { METINLER, cevir } from '../src/dil.js';

/** Kaynak koddaki bütün 'hata.x' anahtarları. */
function kullanilanHataAnahtarlari() {
  const anahtarlar = new Set();
  const gez = (klasor) => {
    for (const g of readdirSync(new URL(`../${klasor}/`, import.meta.url), { withFileTypes: true })) {
      if (g.isDirectory()) gez(`${klasor}/${g.name}`);
      else if (g.name.endsWith('.js') && g.name !== 'dil.js') {
        const icerik = readFileSync(new URL(`../${klasor}/${g.name}`, import.meta.url), 'utf8');
        for (const m of icerik.matchAll(/'(hata\.[A-Za-z.]+)'/g)) anahtarlar.add(m[1]);
      }
    }
  };
  gez('src');
  gez('offscreen');
  return anahtarlar;
}

describe('Dil', () => {
  it('iki dilde de aynı anahtarlar var', () => {
    assert.deepEqual(Object.keys(METINLER.en).sort(), Object.keys(METINLER.tr).sort());
  });

  it('kodda kullanılan her hata anahtarının metni var', () => {
    const kullanilan = kullanilanHataAnahtarlari();
    assert.ok(kullanilan.size >= 20);
    for (const a of kullanilan) assert.ok(METINLER.tr[a], a);
  });

  it('parametreleri yerleştirir, boş parametre fazla boşluk bırakmaz', () => {
    assert.equal(cevir('tr', 'hata.yogun', { ad: 'Claude' }), 'Claude şu an çok yoğun. Birkaç dakika sonra tekrar dene.');
    assert.equal(cevir('en', 'hata.model', { mesaj: '' }), 'Model not found. Check the model name in the extension window.');
    assert.equal(cevir('fr', 'hata.durduruldu'), 'Durduruldu.');
    assert.equal(cevir('tr', 'olmayan.anahtar'), 'olmayan.anahtar');
  });
});
