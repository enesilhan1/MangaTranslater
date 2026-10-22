import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { atlananaUyar, atlananYazilar, kelimeBenzer, kelimeEslesir, ocrIleOturt, sadelestir } from '../src/ocr_oturtma.js';

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
    // 7+ harfte iki harf hatası (eğik çerçeveli yazı); kısa kelimede iki hata kabul edilmez.
    assert.equal(kelimeEslesir('DAVVERO', 'PAVWERO'), true);
    assert.equal(kelimeEslesir('MOLTO', 'MASTO'), false);
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

  it('numaralı kayıt, Japonca ses efekti, yeterince eşleşmeyen metin değişmez', () => {
    const numarali = balon(400, 690, 560, 725, { orijinal: 'THE TRUTH', bolge: 3 });
    // Japonca ses efekti: İngilizce OCR okuyamaz, aranmaz.
    const ses = balon(400, 690, 560, 725, { orijinal: 'ガシャ', tur: 'ses' });
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

  it('model kutuyu başka yere koyduysa sayfadaki tek kesin eşleşmeye gider; numaralı balondaki ve belirsiz eşleşme sayılmaz', () => {
    // Kullanıcının sayfası: "È ALICE!" kutusu üstteki balonun "ALICE?!" satırında.
    const kelimeler = [k('ICE?!', 450, 100), k('ALICE!', 420, 600, 36), k('FATTO', 100, 300)];
    const tahmin = () => balon(440, 95, 520, 125, { orijinal: 'È ALICE!' });
    const [b] = ocrIleOturt([tahmin()], { kelimeler, genislik: G, yukseklik: Y });
    assert.equal(b.ocrOturdu, true);
    assert.ok(b.y * Y > 590, JSON.stringify(b));
    // İkinci bir "ALICE" daha varsa hangisi olduğu belli değil: değişmez.
    const iki = [...kelimeler, k('ALICE', 100, 450)];
    assert.notEqual(ocrIleOturt([tahmin()], { kelimeler: iki, genislik: G, yukseklik: Y })[0].ocrOturdu, true);
    // Öbür "ALICE" numaralı bir balonun içindeyse sayılmaz.
    const isaretli = [{ x0: 80 / G, y0: 430 / Y, x1: 200 / G, y1: 480 / Y }];
    const [c] = ocrIleOturt([tahmin()], { kelimeler: iki, genislik: G, yukseklik: Y }, { isaretli });
    assert.ok(c.ocrOturdu && c.y * Y > 590, JSON.stringify(c));
  });

  it('Latin harfli ses efekti bozuk okunsa da yazısının yanına taşınır; sayfada iki aday varsa taşınmaz', () => {
    // Kullanıcının sayfası: "AAAHH!" OCR'de "PARHH"; modelin kutusu 270 px aşağıda.
    const kelimeler = [k('PARHH', 300, 200, 40), k('FATTO', 100, 600)];
    const sfx = () => balon(290, 600, 360, 630, { orijinal: 'AAAHH!', tur: 'ses' });
    const [b] = ocrIleOturt([sfx()], { kelimeler, genislik: G, yukseklik: Y });
    assert.equal(b.ocrOturdu, true);
    assert.equal(b.tur, 'ses');
    assert.ok(b.y * Y < 210, JSON.stringify(b));
    const iki = [...kelimeler, k('AAHHH', 100, 300)];
    assert.notEqual(ocrIleOturt([sfx()], { kelimeler: iki, genislik: G, yukseklik: Y })[0].ocrOturdu, true);
  });

  it('model iki yazıyı tek metin döndürdüyse yakındaki ikinci küme de kutuya katılır', () => {
    // "ATTENZIONE!" ile altındaki "RADUNATEVI TUTTI NELLA PIAZZA CENTRALE!".
    const kelimeler = [
      k('ATTEN-', 200, 400), k('RADUNATEVI', 60, 510), k('TUTTI', 60, 547), k('NELLA', 130, 547), k('PIAZZA', 90, 584), k('CENTRALE!', 70, 621),
      k('LONTANO', 400, 800), // uzakta, metinde yok
    ];
    const [b] = ocrIleOturt([balon(50, 500, 200, 640, { orijinal: 'ATTENZIONE! RADUNATEVI TUTTI NELLA PIAZZA CENTRALE!' })], { kelimeler, genislik: G, yukseklik: Y });
    assert.equal(b.ocrOturdu, true);
    assert.ok(b.y * Y < 405 && (b.y + b.h) * Y > 640 && (b.y + b.h) * Y < 700, JSON.stringify(b));
  });

  it('yan sütundaki yazının ortak kısa kelimesi kümeye katılmaz (arası dar iki anlatım)', () => {
    // Kullanıcının sayfası: "NEGLI ULTIMI…MA IL NEMICO…" ile sağında "CAPISCO… MA...".
    const kelimeler = [
      k('NEGLI', 100, 100), k('ULTIMI', 184, 100), k('GIORNI', 100, 130), k('HO', 198, 130),
      k('PROVATO', 100, 160), k('MA', 100, 190), k('IL', 142, 190), k('NEMICO', 100, 220),
      k('CAPISCO', 306, 100), k('MA...', 306, 130),
    ];
    const [sol, sag] = ocrIleOturt([
      balon(90, 90, 280, 250, { orijinal: 'NEGLI ULTIMI GIORNI HO PROVATO MA IL NEMICO' }),
      balon(300, 90, 415, 160, { orijinal: 'CAPISCO MA...' }),
    ], { kelimeler, genislik: G, yukseklik: Y });
    assert.ok(sol.ocrOturdu && (sol.x + sol.g) * G < 306, JSON.stringify(sol));
    assert.ok(sag.ocrOturdu && (sag.y + sag.h) * Y > 152, JSON.stringify(sag));
  });

  it('bozuk okunan satırlar atlanınca ortalı yazının uzak satır uçları yine aynı kümede', () => {
    // Kullanıcının sayfası: "QUELLI DELLA RESI-STENZA PEN-SERANNO CHE…";
    // yalnızca 2., 4., 6. ve 7. satırlardan birer kelime eşleşiyor.
    const kelimeler = [k('DELLA', 100, 100), k('CHE', 220, 162), k('PLICEMENTE', 110, 224), k('SCAPPATI.', 120, 256)];
    const [b] = ocrIleOturt([balon(90, 90, 270, 290, { orijinal: 'QUELLI DELLA RESISTENZA PENSERANNO CHE SIANO SEMPLICEMENTE SCAPPATI.' })], { kelimeler, genislik: G, yukseklik: Y });
    assert.equal(b.ocrOturdu, true, JSON.stringify(b));
    assert.ok(b.y * Y < 100 && (b.y + b.h) * Y > 278, JSON.stringify(b));
  });

  it('kısa kelimeleri okunmayan altyazı uzun kelimelerin harf oranıyla bulunur; okunmayan ilk/son satırları da örtülür', () => {
    // "BUT THE / SITUATION / WOULDN'T / EVEN ALLOW / HER TO DO / THAT...";
    // yalnızca SITUATION, EVEN, ALLOW okunuyor. Model kutuyu başka panele koymuş.
    const kelimeler = [k('SITUATION', 100, 330), k('EVEN', 107, 382), k('ALLOW', 177, 382)];
    const [b] = ocrIleOturt([balon(300, 700, 450, 780, { orijinal: "BUT THE SITUATION WOULDN'T EVEN ALLOW HER TO DO THAT..." })], { kelimeler, genislik: G, yukseklik: Y });
    assert.equal(b.ocrOturdu, true, JSON.stringify(b));
    // Satırlar 26 px arayla: üstte 1 ("BUT THE"), altta 2 satır okunmadı.
    assert.ok(b.y * Y <= 304 && (b.y + b.h) * Y >= 456, JSON.stringify([b.y * Y, (b.y + b.h) * Y]));
    assert.ok(b.y * Y > 270 && (b.y + b.h) * Y < 500, JSON.stringify([b.y * Y, (b.y + b.h) * Y]));
  });

  it('okunmayan kısa baş kelime ("Va bene così?" içinde "Va") kutuyu üst satıra uzatmaz', () => {
    const kelimeler = [k('BENE', 120, 300), k('COSI?', 110, 326)];
    const [b] = ocrIleOturt([balon(100, 290, 200, 360, { orijinal: 'VA BENE COSI?' })], { kelimeler, genislik: G, yukseklik: Y });
    assert.ok(b.ocrOturdu && b.y * Y > 290, JSON.stringify(b));
  });

  it('aynı satırda okunmayan tek harfli kelimenin iki yanı aynı kümede; satırın uçları arası geniş olsa da', () => {
    // Çadır listesi: "…Takako, Merry / Kururu, Tina, Yuuki o Merry"; "o"
    // eşlemeye girmiyor, "MERRY" üst satırda zaten eşleştiği için sonradan
    // da katılmaz.
    const kelimeler = [
      k('TAKAKO,', 100, 100), k('MERRY', 210, 100),
      k('KURURU,', 100, 135), k('TINA,', 210, 135), k('YUUKI', 290, 135), k('MERRY', 390, 135),
    ];
    const [b] = ocrIleOturt([balon(90, 90, 470, 165, { orijinal: 'TAKAKO, MERRY KURURU, TINA, YUUKI O MERRY' })], { kelimeler, genislik: G, yukseklik: Y });
    assert.ok(b.ocrOturdu && (b.x + b.g) * G > 460, JSON.stringify(b));
  });

  it('sayfa genelinde kısa kelimeler de sayılır ama en az iki uzun kelime gerekir', () => {
    // Kullanıcının sayfası: "...HO UNA COSA DI CUI VI DEVO PARLARE."; uzaktaki model kutusu.
    const metin = '...HO UNA COSA DI CUI VI DEVO PARLARE.';
    const kelimeler = [k('UNA', 100, 400), k('cosa', 90, 430, 22), k('cUl', 80, 460), k('DEVO', 130, 460), k('PARPLARE.', 90, 490, 43)];
    const [b] = ocrIleOturt([balon(400, 700, 480, 760, { orijinal: metin })], { kelimeler, genislik: G, yukseklik: Y });
    assert.equal(b.ocrOturdu, true);
    assert.ok(b.x * G < 100 && b.y * Y < 405, JSON.stringify(b));
    // Yalnızca kısa kelimeler eşleşiyorsa (uzunlar okunamadı) taşınmaz.
    const kisa = [k('UNA', 100, 400), k('DI', 150, 400), k('CUI', 80, 430), k('VI', 130, 430)];
    assert.notEqual(ocrIleOturt([balon(400, 700, 480, 760, { orijinal: metin })], { kelimeler: kisa, genislik: G, yukseklik: Y })[0].ocrOturdu, true);
  });

  it('sayfa genelinde: arada bozuk okunmuş satır olsa da metnin satırları bir arada bulunur', () => {
    // Kullanıcının sayfası: "NON RIESCO A RICOR-DARLO MOLTO BENE, MA..."; "DARLO" satırı "LARLO" okundu.
    const kelimeler = [
      k('NON', 430, 390), k('RIESCO', 420, 430), k('LARLO', 420, 470), k('MOLTO', 420, 510), k('BENE,', 425, 550),
      k('PERCHE', 100, 700),
    ];
    const [b] = ocrIleOturt([balon(250, 650, 330, 700, { orijinal: 'NON RIESCO A RICORDARLO MOLTO BENE, MA...' })], { kelimeler, genislik: G, yukseklik: Y });
    assert.equal(b.ocrOturdu, true);
    assert.ok(b.x * G > 400 && b.y * Y < 435 && (b.y + b.h) * Y > 565, JSON.stringify(b));
  });
});

