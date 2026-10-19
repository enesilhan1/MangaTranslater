// Yerel OCR'nin bulduğu kelimeleri konuşma balonlarına gruplar.
//
// Tesseract'ın kendi paragraf ayırması manga sayfalarında güvenilir değil:
// yan yana iki balonu tek satır sayabiliyor, çizimdeki çizgileri harf
// sanabiliyor. Bu yüzden OCR seyrek metin kipinde (PSM 11) kelime kelime
// çalıştırılır; burada gürültü ayıklanır ve birbirine yakın kelimeler
// birleştirilir: aynı satırda yan yana olanlar ya da alt alta ve yatayda
// çakışan satırlar aynı balondadır.

/**
 * @typedef {{metin: string, guven: number,
 *   kutu: {x0: number, y0: number, x1: number, y1: number}}} OcrKelimesi
 *   Piksel koordinatlı kelime (Tesseract'ın word nesnesinden).
 */

/** Tesseract'ın blok → paragraf → satır → kelime ağacını düz listeye çevirir. */
export function kelimeleriTopla(bloklar) {
  const kelimeler = [];
  for (const b of bloklar ?? []) {
    for (const p of b.paragraphs ?? []) {
      for (const s of p.lines ?? []) {
        for (const k of s.words ?? []) {
          kelimeler.push({ metin: k.text, guven: k.confidence, kutu: k.bbox });
        }
      }
    }
  }
  return kelimeler;
}

/** Bu güvenin altındaki kelimeler büyük olasılıkla çizimdir. */
const EN_AZ_KELIME_GUVENI = 50;
/** Balonun ortalama güveni bunun altındaysa tamamı atılır. */
const EN_AZ_BALON_GUVENI = 65;
/** Tek kelimelik, en çok 3 harfli balon için gereken güven. */
const EN_AZ_KISA_BALON_GUVENI = 85;

/**
 * @param {OcrKelimesi[]} kelimeler
 * @param {{genislik: number, yukseklik: number}} boyut  Resmin piksel boyutu.
 * @returns {{x: number, y: number, g: number, h: number, orijinal: string}[]}
 *   Resme oranla (0-1) kutular ve balonun metni, okuma sırasıyla.
 */
export function balonlaraGrupla(kelimeler, { genislik, yukseklik }) {
  const temiz = kelimeler
    .map((k) => ({ ...k, metin: String(k.metin ?? '').trim() }))
    .filter((k) => k.metin && k.guven >= EN_AZ_KELIME_GUVENI && anlamliMi(k.metin))
    .filter((k) => k.kutu.x1 > k.kutu.x0 && k.kutu.y1 > k.kutu.y0);

  const kumeler = kumele(temiz);
  const balonlar = [];
  for (const kume of kumeler) {
    const metin = satirlariBirlestir(kume);
    const harf = (metin.match(/\p{L}/gu) ?? []).length;
    const guven = kume.reduce((t, k) => t + k.guven, 0) / kume.length;
    if (harf < 2 || guven < EN_AZ_BALON_GUVENI) continue;
    // Tek başına kısa bir "kelime" çoğunlukla çizimden çıkan parçadır
    // (gerçek denemede çizgilerden "ne", "ASE" okundu); "NO!" gibi gerçek
    // kısa balonlar ise yüksek güvenle okunuyor.
    if (kume.length === 1 && harf <= 3 && guven < EN_AZ_KISA_BALON_GUVENI) continue;

    // Kutu çeviri yazısının sığması ve orijinali örtmesi için biraz büyütülür.
    const pay = ortalamaYukseklik(kume) * 0.35;
    const x0 = Math.max(0, Math.min(...kume.map((k) => k.kutu.x0)) - pay);
    const y0 = Math.max(0, Math.min(...kume.map((k) => k.kutu.y0)) - pay);
    const x1 = Math.min(genislik, Math.max(...kume.map((k) => k.kutu.x1)) + pay);
    const y1 = Math.min(yukseklik, Math.max(...kume.map((k) => k.kutu.y1)) + pay);
    balonlar.push({
      x: x0 / genislik,
      y: y0 / yukseklik,
      g: (x1 - x0) / genislik,
      h: (y1 - y0) / yukseklik,
      orijinal: metin,
    });
  }
  // Okuma sırası: yukarıdan aşağı, aynı hizadakiler soldan sağa.
  return balonlar.sort((a, b) => (Math.abs(a.y - b.y) < 0.02 ? a.x - b.x : a.y - b.y));
}

