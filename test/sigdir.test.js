import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EN_BUYUK_PUNTO, EN_KUCUK_PUNTO, puntoBul, puntoUstSiniri } from '../src/icerik/sigdir.js';

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
