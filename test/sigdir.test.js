import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EN_BUYUK_PUNTO, EN_KUCUK_PUNTO, orijinalPuntosu, puntoBul, puntoTavani, puntoUstSiniri } from '../src/icerik/sigdir.js';

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
