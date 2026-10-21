import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { balonlariBul, kutulariOturt } from '../src/kutu_oturtma.js';
import { tersYazilariBul } from '../src/ters_yazi.js';

const G = 400;
const Y = 600;
const resim = (zemin) => ({ gri: new Uint8Array(G * Y).fill(zemin), genislik: G, yukseklik: Y });
const dikdortgen = (r, x0, y0, x1, y1, v) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) r.gri[y * G + x] = v;
};
/** Satır: 6x10 px'lik "harfler", aralarında 3 px boşluk. */
const satir = (r, x0, y0, x1, v) => {
  for (let x = x0; x + 6 <= x1; x += 9) dikdortgen(r, x, y0, x + 6, y0 + 10, v);
};

describe('tersYazilariBul', () => {
  it('siyah balondaki beyaz harfli yazıyı bulur; numara koyu zeminde yazının hemen üstünde', () => {
    const r = resim(150);
    dikdortgen(r, 80, 100, 260, 220, 15); // siyah balon
    for (let y = 130; y <= 175; y += 15) satir(r, 110, y, 230, 240);
    const [b, ...fazla] = tersYazilariBul(r);
    assert.equal(fazla.length, 0);
    assert.equal(b.ters, true);
    assert.ok(b.yazi.x0 >= 108 && b.yazi.x1 <= 232 && b.yazi.y0 >= 128 && b.yazi.y1 <= 187, JSON.stringify(b.yazi));
    assert.ok(b.isaret.y < b.kutu.y0 && b.isaret.y - b.isaret.r >= 100, JSON.stringify(b.isaret));
  });

  it('siyah zeminde beyaz haleli koyu harfleri bulur', () => {
    const r = resim(15);
    // Her satırın beyaz halesi; harfler halenin içinde koyu.
    for (let y = 130; y <= 175; y += 15) {
      dikdortgen(r, 108, y - 2, 232, y + 12, 240);
      satir(r, 110, y, 230, 10);
    }
    const bulunan = tersYazilariBul(r);
    assert.equal(bulunan.length, 1, JSON.stringify(bulunan.map((b) => b.yazi)));
  });

  it('arası boş oluklu yan yana iki yazı ayrı bloktur; tek satırlık yazı kelimelerinden bölünmez', () => {
    const r = resim(15);
    for (let y = 130; y <= 175; y += 15) {
      satir(r, 60, y, 150, 240);
      satir(r, 153, y, 243, 240); // oluk 0,6 harf boyu: kümelemede birleşir, sütunlara ayrılır
    }
    assert.equal(tersYazilariBul(r).length, 2);
    const tek = resim(15);
    satir(tek, 60, 130, 150, 240);
    satir(tek, 153, 130, 243, 240); // kelime arası 0,6 harf boyu
    assert.equal(tersYazilariBul(tek).length, 1);
  });

  it('beyaz zemindeki sıradan yazı ve koyu zemindeki dağınık benekler bulunmaz', () => {
    const beyaz = resim(250);
    for (let y = 130; y <= 175; y += 15) satir(beyaz, 110, y, 230, 10);
    assert.equal(tersYazilariBul(beyaz).length, 0);
    const benekli = resim(15);
    // Farklı boylarda, satıra dizilmemiş açık lekeler (yıldız, parlama).
    [[30, 40, 5, 9], [120, 70, 7, 4], [200, 150, 4, 12], [90, 260, 9, 6], [310, 330, 5, 5], [40, 420, 12, 8], [260, 500, 6, 14]]
      .forEach(([x, y, w, h]) => dikdortgen(benekli, x, y, x + w, y + h, 240));
    assert.equal(tersYazilariBul(benekli).length, 0);
  });

  it('balonlariBul siyah balonu numaralar, kutulariOturt çeviriyi koyu zeminle oraya koyar', () => {
    const r = resim(150);
    dikdortgen(r, 80, 100, 260, 220, 15);
    for (let y = 130; y <= 175; y += 15) satir(r, 110, y, 230, 240);
    const bulunanlar = balonlariBul(r);
    assert.equal(bulunanlar.length, 1);
    const [s] = kutulariOturt(r, [{ x: 0.5, y: 0.5, g: 0.1, h: 0.05, tur: 'balon', bolge: 1, orijinal: 'I CAN DO IT', ceviri: 'Yapabilirim' }], bulunanlar);
    assert.equal(s.oturdu, true);
    assert.equal(s.balon.ters, true);
    assert.ok(s.x * G >= 100 && s.x * G <= 115, JSON.stringify(s));
  });
});
