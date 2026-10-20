import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { balonlariBul, kutulariOturt } from '../src/kutu_oturtma.js';

const G = 400;
const Y = 600;

/** Gri "çizim" zemini (beyaz değil). */
function resim(zemin = 120) {
  return { gri: new Uint8Array(G * Y).fill(zemin), genislik: G, yukseklik: Y };
}
const boya = (r, x, y, v) => {
  if (x >= 0 && y >= 0 && x < G && y < Y) r.gri[y * G + x] = v;
};
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
/** Yazı satırı: 6x10 px'lik "harfler", aralarında 3 px boşluk. */
function yaziCiz(r, x0, y0, x1) {
  for (let x = x0; x + 6 <= x1; x += 9) {
    for (let y = y0; y < y0 + 10; y++) for (let dx = 0; dx < 6; dx++) boya(r, x + dx, y, 20);
  }
}
/** Piksel kutusundan 0-1 oranlı balon. */
const balon = (x0, y0, x1, y1, ek = {}) => ({
  x: x0 / G, y: y0 / Y, g: (x1 - x0) / G, h: (y1 - y0) / Y, tur: 'balon', orijinal: 'A', ceviri: 'B', ...ek,
});
const piksel = (b) => ({ x0: b.x * G, y0: b.y * Y, x1: (b.x + b.g) * G, y1: (b.y + b.h) * Y });

/** İki yazılı balon: sol üstte A, sağ altta B. */
function ikiBalon() {
  const r = resim();
  balonCiz(r, 110, 140, 80, 60);
  yaziCiz(r, 70, 125, 150);
  yaziCiz(r, 75, 145, 145);
  balonCiz(r, 290, 420, 80, 65);
  yaziCiz(r, 250, 405, 330);
  yaziCiz(r, 255, 425, 325);
  return r;
}

describe('balonlariBul', () => {
  it('yazılı balonları okuma sırasıyla bulur, yazının sınırlarını verir', () => {
    const b = balonlariBul(ikiBalon());
    assert.equal(b.length, 2);
    assert.ok(b[0].yazi.x0 >= 30 && b[0].yazi.x0 <= 72 && b[0].yazi.y1 <= 170, JSON.stringify(b[0]));
    assert.ok(b[1].yazi.x0 >= 210 && b[1].yazi.y0 >= 360, JSON.stringify(b[1]));
  });

  it('yazısız balonu ve çizim çizgili beyaz paneli balon saymaz', () => {
    const r = resim();
    balonCiz(r, 110, 140, 80, 60); // boş balon
    // Beyaz panel, içinden boydan boya kalın bir çizim çizgisi ve birkaç küçük çizgi geçiyor.
    for (let y = 300; y < 520; y++) for (let x = 200; x < 380; x++) r.gri[y * G + x] = 250;
    for (let t = 0; t < 200; t++) {
      for (let k = 0; k < 4; k++) boya(r, 215 + Math.round(t * 0.75) + k, 310 + t, 10);
    }
    for (let i = 0; i < 5; i++) for (let k = 0; k < 6; k++) boya(r, 230 + i * 25, 480 + k, 10);
    assert.deepEqual(balonlariBul(r), []);
  });
});

