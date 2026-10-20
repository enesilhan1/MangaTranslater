import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kelimeEslesir, ocrIleOturt, sadelestir } from '../src/ocr_oturtma.js';

const G = 600;
const Y = 900;
/** OCR kelimesi: sol üst (x, y), 22 px yüksek, harf başına 14 px. */
const k = (metin, x, y, guven = 85) => ({ metin, guven, kutu: { x0: x, y0: y, x1: x + metin.length * 14, y1: y + 22 } });
const balon = (x0, y0, x1, y1, ek = {}) => ({
  x: x0 / G, y: y0 / Y, g: (x1 - x0) / G, h: (y1 - y0) / Y, tur: 'anlatim', bolge: 0, orijinal: '', ceviri: 'çeviri', ...ek,
});

describe('kelime eşleme', () => {
  it('büyük/küçük harf ve noktalama yok sayılır, uzun kelimede tek harf hatası kabul', () => {
    assert.equal(sadelestir('"WORLD"!?'), 'WORLD');
    assert.equal(kelimeEslesir('TRUTH', 'TRUTH'), true);
    assert.equal(kelimeEslesir('WORLD', 'W0RLD'), true);
    assert.equal(kelimeEslesir('ABOUT', 'ABOUTTHE'), true);
    assert.equal(kelimeEslesir('THE', 'TNE'), false); // kısa kelimede hata kabul edilmez
    assert.equal(kelimeEslesir('TRUTH', 'WORLD'), false);
  });
});

describe('ocrIleOturt', () => {
  // Üç satırlık başlık: "THE TRUTH / ABOUT THE / "WORLD"!?"
  const kelimeler = [
    k('THE', 410, 700), k('TRUTH', 470, 700),
    k('ABOUT', 410, 740), k('THE', 500, 740),
    k('"WORLD"!?', 410, 780),
    // Uzakta, başka bir metinde de "THE" var; karışmamalı.
    k('THE', 60, 100), k('LAST', 110, 100),
  ];
  const ocr = { kelimeler, genislik: G, yukseklik: Y };

  it('modelin yalnızca ilk satırı kapsayan kutusu üç satırın tamamına genişler', () => {
    const [b] = ocrIleOturt([balon(400, 690, 560, 725, { orijinal: 'THE TRUTH ABOUT THE "WORLD"!?' })], ocr);
    assert.equal(b.ocrOturdu, true);
    assert.ok(b.y * Y < 700 && (b.y + b.h) * Y > 800, JSON.stringify(b));
    assert.ok(b.x * G < 410 && (b.x + b.g) * G > 540);
  });

  it('kayık kutu da (yakınındaki) doğru metne gider; uzaktaki aynı kelime karışmaz', () => {
    const [b] = ocrIleOturt([balon(300, 600, 420, 650, { orijinal: 'THE TRUTH ABOUT THE "WORLD"!?' })], ocr);
    assert.equal(b.ocrOturdu, true);
    assert.ok(b.x * G > 380, JSON.stringify(b));
  });

  it('numaralı kayıt, ses efekti, yeterince eşleşmeyen metin değişmez', () => {
    const numarali = balon(400, 690, 560, 725, { orijinal: 'THE TRUTH', bolge: 3 });
    const ses = balon(400, 690, 560, 725, { orijinal: 'THE TRUTH', tur: 'ses' });
    const yabanci = balon(400, 690, 560, 725, { orijinal: 'SOMETHING COMPLETELY DIFFERENT HERE NOW' });
    assert.deepEqual(ocrIleOturt([numarali, ses, yabanci], ocr), [numarali, ses, yabanci]);
  });

  it('bir OCR kelimesi iki metne birden verilmez', () => {
    const s = ocrIleOturt([
      balon(400, 690, 560, 725, { orijinal: 'THE TRUTH ABOUT THE "WORLD"!?' }),
      balon(400, 690, 560, 725, { orijinal: 'THE TRUTH' }),
    ], ocr);
    assert.equal(s[0].ocrOturdu, true);
    assert.notEqual(s[1].ocrOturdu, true);
  });
});