/** Harf/rakam içeren kelime ya da yalnızca noktalama (!?… gibi). */
function anlamliMi(metin) {
  return /[\p{L}\p{N}]/u.test(metin) || /^[!?.…,'"-]+$/.test(metin);
}

function ortalamaYukseklik(kelimeler) {
  return kelimeler.reduce((t, k) => t + (k.kutu.y1 - k.kutu.y0), 0) / kelimeler.length;
}

/** İki kelime aynı balonda mı? */
function komsuMu(a, b) {
  const h = Math.min(a.kutu.y1 - a.kutu.y0, b.kutu.y1 - b.kutu.y0);
  const H = Math.max(a.kutu.y1 - a.kutu.y0, b.kutu.y1 - b.kutu.y0);
  if (H > h * 2.2) return false; // çok farklı yazı boyutu: ayrı metinler
  const yatayBosluk = Math.max(0, Math.max(a.kutu.x0, b.kutu.x0) - Math.min(a.kutu.x1, b.kutu.x1));
  const dikeyBosluk = Math.max(0, Math.max(a.kutu.y0, b.kutu.y0) - Math.min(a.kutu.y1, b.kutu.y1));
  const dikeyCakisma = Math.min(a.kutu.y1, b.kutu.y1) - Math.max(a.kutu.y0, b.kutu.y0);

  // Aynı satır: dikeyde yarıdan çok çakışıyor, aradaki boşluk dar.
  if (dikeyCakisma > h * 0.5) return yatayBosluk < H * 1.2;
  // Alt alta satırlar: satır aralığı dar ve yatayda çakışıyor/çok yakın.
  return dikeyBosluk < H * 0.8 && yatayBosluk < H * 0.5;
}

/** Komşuluk ilişkisinin bağlı bileşenleri (birleşim-bul). */
function kumele(kelimeler) {
  const ata = kelimeler.map((_, i) => i);
  const bul = (i) => (ata[i] === i ? i : (ata[i] = bul(ata[i])));
  for (let i = 0; i < kelimeler.length; i++) {
    for (let j = i + 1; j < kelimeler.length; j++) {
      if (komsuMu(kelimeler[i], kelimeler[j])) ata[bul(i)] = bul(j);
    }
  }
  const gruplar = new Map();
  kelimeler.forEach((k, i) => {
    const kok = bul(i);
    if (!gruplar.has(kok)) gruplar.set(kok, []);
    gruplar.get(kok).push(k);
  });
  return [...gruplar.values()];
}

/** Kümedeki kelimeleri satırlara ayırıp okuma sırasıyla tek metin yapar. */
function satirlariBirlestir(kume) {
  const sirali = [...kume].sort((a, b) => a.kutu.y0 + a.kutu.y1 - (b.kutu.y0 + b.kutu.y1));
  const satirlar = [];
  for (const k of sirali) {
    const orta = (k.kutu.y0 + k.kutu.y1) / 2;
    const satir = satirlar.find((s) => orta > s.y0 && orta < s.y1);
    if (satir) {
      satir.kelimeler.push(k);
      satir.y0 = Math.min(satir.y0, k.kutu.y0);
      satir.y1 = Math.max(satir.y1, k.kutu.y1);
    } else {
      satirlar.push({ y0: k.kutu.y0, y1: k.kutu.y1, kelimeler: [k] });
    }
  }
  satirlar.sort((a, b) => a.y0 - b.y0);

  let metin = '';
  for (const s of satirlar) {
    const satirMetni = s.kelimeler
      .sort((a, b) => a.kutu.x0 - b.kutu.x0)
      .map((k) => k.metin)
      .join(' ');
    // Satır sonunda tireyle bölünmüş kelime: "CONTIN-" + "UED" → "CONTINUED".
    if (/\p{L}-$/u.test(metin) && /^\p{L}/u.test(satirMetni)) metin = metin.slice(0, -1) + satirMetni;
    else metin = metin ? `${metin} ${satirMetni}` : satirMetni;
  }
  return metin;
}

/**
 * Mangada yazılar çoğunlukla BÜYÜK HARF; çeviri servisleri büyük harfli
 * metni (özellikle özel isim sanarak) daha kötü çeviriyor. Harflerin çoğu
 * büyükse cümle düzenine çevrilir; İngilizcedeki "I" korunur.
 */
export function cumleDuzeni(metin) {
  const harfler = metin.match(/\p{L}/gu) ?? [];
  const buyuk = harfler.filter((h) => h !== h.toLowerCase()).length;
  if (harfler.length < 2 || buyuk / harfler.length < 0.8) return metin;
  return metin
    .toLowerCase()
    .replace(/(^|[.!?…]\s+)(\p{L})/gu, (_, on, h) => on + h.toUpperCase())
    .replace(/\bi\b/g, 'I');
}
