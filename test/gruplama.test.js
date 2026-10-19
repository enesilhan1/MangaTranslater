import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { balonlaraGrupla, cumleDuzeni } from '../src/yerel/gruplama.js';

const BOYUT = { genislik: 1000, yukseklik: 2000 };
/** x, y: sol üst köşe; kelime 20 px yüksek, harf başına 12 px. */
const k = (metin, x, y, guven = 90) => ({
  metin,
  guven,
  kutu: { x0: x, y0: y, x1: x + metin.length * 12, y1: y + 20 },
});

describe('balonlaraGrupla', () => {
  it('alt alta satırları tek balonda okuma sırasıyla birleştirir', () => {
    const b = balonlaraGrupla(
      [k('GOING?', 110, 130), k('WHERE', 100, 100), k('ARE', 180, 100), k('YOU', 230, 100)],
      BOYUT,
    );
    assert.equal(b.length, 1);
    assert.equal(b[0].orijinal, 'WHERE ARE YOU GOING?');
    // Kutu kelimeleri biraz taşar (20 px * 0.35 = 7 px pay).
    assert.ok(Math.abs(b[0].x - 93 / 1000) < 1e-9);
    assert.ok(Math.abs(b[0].y - 93 / 2000) < 1e-9);
  });

  it('uzak balonları ayırır; yukarıdan aşağı, aynı hizada soldan sağa sıralar', () => {
    const b = balonlaraGrupla(
      [k('THIRD', 100, 900), k('SECOND', 700, 100), k('FIRST', 100, 105)],
      BOYUT,
    );
    assert.deepEqual(b.map((x) => x.orijinal), ['FIRST', 'SECOND', 'THIRD']);
  });

  it('aynı satırda ama arası açık iki metin ayrı balon', () => {
    const b = balonlaraGrupla([k('HEY', 100, 100), k('YOU', 400, 100)], BOYUT);
    assert.equal(b.length, 2);
  });

  it('çok farklı boyuttaki yazılar (ses efekti + balon) birleşmez', () => {
    const buyuk = { metin: 'BOOM', guven: 90, kutu: { x0: 100, y0: 60, x1: 400, y1: 140 } };
    const b = balonlaraGrupla([buyuk, k('NO', 120, 141), k('WAY', 160, 141)], BOYUT);
    assert.equal(b.length, 2);
  });

  it('düşük güvenli, harfsiz ve tek harfli gürültüyü atar', () => {
    const b = balonlaraGrupla(
      [k('~|/', 500, 500), k('Xq', 100, 900, 30), k('l', 800, 1500), k('OKAY', 100, 100)],
      BOYUT,
    );
    assert.deepEqual(b.map((x) => x.orijinal), ['OKAY']);
  });

  it('ortalama güveni düşük balonu tamamen atar', () => {
    const b = balonlaraGrupla([k('ABCD', 100, 100, 55), k('EFGH', 160, 100, 60)], BOYUT);
    assert.deepEqual(b, []);
  });

  it('noktalama kelimeleri balona katılır, satır sonu tiresi birleştirilir', () => {
    const b = balonlaraGrupla([k('CONTIN-', 100, 100), k('UED', 100, 125), k('!!', 140, 125)], BOYUT);
    assert.equal(b[0].orijinal, 'CONTINUED !!');
  });
});

describe('cumleDuzeni', () => {
  it('büyük harfli metni cümle düzenine çevirir, "I" korunur', () => {
    assert.equal(cumleDuzeni("I DON'T KNOW. WHERE AM I? I'M LOST"), "I don't know. Where am I? I'm lost");
  });

  it('zaten karışık harfliyse dokunmaz', () => {
    assert.equal(cumleDuzeni('Hello there, NASA'), 'Hello there, NASA');
    assert.equal(cumleDuzeni('!?'), '!?');
  });
});
