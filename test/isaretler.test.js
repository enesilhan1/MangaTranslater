import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bolgeListesi, isaretKonumlari } from '../src/isaretler.js';

const bulunanlar = [
  { kutu: { x0: 10, y0: 20, x1: 109, y1: 79 }, yazi: { x0: 30, y0: 35, x1: 90, y1: 65 } },
  { kutu: { x0: 0, y0: 0, x1: 49, y1: 49 }, yazi: { x0: 10, y0: 10, x1: 40, y1: 40 } },
];

describe('isaretler', () => {
  it('işaretler 1\'den numaralı, balonun sol üst köşesinde, gönderilen resme ölçekli', () => {
    const [a, b] = isaretKonumlari(bulunanlar, 2, 1000);
    assert.equal(a.no, 1);
    assert.equal(a.r, 16);
    assert.equal(a.x, Math.round(10 * 2 + 16 * 0.4));
    assert.equal(a.y, Math.round(20 * 2 + 16 * 0.4));
    // Kenardaki balonda işaret resimden taşmaz.
    assert.equal(b.x, 16);
    assert.equal(b.y, 16);
    assert.equal(isaretKonumlari(bulunanlar, 1, 300)[0].r, 9);
  });

  it('alan listesi 0-1000 [ymin, xmin, ymax, xmax]', () => {
    assert.deepEqual(bolgeListesi(bulunanlar, { genislik: 500, yukseklik: 800 })[0], { no: 1, kutu: [25, 20, 100, 220] });
  });
});
