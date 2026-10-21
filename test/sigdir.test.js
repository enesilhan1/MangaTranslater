import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EN_BUYUK_PUNTO, EN_KUCUK_PUNTO, buyumeyiKirp, orijinalPuntosu, puntoBul, puntoTavani, puntoUstSiniri } from '../src/icerik/sigdir.js';

describe('puntoBul', () => {
  it('sığan en büyük puntoyu az denemeyle bulur', () => {
    const denenen = [];
    const p = puntoBul((n) => (denenen.push(n), n <= 17));
    assert.equal(p, 17);
    assert.ok(denenen.length <= 6, String(denenen.length));
  });

  it('hiçbiri sığmazsa en küçük, hepsi sığarsa en büyük', () => {
    assert.equal(puntoBul(() => false), EN_KUCUK_PUNTO);
    assert.equal(puntoBul(() => true), EN_BUYUK_PUNTO);
    assert.equal(puntoBul(() => true, 8, 20), 20);
  });
});

describe('puntoUstSiniri', () => {
  it('kutu yüksekliğinin yarısı, sınırlar içinde', () => {
    assert.equal(puntoUstSiniri(40), 20);
    assert.equal(puntoUstSiniri(5), EN_KUCUK_PUNTO);
    assert.equal(puntoUstSiniri(500), EN_BUYUK_PUNTO);
  });
});

describe('puntoTavani', () => {
  it('kısa yazılı büyük balonda dev harf yok: orijinal yazının ~boyutu', () => {
    // 120x110 px balonda 27 harflik orijinal ≈ 19 px; kutu sınırı tek başına 42 verirdi.
    const p = puntoTavani(120, 110, 27);
    assert.ok(p >= 18 && p <= 25, String(p));
    assert.ok(p < puntoUstSiniri(110));
  });

  it('kalibrasyon: test sayfasındaki balonun gerçek puntosuna yakın', () => {
    assert.ok(Math.abs(orijinalPuntosu(228, 112, 27) - 26.7) < 1.5);
  });

  it('çok harfli küçük kutuda küçük ama en az okunabilir punto', () => {
    assert.equal(puntoTavani(40, 20, 200), EN_KUCUK_PUNTO);
    assert.ok(orijinalPuntosu(100, 100, 1) === orijinalPuntosu(100, 100, 4)); // tek harf kutuyu şişirmez
  });
});

describe('buyumeyiKirp', () => {
  const yakin = (a, b) => Object.keys(b).every((k) => Math.abs(a[k] - b[k]) < 1e-9);
  it('yan yana kutular büyürken birbirinin üstüne çıkmaz; komşu yoksa büyüme aynen kalır', () => {
    const sol = { x: 0.1, y: 0.1, g: 0.2, h: 0.2 };
    const sag = { x: 0.32, y: 0.1, g: 0.2, h: 0.2 };
    const buyuk = { x: 0.07, y: 0.07, g: 0.26, h: 0.26 }; // sol, %30 büyümüş
    const k = buyumeyiKirp(buyuk, sol, [sag]);
    assert.ok(k.x + k.g <= sag.x + 1e-9, JSON.stringify(k));
    assert.ok(yakin({ x: k.x, y: k.y, h: k.h }, { x: 0.07, y: 0.07, h: 0.26 }));
    assert.ok(yakin(buyumeyiKirp(buyuk, sol, []), buyuk));
    // Altındaki komşu için alt kenar kırpılır.
    const alt = { x: 0.1, y: 0.31, g: 0.2, h: 0.1 };
    const k2 = buyumeyiKirp(buyuk, sol, [alt]);
    assert.ok(k2.y + k2.h <= alt.y + 1e-9 && Math.abs(k2.g - 0.26) < 1e-9, JSON.stringify(k2));
    // Asıl kutuyla zaten kesişen komşu yok sayılır.
    const ust = { x: 0.15, y: 0.15, g: 0.1, h: 0.1 };
    assert.ok(yakin(buyumeyiKirp(buyuk, sol, [ust]), buyuk));
  });

  it('asıl kutuya birkaç piksel binen yan komşuda kenar kesişmenin ortasına çekilir (arasız iki anlatım)', () => {
    const sol = { x: 0.1, y: 0.1, g: 0.2, h: 0.3 };
    const sag = { x: 0.29, y: 0.1, g: 0.1, h: 0.1 };
    const buyuk = { x: 0.07, y: 0.055, g: 0.26, h: 0.39 };
    const k = buyumeyiKirp(buyuk, sol, [sag]);
    // Sağ kenar 0,29–0,30 kesişmesinin ortasında; öbür yönlere büyüme sürer.
    assert.ok(yakin(k, { x: 0.07, y: 0.055, g: 0.225, h: 0.39 }), JSON.stringify(k));
    // Komşu da aynı kuralla kırpılınca iki kutu artık kesişmez.
    const k2 = buyumeyiKirp({ x: 0.275, y: 0.085, g: 0.13, h: 0.13 }, sag, [sol]);
    assert.ok(k2.x >= k.x + k.g - 1e-9, JSON.stringify(k2));
  });
});
