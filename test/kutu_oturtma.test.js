import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kutulariOturt } from '../src/kutu_oturtma.js';

const G = 400;
const Y = 600;

/** Gri "çizim" zemini (beyaz değil). */
function resim(zemin = 120) {
  return { gri: new Uint8Array(G * Y).fill(zemin), genislik: G, yukseklik: Y };
}
/** Siyah çerçeveli beyaz elips balon. */
function balonCiz(r, cx, cy, rx, ry) {
  for (let y = 0; y < Y; y++) {
    for (let x = 0; x < G; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) r.gri[y * G + x] = 255;
      else if (d <= 1.08) r.gri[y * G + x] = 0;
    }
  }
}
/** Yazı yerine siyah dikdörtgen. */
function yaziCiz(r, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) r.gri[y * G + x] = 20;
}
/** Piksel kutusundan 0-1 oranlı balon. */
const balon = (x0, y0, x1, y1, ek = {}) => ({
  x: x0 / G, y: y0 / Y, g: (x1 - x0) / G, h: (y1 - y0) / Y, tur: 'balon', orijinal: 'A', ceviri: 'B', ...ek,
});
const piksel = (b) => ({ x0: b.x * G, y0: b.y * Y, x1: (b.x + b.g) * G, y1: (b.y + b.h) * Y });

describe('kutulariOturt', () => {
  it('kaymış tahmini balonun içindeki yazının üstüne oturtur', () => {
    const r = resim();
    balonCiz(r, 200, 150, 100, 70);
    yaziCiz(r, 150, 125, 250, 135);
    yaziCiz(r, 160, 160, 240, 170);
    // Tahmin yazıdan 40 px aşağı ve 30 px sağa kaymış, boyu da yanlış.
    const [b] = kutulariOturt(r, [balon(180, 165, 300, 230)]);
    const k = piksel(b);
    assert.equal(b.oturdu, true);
    assert.ok(Math.abs(k.x0 - 150) <= 10 && Math.abs(k.x1 - 250) <= 10, JSON.stringify(k));
    assert.ok(Math.abs(k.y0 - 125) <= 10 && Math.abs(k.y1 - 170) <= 10, JSON.stringify(k));
    // Balonun (elipsin) dışına taşmaz.
    assert.ok(k.y0 >= 80 && k.y1 <= 220);
  });

  it('tahmin iki balona değiyorsa yazısı tahminin üstünde olanı seçer', () => {
    const r = resim();
    balonCiz(r, 100, 150, 70, 60);
    yaziCiz(r, 70, 140, 130, 160);
    balonCiz(r, 290, 160, 80, 70);
    yaziCiz(r, 250, 145, 330, 175);
    const [b] = kutulariOturt(r, [balon(150, 120, 340, 190)]);
    const k = piksel(b);
    assert.ok(k.x0 > 230 && k.x1 < 350, JSON.stringify(k));
  });

  it('beyaz arka planda (kapalı balon yok) ya da yazısız balonda tahmin korunur', () => {
    const beyaz = resim(255);
    yaziCiz(beyaz, 150, 125, 250, 135);
    const tahmin = balon(140, 110, 260, 150);
    assert.deepEqual(kutulariOturt(beyaz, [tahmin]), [tahmin]);

    const bos = resim();
    balonCiz(bos, 200, 150, 100, 70);
    assert.deepEqual(kutulariOturt(bos, [tahmin]), [tahmin]);
  });

  it('ses efektine dokunmaz', () => {
    const r = resim();
    balonCiz(r, 200, 150, 100, 70);
    yaziCiz(r, 150, 125, 250, 135);
    const ses = balon(180, 165, 300, 230, { tur: 'ses' });
    assert.deepEqual(kutulariOturt(r, [ses]), [ses]);
  });

  it('aynı balona düşen yinelenen kayıtlar birleşir; aynı çeviri bir kez', () => {
    const r = resim();
    balonCiz(r, 200, 150, 100, 70);
    yaziCiz(r, 150, 125, 250, 170);
    const ayni = kutulariOturt(r, [balon(150, 120, 250, 175, { ceviri: 'Uah' }), balon(160, 140, 260, 200, { ceviri: 'Uah' })]);
    assert.equal(ayni.length, 1);
    const farkli = kutulariOturt(r, [balon(150, 120, 250, 175, { ceviri: 'Bir' }), balon(160, 140, 260, 200, { ceviri: 'iki' })]);
    assert.equal(farkli.length, 1);
    assert.equal(farkli[0].ceviri, 'Bir iki');
  });

  it('ayrı balonlar ayrı kalır', () => {
    const r = resim();
    balonCiz(r, 100, 150, 70, 60);
    yaziCiz(r, 70, 140, 130, 160);
    balonCiz(r, 290, 400, 80, 70);
    yaziCiz(r, 250, 385, 330, 415);
    const s = kutulariOturt(r, [balon(60, 130, 140, 170), balon(240, 370, 340, 430)]);
    assert.equal(s.length, 2);
    assert.ok(s.every((b) => b.oturdu));
  });
});
