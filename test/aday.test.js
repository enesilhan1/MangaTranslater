import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dilimBalonlariniYerlestir } from '../src/dilimleme.js';
import { adayMi } from '../src/icerik/aday.js';

const r = (dogalGenislik, dogalYukseklik, gorunenGenislik = dogalGenislik, gorunuyorMu = true) => ({
  dogalGenislik,
  dogalYukseklik,
  gorunenGenislik,
  gorunuyorMu,
});

describe('adayMi', () => {
  it('manga sayfası ve webtoon şeridi aday', () => {
    assert.equal(adayMi(r(800, 1200, 700)), true);
    assert.equal(adayMi(r(720, 20000)), true);
    assert.equal(adayMi(r(1600, 1100, 900)), true); // çift sayfa yayılımı
  });

  it('ikon, avatar, küçük resim ve afiş aday değil', () => {
    assert.equal(adayMi(r(64, 64)), false);
    assert.equal(adayMi(r(300, 450)), false); // kapak küçük resmi
    assert.equal(adayMi(r(1200, 300)), false); // banner
    assert.equal(adayMi(r(800, 1200, 120)), false); // büyük dosya küçük gösterilmiş
  });

  it('görünmeyen (önceden yüklenmiş) sayfada yalnızca doğal boyuta bakılır', () => {
    assert.equal(adayMi(r(800, 1200, 0, false)), true);
  });
});

describe('dilimBalonlariniYerlestir', () => {
  it('dilimdeki konumu bütün resme oranlar; yatay değişmez', () => {
    const [b] = dilimBalonlariniYerlestir({ y0: 1000, y1: 2000 }, 4000, [
      { x: 0.2, y: 0.5, g: 0.3, h: 0.1, orijinal: 'a', ceviri: 'b' },
    ]);
    assert.equal(b.x, 0.2);
    assert.equal(b.g, 0.3);
    assert.equal(b.y, 0.25 + 0.5 * 0.25);
    assert.equal(b.h, 0.025);
    assert.equal(b.ceviri, 'b');
  });
});
