import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kelimeBenzer, kelimeEslesir, ocrIleOturt, sadelestir } from '../src/ocr_oturtma.js';

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

  it('gevşek benzerlik: bölünmüş kelime parçası ve bozuk okuma, ama rastgele değil', () => {
    assert.equal(kelimeBenzer('ANCHE', 'AN'), true);
    assert.equal(kelimeBenzer('CREATO', 'TO'), true);
    assert.equal(kelimeBenzer('HANNO', 'H4NN0'), true);
    assert.equal(kelimeBenzer('HANNO', 'ZKWV'), false);
  });
});

describe('ocrIleOturt', () => {
  // Üç satırlık başlık: "THE TRUTH / ABOUT THE / "WORLD"!?"
  const kelimeler = [
    k('THE', 410, 700), k('TRUTH', 470, 700),
    k('ABOUT', 410, 740), k('THE', 500, 740),
    // Stilize yazı: doğru okunmuş ama güveni 0.
    k('"WORLD"!?', 410, 780, 0),
    // Güveni düşük kısa gürültü eşleşmemeli.
    k('THE', 410, 820, 10),
    // Uzakta, başka bir metinde de "THE" var; karışmamalı.
    k('THE', 60, 100), k('LAST', 110, 100),
  ];
  const ocr = { kelimeler, genislik: G, yukseklik: Y };

  it('modelin yalnızca ilk satırı kapsayan kutusu üç satırın tamamına genişler', () => {
    const [b] = ocrIleOturt([balon(400, 690, 560, 725, { orijinal: 'THE TRUTH ABOUT THE "WORLD"!?' })], ocr);
    assert.equal(b.ocrOturdu, true);
    assert.ok(b.y * Y < 700 && (b.y + b.h) * Y > 800 && (b.y + b.h) * Y < 830, JSON.stringify(b));
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

  it('eşleşmeyen kelime kaldıysa bitişik satırdaki bozuk okunmuş kelimeler de katılır; uzaktakiler katılmaz', () => {
    const ocr2 = {
      genislik: G,
      yukseklik: Y,
      kelimeler: [
        k('PROPRIO', 400, 300), // ilk satır bozuk okunmuş gibi değil, eşleşir
        k('PER', 400, 330), k('QUESTO', 450, 330),
        k('H4NN0', 400, 360, 5), k('CREA-', 480, 360, 5), // bozuk okunmuş satır
        k('XXQQ', 400, 500, 50), // uzakta, katılmamalı
        k('ZKWV', 400, 390, 40), // bitişik ama eksik kelimelere benzemiyor (çizim): katılmamalı
      ],
    };
    const [b] = ocrIleOturt([balon(380, 280, 520, 350, { orijinal: 'PROPRIO PER QUESTO, LE PERSONE HANNO CREATO' })], ocr2);
    assert.equal(b.ocrOturdu, true);
    const alt = (b.y + b.h) * Y;
    assert.ok(alt > 382 && alt < 400, JSON.stringify(b));
  });
});
