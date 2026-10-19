import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HEDEF_GENISLIK, dilimleriPlanla, satirSkoru } from '../src/dilimleme.js';

describe('dilimleriPlanla', () => {
  it('normal sayfa tek parça; genişse küçültülür, darsa büyütülmez', () => {
    assert.deepEqual(dilimleriPlanla(800, 1200), { olcek: 1, dilimler: [{ y0: 0, y1: 1200 }] });
    const genis = dilimleriPlanla(2800, 4000);
    assert.equal(genis.olcek, HEDEF_GENISLIK / 2800);
    assert.equal(genis.dilimler.length, 1);
  });

  it('webtoon şeridini uç uca, örtüşmesiz, ~1:1,5 dilimlere böler', () => {
    const { dilimler } = dilimleriPlanla(800, 10000);
    assert.equal(dilimler[0].y0, 0);
    assert.equal(dilimler.at(-1).y1, 10000);
    for (let i = 1; i < dilimler.length; i++) assert.equal(dilimler[i].y0, dilimler[i - 1].y1);
    for (const d of dilimler.slice(0, -1)) assert.equal(d.y1 - d.y0, 1200);
    // Son dilim çok kısa kalmaz (hedefin yarısından uzun, 1,5 katından kısa).
    const son = dilimler.at(-1).y1 - dilimler.at(-1).y0;
    assert.ok(son >= 600 && son <= 1800, String(son));
  });

  it('kesimi hedef çevresindeki en tek düze satırdan yapar', () => {
    // 4000 px yükseklik, satır başına bir skor; 1100. satır panel boşluğu.
    const skorlar = Array.from({ length: 4000 }, (_, y) => (y === 1100 ? 0 : 50));
    const { dilimler } = dilimleriPlanla(800, 4000, skorlar);
    assert.equal(dilimler[0].y1, 1100);
    // Pencere dışındaki boşluk (ör. 500. satır) seçilmez.
    const uzak = Array.from({ length: 4000 }, (_, y) => (y === 500 ? 0 : 50));
    assert.equal(dilimleriPlanla(800, 4000, uzak).dilimler[0].y1, 1200);
  });

  it('seyrek örneklenmiş skorlarla da çalışır', () => {
    // 400 örnek → her biri 10 px; 130. örnek = 1300. satır.
    const skorlar = Array.from({ length: 400 }, (_, i) => (i === 130 ? 1 : 9));
    assert.equal(dilimleriPlanla(800, 4000, skorlar).dilimler[0].y1, 1300);
  });
});

describe('satirSkoru', () => {
  it('tek renk satırda 0, siyah-beyaz çizgide yüksek', () => {
    const beyaz = new Uint8ClampedArray(40).fill(255);
    assert.equal(satirSkoru(beyaz), 0);
    const cizgili = new Uint8ClampedArray(40);
    for (let i = 0; i < 40; i += 8) cizgili.fill(255, i, i + 4);
    assert.ok(satirSkoru(cizgili) > 100);
  });
});
