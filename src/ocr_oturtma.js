// Balonsuz metinleri (çizimin üstüne yazılmış başlık/anlatım) yerel OCR
// ile tam yerine oturtma.
//
// Balonlu metinler piksellerden bulunan balonlara bağlanıyor
// (src/kutu_oturtma.js), ama balonsuz metinlerde bulunacak bir balon yok ve
// modelin kutusuna kalınıyordu. Kullanıcının sayfasında Claude Haiku'nun
// kutusu üç satırlık bir başlığın yalnızca ilk satırını kapsadı. Tesseract
// İngilizce yazının harflerini piksel piksel buluyor: modelin okuduğu
// orijinal metnin kelimeleri OCR kelimeleriyle eşlenir ve kutu tam o
// kelimelerin üstüne taşınır. Saf hesaplama (OCR'yi çağıran arka plan).

/**
 * Bu güvenin altındaki kısa (≤3 harf) OCR kelimeleri eşlemeye alınmaz.
 * Uzun kelimelerde güvene bakılmaz: kelime zaten modelin okuduğu metinle
 * karşılaştırılıyor, ve stilize başlık yazılarında Tesseract kelimeyi doğru
 * okusa da güveni 0 verebiliyor (kullanıcının sayfasında "WORLD" böyleydi).
 */
const EN_AZ_GUVEN = 30;
/** Eksik satır için kümenin üstüne/altına en çok bu kadar satır eklenir. */
const SATIR_EKLEME = 2;
/** Bu oranda kelime eşleşmezse kutu değiştirilmez. */
const EN_AZ_ESLESME = 0.4;

/** Karşılaştırma için: yalnızca harf ve rakam, büyük harf. */
export function sadelestir(metin) {
  return String(metin ?? '').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** İki kelime aynı mı (OCR'nin tek harf hatasına ve birleşik yazıma pay). */
export function kelimeEslesir(a, b) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4) {
    if (a.includes(b) || b.includes(a)) return true;
    if (Math.abs(a.length - b.length) <= 1 && duzenlemeUzakligi(a, b) <= 1) return true;
  }
  return false;
}

/**
 * Gevşek benzerlik: bölünmüş kelimenin parçası (AN- / CHE → ANCHE) ya da
 * harflerinin çoğu tutan bozuk okuma. Yalnızca eksik satır ararken.
 */
export function kelimeBenzer(eksik, okunan) {
  if (okunan.length < 2) return false;
  if (kelimeEslesir(eksik, okunan)) return true;
  if (okunan.length >= 2 && (eksik.startsWith(okunan) || eksik.endsWith(okunan))) return true;
  const uzun = Math.max(eksik.length, okunan.length);
  return uzun >= 4 && duzenlemeUzakligi(eksik, okunan) <= Math.floor(0.4 * uzun);
}

function duzenlemeUzakligi(a, b) {
  const onceki = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let solUst = onceki[0];
    onceki[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const ust = onceki[j];
      onceki[j] = Math.min(onceki[j] + 1, onceki[j - 1] + 1, solUst + (a[i - 1] === b[j - 1] ? 0 : 1));
      solUst = ust;
    }
  }
  return onceki[b.length];
}

/** Bu kayıt OCR ile oturtulmalı mı: işaret numarası yok ve ses efekti değil. */
export const ocrGerekirMi = (b) => !b.bolge && b.tur !== 'ses';

/**
 * @param {import('./yz/cozumle.js').Balon[]} balonlar  0-1 oranlı.
 * @param {{kelimeler: import('./yerel/gruplama.js').OcrKelimesi[],
 *   genislik: number, yukseklik: number}} ocr  OCR sonucu (piksel kutular).
 * @returns {import('./yz/cozumle.js').Balon[]}  OCR ile oturanlar ocrOturdu: true.
 */