describe('atlananYazilar', () => {
  // Kullanıcının sayfası: model "SPRIZZANO VOGLIA DI UCCIDERCI DA TUTTI I PORI." yazısını döndürmedi.
  const kelimeler = [
    k('SPRIZZANO', 100, 500), k('VOGLIA', 110, 530), k('DI', 210, 530), k('UCCIDERCI', 100, 560), k('DA', 110, 590), k('TUTTI', 150, 590),
    // Çeviri verilmiş yazı (kutusu içinde): sayılmaz.
    k('NO,', 400, 500), k('KUU-', 400, 530), k('CHAN...', 400, 560),
    // Modelin okuduğu ama kutusu kaymış yazı: sayılmaz.
    k('ECCO', 300, 100), k('PERCHE', 300, 130), k('ANCORA', 300, 160),
    // Güveni düşük çizim gürültüsü: sayılmaz.
    k('Zrkq', 500, 800, 20), k('Mvxp', 500, 830, 20), k('Ttbn', 500, 860, 20),
    // Numaralı balonun içindeki yazı: sayılmaz.
    k('QUESTA', 50, 50), k('VOLTA', 50, 80), k('FORSE', 50, 110),
  ];
  const ocr = { kelimeler, genislik: G, yukseklik: Y };
  const balonlar = [
    balon(390, 490, 520, 590, { orijinal: 'NO, KUU-CHAN...' }),
    balon(450, 300, 550, 350, { orijinal: 'ECCO PERCHÉ ANCORA' }),
  ];
  const isaretli = [{ x0: 40 / G, y0: 40 / Y, x1: 160 / G, y1: 140 / Y }];

  it('hiçbir çevirinin örtmediği güvenilir kelime kümesini bulur, öbürlerini saymaz', () => {
    const a = atlananYazilar(balonlar, ocr, { isaretli });
    assert.equal(a.length, 1, JSON.stringify(a));
    assert.ok(a[0].kelimeler.includes('SPRIZZANO'));
    const [ymin, xmin, ymax, xmax] = a[0].kutu;
    assert.ok(xmin <= (100 / G) * 1000 + 1 && ymin <= (500 / Y) * 1000 + 1 && xmax > (200 / G) * 1000 && ymax > (590 / Y) * 1000, JSON.stringify(a[0].kutu));
  });

  it('ikinci yanıttaki metnin atlanan yazıya ait olduğunu tanır', () => {
    const [a] = atlananYazilar(balonlar, ocr, { isaretli });
    assert.equal(atlananaUyar(a, 'SPRIZZANO VOGLIA DI UCCIDERCI DA TUTTI I PORI.'), true);
    assert.equal(atlananaUyar(a, 'NO, KUU-CHAN...'), false);
  });
});
