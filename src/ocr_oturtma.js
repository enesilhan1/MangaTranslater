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
/** Bu uzunlukta (ve üstü) kelimelerde OCR'nin iki harf hatası kabul edilir. */
const UZUN_KELIME = 7;
/**
 * Eşleme kurallarının sürümü: önbellekteki kayıtlar daha eski sürümle
 * denenmişse bir kez daha denenir (true = 1).
 */
export const OCR_SURUMU = 7;
/** Model kutusundan uzakta bu uzunlukta (ve üstü) kelimeler "uzun" sayılır. */
const UZAK_KELIME = 4;
/**
 * Atlanmış yazı sayılacak OCR kümesi: en az bu kadar kelime, her biri en
 * az ATLANAN_EN_KISA harf ve ATLANAN_GUVEN güvenle (çizimden çıkan rastgele
 * "kelimeler" sayılmasın; boşuna ikinci istek gitmesin).
 */
const ATLANAN_EN_AZ_KELIME = 3;
const ATLANAN_EN_KISA = 2;
const ATLANAN_GUVEN = 70;
/** Ses efektinde OCR ile aranacak en kısa Latin harf dizisi. */
const SES_EN_AZ_HARF = 3;
/** Uzaktaki kümede en az bu kadar uzun kelime (metinde o kadar varsa). */
const UZAK_EN_AZ_UZUN = 2;
/** Sayfa genelindeki aramada eşleşen kelimeler arası en çok boşluk (kelime boyu cinsinden). */
const UZAK_ARALIK = 4;

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
  // Uzun kelimede iki harf hatası (kullanıcının sayfasında eğik, bulanık
  // çerçeveli "DAVVERO?" → "PAVWERO?"); bu uzunlukta iki harfi farklı iki
  // gerçek kelime nadir.
  if (a.length >= UZUN_KELIME && b.length >= UZUN_KELIME && Math.abs(a.length - b.length) <= 2 && duzenlemeUzakligi(a, b) <= 2) return true;
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
 * Latin harfli ses efekti mi ("AAAHH!", "BOOM")? İngilizce OCR yalnızca
 * bunları okuyabilir; Japonca efektler (ザ, ガシャ) modelin kutusunda kalır.
 */
export const latinSesMi = (b) => b.tur === 'ses' && (String(b.orijinal).match(/[A-Za-z]/g) ?? []).length >= SES_EN_AZ_HARF;

/**
 * Ses efekti için gevşek benzerlik: harfleri uzatılmış, süslü yazıyı OCR
 * bozuk okuyor (kullanıcının sayfasında "AAAHH!" → "PARHH"). Uzunluklar
 * yakın ve harflerin en çok %40'ı farklı.
 */
export function sesBenzer(a, b) {
  if (a.length < SES_EN_AZ_HARF || b.length < SES_EN_AZ_HARF || Math.abs(a.length - b.length) > 2) return false;
  return duzenlemeUzakligi(a, b) <= Math.floor(0.4 * Math.max(a.length, b.length));
}

/**
 * @param {import('./yz/cozumle.js').Balon[]} balonlar  0-1 oranlı.
 * @param {{kelimeler: import('./yerel/gruplama.js').OcrKelimesi[],
 *   genislik: number, yukseklik: number}} ocr  OCR sonucu (piksel kutular).
 * @param {{isaretli?: {x0: number, y0: number, x1: number, y1: number}[]}} [ek]
 *   Numaralı balonların alanları (0-1): sayfa genelindeki aramada bunların
 *   içindeki kelimeler sayılmaz (o yazılar zaten kendi balonlarında).
 * @returns {import('./yz/cozumle.js').Balon[]}  OCR ile oturanlar ocrOturdu: true.
 */