export function ocrIleOturt(balonlar, { kelimeler, genislik: G, yukseklik: Y }) {
  const hepsi = kelimeler.map((k) => ({ ...k, sade: sadelestir(k.metin) }));
  const sozluk = kelimeler
    .map((k) => ({ ...k, sade: sadelestir(k.metin) }))
    .filter((k) => k.sade.length >= 4 || (k.sade.length >= 2 && k.guven >= EN_AZ_GUVEN));
  const kullanildi = new Set();

  return balonlar.map((b) => {
    if (!ocrGerekirMi(b)) return b;
    const kelimelerB = String(b.orijinal).split(/\s+/).map(sadelestir).filter((t) => t.length >= 2);
    if (!kelimelerB.length) return b;

    // Arama alanı: modelin kutusu, her yandan kendi boyu (ve resmin %15'i)
    // kadar genişletilmiş; kutu kayık olabilir.
    const t = { x0: b.x * G, y0: b.y * Y, x1: (b.x + b.g) * G, y1: (b.y + b.h) * Y };
    const pay = Math.max(t.x1 - t.x0, t.y1 - t.y0, 0.15 * G);
    const alan = { x0: t.x0 - pay, y0: t.y0 - pay, x1: t.x1 + pay, y1: t.y1 + pay };
    const eslesen = [];
    sozluk.forEach((k, i) => {
      if (kullanildi.has(i)) return;
      const cx = (k.kutu.x0 + k.kutu.x1) / 2;
      const cy = (k.kutu.y0 + k.kutu.y1) / 2;
      if (cx < alan.x0 || cx > alan.x1 || cy < alan.y0 || cy > alan.y1) return;
      if (kelimelerB.some((tk) => kelimeEslesir(tk, k.sade))) eslesen.push(i);
    });
    if (!eslesen.length) return b;

    // Eşleşen kelimelerin en kalabalık yakın kümesi (aynı metnin satırları).
    const kume = enKalabalikKume(eslesen.map((i) => sozluk[i]), eslesen);
    if (kume.length < Math.max(1, Math.ceil(EN_AZ_ESLESME * kelimelerB.length))) return b;
    for (const i of kume) kullanildi.add(i);

    const kutular = kume.map((i) => sozluk[i].kutu);
    const boylar = kutular.map((k) => k.y1 - k.y0).sort((a, c) => a - c);
    const boy = boylar[boylar.length >> 1];
    // Modelin metninde eşleşmemiş kelime kaldıysa (italik, satır sonunda
    // bölünmüş kelime, OCR'nin bozuk okuduğu satır) kümenin hemen
    // üstündeki/altındaki satırlarda aynı boyda ve aynı sütunda duran OCR
    // kelimeleri de katılır. Kullanıcının İtalyanca sayfasında üç anlatımın
    // ilk ya da son satırı böyle açıkta kalıyordu.
    // Modelin metninde hiçbir OCR kelimesine eşlenmemiş kelimeler.
    const eslesenler = kume.map((i) => sozluk[i].sade);
    const eksikler = kelimelerB.filter((tk) => !eslesenler.some((w) => kelimeEslesir(tk, w)));
    if (eksikler.length) {
      const sinir = () => ({
        x0: Math.min(...kutular.map((k) => k.x0)), x1: Math.max(...kutular.map((k) => k.x1)),
        y0: Math.min(...kutular.map((k) => k.y0)), y1: Math.max(...kutular.map((k) => k.y1)),
      });
      for (let tur = 0; tur < SATIR_EKLEME; tur++) {
        const s0 = sinir();
        const bitisik = hepsi.filter((w) => {
          if (kutular.includes(w.kutu) || !w.sade) return false;
          const h = w.kutu.y1 - w.kutu.y0;
          if (h < 0.6 * boy || h > 1.6 * boy) return false;
          const cx = (w.kutu.x0 + w.kutu.x1) / 2;
          if (cx < s0.x0 - boy || cx > s0.x1 + boy) return false;
          const ustte = w.kutu.y1 <= s0.y0 + 0.3 * boy && w.kutu.y1 >= s0.y0 - 1.3 * boy;
          const altta = w.kutu.y0 >= s0.y1 - 0.3 * boy && w.kutu.y0 <= s0.y1 + 1.3 * boy;
          return ustte || altta;
        });
        // Satırlara ayır; yalnızca eksik bir kelimeye benzeyen bir şey içeren
        // satır eklenir (çizimden çıkan rastgele "kelimeler" eklenmesin).
        const satirlar = [];
        for (const w of bitisik) {
          const cy = (w.kutu.y0 + w.kutu.y1) / 2;
          const satir = satirlar.find((st) => Math.abs(st.cy - cy) < 0.5 * boy);
          if (satir) satir.kelimeler.push(w);
          else satirlar.push({ cy, kelimeler: [w] });
        }
        const ek = satirlar
          .filter((st) => st.kelimeler.some((w) => eksikler.some((tk) => kelimeBenzer(tk, w.sade))))
          .flatMap((st) => st.kelimeler);
        if (!ek.length) break;
        kutular.push(...ek.map((w) => w.kutu));
      }
    }
    const p = 0.3 * boy;
    const x0 = Math.max(0, Math.min(...kutular.map((k) => k.x0)) - p);
    const y0 = Math.max(0, Math.min(...kutular.map((k) => k.y0)) - p);
    const x1 = Math.min(G, Math.max(...kutular.map((k) => k.x1)) + p);
    const y1 = Math.min(Y, Math.max(...kutular.map((k) => k.y1)) + p);
    return { ...b, x: x0 / G, y: y0 / Y, g: (x1 - x0) / G, h: (y1 - y0) / Y, ocrOturdu: true };
  });
}

/**
 * Kelimeleri yakınlığa göre kümeler (aralarındaki boşluk iki kelime boyunu
 * geçmeyenler aynı kümede) ve en kalabalık kümenin sıra numaralarını döndürür.
 */
function enKalabalikKume(kelimeler, numaralar) {
  const ata = kelimeler.map((_, i) => i);
  const bul = (i) => (ata[i] === i ? i : (ata[i] = bul(ata[i])));
  for (let i = 0; i < kelimeler.length; i++) {
    for (let j = i + 1; j < kelimeler.length; j++) {
      const a = kelimeler[i].kutu;
      const c = kelimeler[j].kutu;
      const boy = 2 * Math.max(a.y1 - a.y0, c.y1 - c.y0);
      if (a.x0 - boy <= c.x1 && c.x0 - boy <= a.x1 && a.y0 - boy <= c.y1 && c.y0 - boy <= a.y1) ata[bul(i)] = bul(j);
    }
  }
  const gruplar = new Map();
  kelimeler.forEach((_, i) => {
    const k = bul(i);
    gruplar.set(k, [...(gruplar.get(k) ?? []), numaralar[i]]);
  });
  return [...gruplar.values()].sort((a, b) => b.length - a.length)[0];
}
