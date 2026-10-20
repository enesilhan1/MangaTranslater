import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bolgeListesi, isaretKonumlari } from '../src/isaretler.js';

const bulunanlar = [
  { kutu: { x0: 10, y0: 20, x1: 109, y1: 79 }, yazi: { x0: 30, y0: 35, x1: 90, y1: 65 } },
  { kutu: { x0: 0, y0: 0, x1: 49, y1: 49 }, yazi: { x0: 10, y0: 10, x1: 40, y1: 40 } },
];

describe('isaretler', () => {
  it('işaret balonun içinde, yazının hemen üstünde ve ortalı; 1 den başlayarak numaralı', () => {
    // Balon 10-109 x 20-79, yazı 30-90 x 35-65 → üstte 15 px (2x ölçekte 30 px) boşluk.
    const [a, b] = isaretKonumlari(bulunanlar, 2, 400);
    assert.equal(a.no, 1);
    assert.equal(b.no, 2);
    assert.equal(a.r, 9);
    assert.equal(a.x, Math.round(((30 + 91) / 2) * 2));
    assert.equal(a.y, 35 * 2 - 9 - 1);
    assert.ok(a.y - a.r >= 40 && a.y + a.r <= 70, 'balonun içinde ve yazının üstünde');
    assert.equal(isaretKonumlari(bulunanlar, 2, 1000)[0].r, 16);
  });

  it('üstte yer yoksa yazının hemen solu, o da yoksa hemen altı, hiçbiri yoksa köşe', () => {
    const solda = [{ kutu: { x0: 0, y0: 100, x1: 199, y1: 159 }, yazi: { x0: 40, y0: 102, x1: 190, y1: 157 } }];
    const [s] = isaretKonumlari(solda, 1, 400);
    assert.equal(s.x, 40 - 9 - 1);
    assert.equal(s.y, Math.round((102 + 158) / 2));
    const altta = [{ kutu: { x0: 0, y0: 100, x1: 199, y1: 159 }, yazi: { x0: 2, y0: 101, x1: 197, y1: 130 } }];
    const [a] = isaretKonumlari(altta, 1, 400);
    assert.equal(a.y, 131 + 9 + 1);
    const dar = [{ kutu: { x0: 0, y0: 0, x1: 49, y1: 49 }, yazi: { x0: 2, y0: 2, x1: 47, y1: 47 } }];
    const [d] = isaretKonumlari(dar, 1, 400, 400);
    assert.equal(d.x, 9);
    assert.equal(d.y, 9);
  });

  it('alan listesi 0-1000 [ymin, xmin, ymax, xmax]', () => {
    assert.deepEqual(bolgeListesi(bulunanlar, { genislik: 500, yukseklik: 800 })[0], { no: 1, kutu: [25, 20, 100, 220] });
  });
});