export function ocrIleOturt(balonlar, { kelimeler, genislik: G, yukseklik: Y }, { isaretli = [] } = {}) {
  const isaretliMi = (cx, cy) => isaretli.some((k) => cx >= k.x0 * G && cx <= k.x1 * G && cy >= k.y0 * Y && cy <= k.y1 * Y);
  const hepsi = kelimeler.map((k) => ({ ...k, sade: sadelestir(k.metin) }));
  const sozluk = kelimeler
    .map((k) => ({ ...k, sade: sadelestir(k.metin) }))
    .filter((k) => k.sade.length >= 4 || (k.sade.length >= 2 && k.guven >= EN_AZ_GUVEN));
  const kullanildi = new Set();

  /** Ses efekti: modelin kutusu çevresinde en yakın benzer kelime; yoksa sayfada tek benzer kelime. */
  const sesOturt = (b) => {
    const parcalar = String(b.orijinal).split(/\s+/).map(sadelestir).filter((t) => t.length >= SES_EN_AZ_HARF);
    if (!parcalar.length) return b;
    const t = { x0: b.x * G, y0: b.y * Y, x1: (b.x + b.g) * G, y1: (b.y + b.h) * Y };
    const pay = Math.max(t.x1 - t.x0, t.y1 - t.y0, 0.15 * G);
    const tcx = (t.x0 + t.x1) / 2;
    const tcy = (t.y0 + t.y1) / 2;
    const adaylar = hepsi
      .map((k, i) => ({ k, i, cx: (k.kutu.x0 + k.kutu.x1) / 2, cy: (k.kutu.y0 + k.kutu.y1) / 2 }))
      .filter(({ k, i }) => !sesKullanildi.has(i) && parcalar.some((p) => sesBenzer(p, k.sade)));
    const yakin = adaylar
      .filter(({ cx, cy }) => Math.abs(cx - tcx) <= (t.x1 - t.x0) / 2 + pay && Math.abs(cy - tcy) <= (t.y1 - t.y0) / 2 + pay)
      .sort((a, c) => Math.hypot(a.cx - tcx, a.cy - tcy) - Math.hypot(c.cx - tcx, c.cy - tcy));
    const sayfada = adaylar.filter(({ cx, cy }) => !isaretliMi(cx, cy));
    const secilen = yakin[0] ?? (sayfada.length === 1 ? sayfada[0] : null);
    if (!secilen) return b;
    sesKullanildi.add(secilen.i);
    const { kutu } = secilen.k;
    const p = 0.15 * (kutu.y1 - kutu.y0);
    const x0 = Math.max(0, kutu.x0 - p);
    const y0 = Math.max(0, kutu.y0 - p);
    const x1 = Math.min(G, kutu.x1 + p);
    const y1 = Math.min(Y, kutu.y1 + p);
    return { ...b, x: x0 / G, y: y0 / Y, g: (x1 - x0) / G, h: (y1 - y0) / Y, ocrOturdu: true };
  };
  const sesKullanildi = new Set();

  return balonlar.map((b) => {
    if (latinSesMi(b) && !b.ocrOturdu) return sesOturt(b);
    if (!ocrGerekirMi(b)) return b;
    const kelimelerB = String(b.orijinal).split(/\s+/).map(sadelestir).filter((t) => t.length >= 2);
    if (!kelimelerB.length) return b;

    // Arama alanı: modelin kutusu, her yandan kendi boyu (ve resmin %15'i)
    // kadar genişletilmiş; kutu kayık olabilir.
    const t = { x0: b.x * G, y0: b.y * Y, x1: (b.x + b.g) * G, y1: (b.y + b.h) * Y };
    const pay = Math.max(t.x1 - t.x0, t.y1 - t.y0, 0.15 * G);
    const alan = { x0: t.x0 - pay, y0: t.y0 - pay, x1: t.x1 + pay, y1: t.y1 + pay };
    const gerekli = Math.max(1, Math.ceil(EN_AZ_ESLESME * kelimelerB.length));
    const eslesmeAra = (icinde) => {
      const liste = [];
      sozluk.forEach((k, i) => {
        if (kullanildi.has(i)) return;
        const cx = (k.kutu.x0 + k.kutu.x1) / 2;
        const cy = (k.kutu.y0 + k.kutu.y1) / 2;
        if (!icinde(cx, cy)) return;
        if (kelimelerB.some((tk) => kelimeEslesir(tk, k.sade))) liste.push(i);
      });
      return liste;
    };
    const kumeler = (liste, aralik) => tumKumeler(liste.map((i) => sozluk[i]), liste, aralik).filter((km) => km.length >= gerekli);
    // Eşleşen kelimelerin en kalabalık yakın kümesi (aynı metnin satırları).
    let kume = kumeler(eslesmeAra((cx, cy) => cx >= alan.x0 && cx <= alan.x1 && cy >= alan.y0 && cy <= alan.y1))[0];
    // Yakında yoksa bütün sayfada, kesin eşleşen tek bir küme varsa: model
    // kutuyu başka bir yere koymuş olabilir (kullanıcının sayfasında "È
    // ALICE!" kutusu üstteki balonun "...ALICE?!" satırındaydı; asıl yazı
    // panelin altındaydı). Kısa kelimeler ("UNA", "DI") de sayılır ama
    // kümede en az UZAK_EN_AZ_UZUN uzun kelime olmalı: "...HO UNA COSA DI CUI
    // VI DEVO PARLARE." için yalnızca uzunlar (COSA, DEVO, PARLARE) 8
    // kelimenin %40'ına yetmiyordu.
    if (!kume) {
      const uzunSayisi = (km) => km.filter((i) => sozluk[i].sade.length >= UZAK_KELIME).length;
      const metindekiUzun = kelimelerB.filter((tk) => tk.length >= UZAK_KELIME).length;
      const gerekenUzun = Math.max(1, Math.min(UZAK_EN_AZ_UZUN, metindekiUzun));
      // Aralık geniş: aradaki satırlar bozuk okunup eşleşmese de ("RICOR-
      // DARLO" → "LARLO") aynı metnin satırları bir arada kalsın.
      const sayfada = kumeler(eslesmeAra((cx, cy) => !isaretliMi(cx, cy)), UZAK_ARALIK)
        .filter((km) => uzunSayisi(km) >= gerekenUzun);
      if (sayfada.length === 1) kume = sayfada[0];
    }
    if (!kume) return b;
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
 * Modelin atladığı yazılar: OCR'nin güvenle okuduğu, hiçbir çevirinin
 * kutusuyla örtüşmeyen, numaralı balonların dışında kalan ve modelin
 * okuduğu hiçbir metne benzemeyen kelime kümeleri. Kullanıcının sayfasında
 * model birbirine değen iki balondan "SPRIZZANO VOGLIA DI UCCIDERCI DA TUTTI
 * I PORI." yazısını hiç döndürmemişti (balonlar sayfanın beyaz alanına
 * açıldığı için numara da almamıştı).
 * @param {import('./yz/cozumle.js').Balon[]} balonlar  0-1 oranlı.
 * @param {{kelimeler: import('./yerel/gruplama.js').OcrKelimesi[], genislik: number, yukseklik: number}} ocr
 * @param {{isaretli?: {x0: number, y0: number, x1: number, y1: number}[]}} [ek]
 * @returns {{kutu: number[], kelimeler: string[]}[]}  kutu [ymin, xmin, ymax, xmax] 0-1000 (istem biçimi).
 */
export function atlananYazilar(balonlar, { kelimeler, genislik: G, yukseklik: Y }, { isaretli = [] } = {}) {
  const icinde = (cx, cy, k) => cx >= k.x0 && cx <= k.x1 && cy >= k.y0 && cy <= k.y1;
  const pay = 0.01 * Math.max(G, Y);
  const kutular = balonlar.map((b) => ({ x0: b.x * G - pay, y0: b.y * Y - pay, x1: (b.x + b.g) * G + pay, y1: (b.y + b.h) * Y + pay }));
  const isaretliP = isaretli.map((k) => ({ x0: k.x0 * G, y0: k.y0 * Y, x1: k.x1 * G, y1: k.y1 * Y }));
  const okunanlar = balonlar.flatMap((b) => String(b.orijinal).split(/\s+/).map(sadelestir)).filter((t) => t.length >= 2);
  const adaylar = kelimeler
    .map((k) => ({ ...k, sade: sadelestir(k.metin) }))
    .filter((k) => {
      if (k.sade.length < ATLANAN_EN_KISA || k.guven < ATLANAN_GUVEN || !/^\p{L}+$/u.test(k.sade)) return false;
      const cx = (k.kutu.x0 + k.kutu.x1) / 2;
      const cy = (k.kutu.y0 + k.kutu.y1) / 2;
      return !kutular.some((t) => icinde(cx, cy, t)) && !isaretliP.some((t) => icinde(cx, cy, t));
    });
  return tumKumeler(adaylar, adaylar.map((_, i) => i))
    .map((km) => km.map((i) => adaylar[i]))
    .filter((km) => km.length >= ATLANAN_EN_AZ_KELIME && km.filter((k) => k.sade.length >= UZAK_KELIME).length >= 2)
    // Modelin okuduğu bir metnin kelimeleriyse atlanmış değil, yalnızca yeri kaymış.
    .filter((km) => km.filter((k) => okunanlar.some((o) => kelimeEslesir(o, k.sade))).length < EN_AZ_ESLESME * km.length)
    .map((km) => {
      const x0 = Math.min(...km.map((k) => k.kutu.x0));
      const y0 = Math.min(...km.map((k) => k.kutu.y0));
      const x1 = Math.max(...km.map((k) => k.kutu.x1));
      const y1 = Math.max(...km.map((k) => k.kutu.y1));
      const b = (v, n) => Math.max(0, Math.min(1000, Math.round((v / n) * 1000)));
      return { kutu: [b(y0, Y), b(x0, G), b(y1, Y), b(x1, G)], kelimeler: km.map((k) => k.sade) };
    });
}

/** İkinci yanıttaki bir metin bu atlanan yazının mı (kelimelerinin yeterince eşleşmesi)? */
export function atlananaUyar(atlanan, orijinal) {
  const kelimelerB = String(orijinal).split(/\s+/).map(sadelestir).filter((t) => t.length >= 2);
  const tutan = atlanan.kelimeler.filter((k) => kelimelerB.some((o) => kelimeEslesir(o, k))).length;
  return tutan >= Math.max(1, Math.ceil(EN_AZ_ESLESME * atlanan.kelimeler.length));
}

/**
 * Kelimeleri yakınlığa göre kümeler (aralarındaki boşluk iki kelime boyunu
 * geçmeyenler aynı kümede; [aralik] kelime boyu cinsinden); kümelerin sıra
 * numaraları, kalabalıktan aza.
 */
function tumKumeler(kelimeler, numaralar, aralik = 2) {
  if (!kelimeler.length) return [];
  const ata = kelimeler.map((_, i) => i);
  const bul = (i) => (ata[i] === i ? i : (ata[i] = bul(ata[i])));
  for (let i = 0; i < kelimeler.length; i++) {
    for (let j = i + 1; j < kelimeler.length; j++) {
      const a = kelimeler[i].kutu;
      const c = kelimeler[j].kutu;
      const boy = aralik * Math.max(a.y1 - a.y0, c.y1 - c.y0);
      if (a.x0 - boy <= c.x1 && c.x0 - boy <= a.x1 && a.y0 - boy <= c.y1 && c.y0 - boy <= a.y1) ata[bul(i)] = bul(j);
    }
  }
  const gruplar = new Map();
  kelimeler.forEach((_, i) => {
    const k = bul(i);
    gruplar.set(k, [...(gruplar.get(k) ?? []), numaralar[i]]);
  });
  return [...gruplar.values()].sort((a, b) => b.length - a.length);
}