describe('kutulariOturt', () => {
  it('işaret numarası verilen kayıt, modelin kutusu nerede olursa olsun o balona gider', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    // Model kutusu tamamen yanlış yerde (sol üst), ama 2 numaralı balon dedi.
    const [b] = kutulariOturt(r, [balon(10, 10, 60, 40, { bolge: 2, ceviri: 'iki' })], bulunanlar);
    const k = piksel(b);
    assert.equal(b.oturdu, true);
    assert.ok(k.x0 > 200 && k.y0 > 350, JSON.stringify(k));
  });

  it('aynı numara iki farklı metne: balona yakın olan kalır, diğeri boş balona geçer', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    // Sayfadaki hata: model sol üst balonun metnine de 2 numarayı verdi, ama
    // kutusu sol üst balonun üstünde.
    const s = kutulariOturt(r, [
      balon(70, 125, 150, 155, { bolge: 2, ceviri: 'üstteki' }),
      balon(250, 405, 330, 435, { bolge: 2, ceviri: 'alttaki' }),
    ], bulunanlar);
    assert.equal(s.length, 2);
    const ust = piksel(s.find((b) => b.ceviri === 'üstteki'));
    const alt = piksel(s.find((b) => b.ceviri === 'alttaki'));
    assert.ok(ust.y1 < 200 && ust.x0 < 100, JSON.stringify(ust));
    assert.ok(alt.y0 > 350 && alt.x0 > 200, JSON.stringify(alt));
    assert.ok(s.every((b) => b.oturdu));
  });

  it('aynı numara ve tahmin de aynı balonda: model balonu bölmüş, art arda yazılır; aynısı bir kez', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    const bolunmus = kutulariOturt(r, [
      balon(70, 120, 150, 135, { bolge: 1, ceviri: 'Bir' }),
      balon(75, 140, 145, 158, { bolge: 1, ceviri: 'iki' }),
    ], bulunanlar);
    assert.equal(bolunmus.length, 1);
    assert.equal(bolunmus[0].ceviri, 'Bir iki');
    const ayni = kutulariOturt(r, [balon(0, 0, 1, 1, { bolge: 1, ceviri: 'Uah' }), balon(0, 0, 1, 1, { bolge: 1, ceviri: 'Uah' })], bulunanlar);
    assert.equal(ayni.length, 1);
  });

  it('numarasız kayıt: kaymış tahmin en yakın geçerli balona oturur', () => {
    const r = ikiBalon();
    // Tahmin sağ alt balonun yazısından 40 px aşağı, 30 px sağa kaymış.
    const [b] = kutulariOturt(r, [balon(280, 440, 380, 500)]);
    const k = piksel(b);
    assert.equal(b.oturdu, true);
    assert.ok(Math.abs(k.x0 - 250) <= 15 && Math.abs(k.y0 - 405) <= 15, JSON.stringify(k));
  });

  it('numarasız kayıt numaralı kayda verilmiş balona oturmaz; farklı metinler birleşmez', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    const s = kutulariOturt(r, [
      balon(0, 0, 1, 1, { bolge: 2, ceviri: 'numaralı' }),
      balon(250, 405, 330, 435, { ceviri: 'numarasız' }),
    ], bulunanlar);
    assert.equal(s.length, 2);
    const numarasiz = s.find((b) => b.ceviri === 'numarasız');
    assert.notEqual(numarasiz.oturdu, true);
  });

  it('numarasız iki farklı kayıt aynı balona düşerse ikincisi tahminde kalır', () => {
    const r = ikiBalon();
    const s = kutulariOturt(r, [balon(240, 400, 340, 440, { ceviri: 'Uah' }), balon(250, 410, 335, 445, { ceviri: 'Başka' })]);
    assert.equal(s.length, 2);
    assert.equal(s.filter((b) => b.oturdu).length, 1);
    assert.ok(!s.some((b) => b.ceviri.includes(' ')), 'farklı metinler birleşmemeli');
  });

  it('beyaz arka planda ya da yazısız balonda tahmin korunur; ses efektine dokunmaz', () => {
    const beyaz = resim(255);
    yaziCiz(beyaz, 150, 125, 250);
    const tahmin = balon(140, 110, 260, 150);
    assert.deepEqual(kutulariOturt(beyaz, [tahmin]), [tahmin]);

    const bos = resim();
    balonCiz(bos, 200, 150, 100, 70);
    assert.deepEqual(kutulariOturt(bos, [tahmin]), [tahmin]);

    const r = ikiBalon();
    const ses = balon(250, 405, 330, 435, { tur: 'ses', bolge: 2 });
    assert.deepEqual(kutulariOturt(r, [ses], balonlariBul(r)), [ses]);
  });
});
