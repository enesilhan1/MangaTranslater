// Resimdeki konuşma balonlarını bulma ve çevirileri onlara yerleştirme.
//
// Görsel modeller (özellikle Claude) yazıyı doğru okuyup çevirse de konumu
// kaba tahmin ediyor: kutular yazıdan kayıyor, komşu panele düşüyordu.
// Modelin uydurduğu kutuyu düzeltmeye çalışmak yetmedi (büyük kaymalarda
// yanlış balona/çizime oturuyordu). Bu yüzden:
//
// 1. balonlariBul: sayfadaki kapalı beyaz balonlar piksellerden çıkarılır
//    (flood fill + şekil denetimi). İçerik betiği bunları modele giden
//    resmin kopyasına numaralı işaretlerle çizer.
// 2. Model her metin için hangi numaralı balonda olduğunu söyler; kutu
//    doğrudan bulunan balondaki yazının sınırlarıdır (model koordinatı
//    kullanılmaz).
// 3. Numarasız metinlerde (ses efekti, açık uçlu balon, işaretlenmemiş
//    kutu) modelin kutusu ipucu olarak kullanılıp aynı denetimlerle en yakın
//    geçerli balona oturtulur; uygun balon yoksa olduğu gibi kalır.
//
// Saf hesaplama: gri tonlu piksel dizisi üzerinde çalışır (içerik betiği
// küçük bir analiz tuvalinden verir).

import { tersYazilariBul } from './ters_yazi.js';

/** Bu parlaklıktan açık pikseller balon içi sayılır (JPEG gürültüsüne pay). */
export const BEYAZ_ESIGI = 190;
/** Tahmini kutunun içinde denenecek tohum noktaları (her eksende). */
const TOHUM_SAYISI = 7;
/** Bölgenin en az bu oranı tahmini kutuyla örtüşmeli. */
const EN_AZ_ORTUSME = 0.25;
/**
 * Aşındırma yarıçapı (gri kopyanın pikselleriyle). Flood fill beyaz alanın
 * bu kadar aşındırılmış halinde yapılır: balonun ince kuyruğu ve sivri
 * bağırma balonlarının uçları gövdeden kopar. Kullanıcının sayfasında uzun
 * kuyruklu "WHERE AM I..." balonu ve sivri uçlu bir balon, kuyruk/uçlar
 * sınırlayıcı kutuyu büyüttüğü için "çok boş" sayılıp atlanıyordu.
 */
export const ASINDIRMA = 3;

/**
 * İşaret dairesinin denenecek yarıçapları (gri kopyanın pikselleriyle; 500 px
 * genişlikte 8 px, gönderilen resimde genişliğin ~%1,6'sı). Yer yoksa küçülür.
 */
const ISARET_YARICAPLARI = [8, 6, 4];
/**
 * Ortak alandaki metinlerde işaretin kendi metnine uzaklığı, öbür metinlere
 * uzaklığın en çok bu katı (model işareti en yakın metne bağlıyor).
 */
const YAKINLIK_ORANI = 0.5;

/** Yoğunluk lekesiz blokta ölçülecekse blokta en az bu kadar parça ve ortanca parça boyu (gri px). */
const BLOK_OLCU_PARCA = 4;
const BLOK_OLCU_HARF = 3;

/** Sahipsiz balon eşleştirmesinde en çok uzaklık (resmin köşegenine oranla). */
const SAHIPSIZ_UZAKLIK = 0.3;
/**
 * Aynı numarayı alıp o balonun içine düşen (devamı sayılabilecek) metin için
 * daha sıkı sınır: model gerçekten tek balonu bölmüşse uzaktaki bir yanlış
 * bulgu metnin yarısını kapmasın.
 */
const SAHIPSIZ_BIRLESME_UZAKLIK = 0.15;
/**
 * Numaralı balondaki harf parçası metnin harf sayısının bundan azsa metin o
 * balona sığmaz sayılır (bkz. numarayaGuvenilmez). Kullanıcının sayfalarında
 * ölçtüğüm gerçek balonlarda oran 0,5-0,9 (düşük çözünürlükte harfler birleşiyor).
 */
const NUMARA_PARCA_ORANI = 0.35;
/** Bundan az parça: metin o balona kesinlikle sığmaz (modelin kutusu nerede olursa olsun). */
const NUMARA_KESIN_ORAN = 0.2;
/**
 * Numarasız metin (OCR ile, en yakın bölgeye ya da sahipsiz balona) harf
 * parçası metnin harflerinin bu oranından az olan bölgeye oturtulmaz. Gerçek
 * balonlarda oran 0,5-0,9; kullanıcının sayfasında kedinin gözü 4 parça,
 * yanındaki 12 harflik yazı (0,33) %30 sınırını geçip göze gidebiliyordu.
 */
const SIGMA_ORANI = 0.4;

/** Bir sayfada işaretlenecek en çok balon (fazlası çoğunlukla yanlış bulgu). */
export const AZAMI_BALON = 40;

/**
 * Balon şekil denetimi. Kullanıcının MangaDex sayfasında çizimdeki beyaz bir
 * alan (yüz, saç arası) "içinde yazı olan balon" sanılmış ve çeviri paneli
 * kaplamıştı; bu eşikler o tür bölgeleri eler.
 */
const SEKIL = Object.freeze({
  /** Dolu şekil (bölge + delikler) sınırlayıcı kutunun en az bu oranı (elips ≈ 0,79). */
  enAzDoluluk: 0.6,
  /** Deliklerin (yazı) dolu şekle oranı. */
  enAzDelik: 0.015,
  /**
   * enAzDelikKisa-enAzDelik arası delik oranı yalnızca yazı bloğu harflerden
   * oluşup en az kisaYaziYogunluk sıklığındaysa kabul (kullanıcının
   * sayfasında büyük, panelle kesilmiş balonda "SAI...": %1,4, blok 0,34;
   * aynı aralıktaki yanlış bulgular: sayfa numarası, tram, 0,13'lük çizim).
   */
  enAzDelikKisa: 0.008,
  kisaYaziYogunluk: 0.25,
  enCokDelik: 0.45,
  /** En büyük tek delik parçası bölgenin bu oranından geniş/uzun olamaz (harf ≠ çizim çizgisi). */
  enBuyukParca: 0.5,
  /**
   * Yazı balonun kenarına yapışık olamaz: her kenarda en az bu oranda (ve
   * en az 1 px) boşluk. %3 iken panel kenarında kesilmiş balonda kenara 4 px
   * yaklaşan gerçek yazı eleniyordu.
   */
  kenarBoslugu: 0.01,
  /** Bölge resmin bu oranından büyük olamaz. */
  enCokAlan: 0.15,
  /**
   * Harf boyu tutarlılığı: delik parçalarının en az bu oranı ortanca
   * parça boyunun 0,6-1,7 katı olmalı (yazının harfleri benzer boyda; panel
   * arka planındaki çizim parçaları değil). Kullanıcının 4 sayfasında gerçek
   * balonlarda ≥0,5, yanlış bulgularda 0,29-0,33.
   */
  enAzTutarlilik: 0.45,
  /**
   * "Harfleri" bölge yüksekliğinin bu oranından küçük (ortanca parça) ve
   * tutarlılığı kucukHarfTutarlilik'ten az bölge balon değil: tramlı kumaş,
   * saç, yüz. Kullanıcının sayfasında balonun yanındaki benekli kapüşon
   * numara aldı, model alttaki metinlerin numaralarını kaydırdı (0,014 /
   * 0,55). 32 sayfada yanlış bulgular ≤0,014 / ≤0,58; gerçek balonlarda
   * oran ≥0,029, tek istisna küçük çözünürlüklü Rusça balon (0,011 / 0,70).
   */
  kucukHarfOrani: 0.02,
  kucukHarfTutarlilik: 0.65,
  /**
   * Çok sayıda minik parça tram dokusu/korkuluktur: parça sayısı bundan
   * fazla ve ortanca parça boyu en çok enKucukHarf pikselse balon değil.
   * (Kullanıcının sayfasında yanlış bulguda 122 parça, ortanca boy 1 px;
   * uzun yazılı gerçek balonda harfler ~10 px.)
   */
  enCokParca: 60,
  enKucukHarf: 3,
  /**
   * Delik piksellerinin yazı kutusuna oranı en az bu. Kullanıcının 11
   * sayfasında gerçek balonlarda ≥0,11 (en düşüğü saçın önündeki küçük
   * çözünürlüklü balon), çizimdeki beyaz giysi/tram bulgularında ≤0,064.
   */
  enAzYogunluk: 0.09,
  /** Bundan az parçalı yazıda yoğunluk en az azParcaYogunluk (gerçek "UAH" ≥0,52; yanlış bulgu ≤0,30). */
  azParca: 4,
  azParcaYogunluk: 0.4,
  /** Doluluk bundan yüksekse dikdörtgen kutu (anlatım), düşükse oval balon. */
  dikdortgenDoluluk: 0.88,
  /**
   * Balon resmin en az bu genişlik oranında olmalı (gerçek sayfada en küçük
   * balon "UAH" ~%10; %5'lik bir enkaz parçası yanlışlıkla balon sayılıyordu).
   */
  enAzGenislik: 0.06,
});

/**
 * @typedef {{gri: Uint8Array, genislik: number, yukseklik: number}} GriResim
 *   Satır satır parlaklık değerleri (0 siyah, 255 beyaz).
 * @typedef {{x0: number, y0: number, x1: number, y1: number}} PikselKutu
 *   Uçlar dahil.
 * @typedef {{kutu: PikselKutu, yazi: PikselKutu, elips: boolean, ters?: boolean, parca?: number,
 *   isaret?: {x: number, y: number, r: number} | null}} BulunanBalon
 *   Balonun içi, içindeki yazının sınırları (gri resmin pikselleriyle) ve
 *   şekli (oval mi, dikdörtgen anlatım kutusu mu). [ters] koyu zeminli yazı
 *   (siyah balon; ters_yazi.js).
 */

/**
 * Resimdeki kapalı balonları bulur; okuma sırasıyla (yukarıdan aşağı, aynı
 * hizada soldan sağa) numaralanacak şekilde sıralı.
 * @param {GriResim} resim
 * @param {(b: {kutu: PikselKutu, sebep: string}) => void} [tani]  Her aday
 *   bölge için çağrılır (balon değilse sebebiyle); hata ayıklama ve testler için.
 * @returns {BulunanBalon[]}
 */
export function balonlariBul(resim, tani) {
  const { gri, genislik: G, yukseklik: Y } = resim;
  const etiket = new Int32Array(G * Y);
  const azamiAlan = SEKIL.enCokAlan * G * Y;
  const enAzAlan = Math.max(150, 0.0015 * G * Y);
  const bulunan = [];
  let no = 0;
  // Her pikselden tohum atmak gereksiz: balonlar birkaç pikselden büyük.
  const adim = 3;
  for (let y = 0; y < Y; y += adim) {
    for (let x = 0; x < G; x += adim) {
      const p = y * G + x;
      if (!tohumMu(resim, etiket, p)) continue;
      const bolge = doldur(resim, etiket, x, y, ++no, azamiAlan);
      if (!bolge || bolge.alan < enAzAlan) continue;
      if (bolge.kutu.x1 - bolge.kutu.x0 + 1 < SEKIL.enAzGenislik * G) {
        tani?.({ kutu: bolge.kutu, sebep: 'dar' });
        continue;
      }
      const sonuc = balonMu(resim, etiket, bolge);
      tani?.({ kutu: sonuc.kutu ?? bolge.govde, sebep: sonuc.sebep ?? 'balon', ozellik: sonuc.ozellik });
      if (sonuc.bloklar) {
        // Ortak beyaz alanda birden çok blok: her bloğun zemini kendi kutusu
        // (ortak balon şekli iki çeviriyi üst üste bindirirdi).
        for (const b of sonuc.bloklar) bulunan.push({ kutu: b.kutu, yazi: b.kutu, elips: false, parca: b.parca, isaret: b.isaret });
      } else if (sonuc.yazi) {
        bulunan.push({ kutu: sonuc.kutu, yazi: sonuc.yazi, elips: sonuc.elips, parca: sonuc.ozellik.parca, isaret: sonuc.isaret });
      }
    }
  }
  // Koyu zeminli yazılar (siyah balonlar) da numara alır.
  bulunan.push(...tersYazilariBul(resim, bulunan));
  const satir = 0.03 * Y;
  return bulunan
    .sort((a, b) => (Math.abs(a.kutu.y0 - b.kutu.y0) < satir ? a.kutu.x0 - b.kutu.x0 : a.kutu.y0 - b.kutu.y0))
    .slice(0, AZAMI_BALON);
}

/**
 * Modelin balonlarını resme yerleştirir.
 * - [bolge] (1'den başlayan işaret numarası) geçerliyse kutu, o bulunan
 *   balondaki yazının sınırlarıdır.
 * - İki farklı metne aynı numara verildiyse (kullanıcının sayfasında Claude
 *   böyle yaptı) modelin kutusu o balona daha yakın olan orada kalır;
 *   diğeri numarasız sayılır. Aynı çeviri iki kez geldiyse biri atılır.
 * - Numarasız kayıtlar (ses efektleri hariç) tahmini kutuya en uygun,
 *   başka kayda verilmemiş geçerli balona oturtulur; yoksa tahminde kalır.
 *   Tek istisna: aynı numarayı alıp yerinden edilen bir metnin tahmini
 *   kutusu da o balonun içindeyse model tek balonu ikiye bölmüştür; metin
 *   o balona eklenir (yakında çevirisiz bir balon yoksa). Baştan numarasız gelen metin hiçbir zaman başka
 *   metinle birleştirilmez ("... vardır. AH" hatası).
 * Sonuç girdinin sırasını korur.
 * @param {GriResim} resim
 * @param {import('./yz/cozumle.js').Balon[]} balonlar  0-1 oranlı.
 * @param {BulunanBalon[]} [bulunanlar]  İşaretlenen balonlar (numara sırasıyla).
 */
export function kutulariOturt(resim, balonlar, bulunanlar = []) {
  const { genislik: G, yukseklik: Y } = resim;
  const oran = (k) => ({ x: k.x0 / G, y: k.y0 / Y, g: (k.x1 - k.x0 + 1) / G, h: (k.y1 - k.y0 + 1) / Y });
  /** Sonuçtaki balon şekli: içi (0-1), oval mi, koyu zeminli mi. */
  const balonBicimi = (bb) => ({ ...oran(bb.kutu), elips: bb.elips, ...(bb.ters ? { ters: true } : {}) });
  const tahminKutusu = (b) => ({
    x0: Math.floor(b.x * G),
    y0: Math.floor(b.y * Y),
    x1: Math.min(G - 1, Math.ceil((b.x + b.g) * G)),
    y1: Math.min(Y - 1, Math.ceil((b.y + b.h) * Y)),
  });
  /** Tahmini kutunun merkezinin balondaki yazının merkezine uzaklığı (piksel). */
  const uzaklik = (b, bulunan) => {
    const t = tahminKutusu(b);
    const y = bulunan.yazi;
    return Math.hypot((t.x0 + t.x1 - y.x0 - y.x1) / 2, (t.y0 + t.y1 - y.y0 - y.y1) / 2);
  };

  /** Her kaydın sonucu (girdi sırasıyla); null: atıldı (yinelenen). */
  const sonuc = balonlar.map(() => null);
  /** bulunan balon numarası → {i: kayıt sırası, mesafe} */
  const atanan = new Map();
  const numarasiz = [];
  /** kayıt sırası → yerinden edildiği balon numarası */
  const yerinden = new Map();
  balonlar.forEach((b, i) => {
    let n = Number.isInteger(b.bolge) && b.bolge >= 1 && b.bolge <= bulunanlar.length ? b.bolge : 0;
    if (n && !b.kutusuz && numarayaGuvenilmez(b, bulunanlar[n - 1], tahminKutusu(b))) n = 0;
    if (!n || b.tur === 'ses') {
      numarasiz.push(i);
      return;
    }
    const mesafe = uzaklik(b, bulunanlar[n - 1]);
    const es = atanan.get(n);
    if (!es) {
      atanan.set(n, { i, mesafe });
      return;
    }
    if (balonlar[es.i].ceviri === b.ceviri) return; // aynı metin iki kez
    if (mesafe < es.mesafe) {
      numarasiz.push(es.i);
      yerinden.set(es.i, n);
      atanan.set(n, { i, mesafe });
    } else {
      numarasiz.push(i);
      yerinden.set(i, n);
    }
  });
  for (const [n, { i }] of atanan) {
    const bb = bulunanlar[n - 1];
    sonuc[i] = { ...balonlar[i], ...oran(bb.yazi), balon: balonBicimi(bb), oturdu: true };
  }

  // Numarasızlar: dolu balonların içleri başka kayda verilemesin diye
  // önce etiketlenir.
  const etiket = new Int32Array(G * Y);
  const bolgeler = new Map();
  let sonEtiket = 0;
  const kullanilan = new Set();
  for (const [n] of atanan) {
    const k = bulunanlar[n - 1].kutu;
    const cx = Math.round((k.x0 + k.x1) / 2);
    for (let y = k.y0; y <= k.y1; y++) {
      const p = y * G + cx;
      if (tohumMu(resim, etiket, p)) {
        const no = ++sonEtiket;
        bolgeler.set(no, doldur(resim, etiket, cx, y, no, SEKIL.enCokAlan * G * Y));
        kullanilan.add(no);
        break;
      }
    }
  }
  /** kayıt sırası → eklenebileceği balon numarası (sahipsiz balon bulunamazsa) */
  const birlesecek = new Map();
  /** OCR kutusuyla eşlenip alınmış bulunan balon numaraları */
  const ocrAlinan = new Set();
  numarasiz.sort((a, b) => a - b);
  for (const i of numarasiz) {
    const b = balonlar[i];
    // OCR kutusu çevirisiz bir bulunmuş balona değiyorsa metin o
    // balonundur: model numara vermemiş, OCR kelime kümesi de balonun
    // altına taşmış (kullanıcının sayfasında balonun açık alt ucundaki
    // çizime). Balonun pikselleri OCR kümesinden güvenilir.
    if (b.ocrOturdu && b.tur !== 'ses') {
      const t = tahminKutusu(b);
      const harf = String(b.orijinal).replace(/[^\p{L}\p{N}]/gu, '').length;
      let enIyi = 0;
      let secilenNo = 0;
      bulunanlar.forEach((bb, n) => {
        if (atanan.has(n + 1) || ocrAlinan.has(n + 1)) return;
        const parca = bb.parca ?? harf;
        if (harf && (parca < SIGMA_ORANI * harf || parca > 2.5 * harf)) return;
        // Yalnızca OCR kutusu balonun dışına taşıyorsa: tamamen içindeyse
        // yazı zaten yerinde (kullanıcının sayfasında doğru oturmuş bir liste,
        // panel zemininden çıkan oval "balona" taşınıp kesiliyordu).
        const k = bb.kutu;
        if (t.x0 >= k.x0 && t.y0 >= k.y0 && t.x1 <= k.x1 && t.y1 <= k.y1) return;
        const ortak = kesisimAlani(t, bb.kutu) / Math.min(alan(t), alan(bb.kutu));
        if (ortak >= 0.2 && ortak > enIyi) [enIyi, secilenNo] = [ortak, n + 1];
      });
      if (secilenNo) {
        const bb = bulunanlar[secilenNo - 1];
        ocrAlinan.add(secilenNo);
        sonuc[i] = { ...b, ...oran(bb.yazi), balon: balonBicimi(bb), oturdu: true, ocrOturdu: false };
        continue;
      }
    }
    // Ses efektleri ve OCR ile harflerin yerine oturmuş balonsuz metinler olduğu gibi.
    if (b.tur === 'ses' || b.ocrOturdu) {
      sonuc[i] = b;
      continue;
    }
    const tahmin = tahminKutusu(b);
    const doluKutular = sonuc.filter((x) => x?.oturdu).map((x) => tahminKutusu(x));
    const harf = String(b.orijinal).replace(/[^\p{L}\p{N}]/gu, '').length;
    const secilen = enIyiBolge(resim, etiket, bolgeler, kullanilan, tahmin, () => ++sonEtiket, doluKutular, harf);
    if (secilen) {
      if (secilen.tekBlok) kullanilan.add(secilen.no);
      sonuc[i] = { ...b, ...oran(secilen.yazi), balon: balonBicimi(secilen), oturdu: true, bolge: 0 };
      continue;
    }
    // Aynı numarayı alıp tahmini de o balonun içindeyse büyük ihtimalle aynı
    // balonun devamıdır; ama yakında çevirisiz bir balon varsa önce o denenir
    // (kullanıcının sayfasında model dar balonun metnine komşu anlatım
    // kutusunun numarasını verip kutusunu da onun kenarına koydu).
    const n = yerinden.get(i);
    if (n && kesisimAlani(bulunanlar[n - 1].kutu, tahmin) / alan(tahmin) >= 0.5) birlesecek.set(i, n);
    sonuc[i] = b;
  }

  // Sahipsiz balonlar ve yersiz metinler: bulunmuş, içinde yazı olan ama
  // hiçbir çeviri almamış balon kesinlikle çevrilmemiş bir balondur;
  // yerleşememiş bir metin de büyük ihtimalle onun çevirisidir (kullanıcının
  // sayfasında model dar bir balonun metnine numara vermeyip kutusunu
  // panelin ortasına koymuştu). En yakın çiftler eşlenir; uzaklık sınırlı ve
  // balondaki harf parçası sayısı metnin harf sayısıyla uyumlu olmalı ki
  // çizim üstündeki uzun bir başlık küçük bir balona taşınmasın.
  const yerlesmis = sonuc.filter((x) => x?.oturdu || x?.ocrOturdu);
  const sahipsiz = bulunanlar
    .map((bb, n) => ({ bb, n }))
    .filter(({ bb }) => !yerlesmis.some((x) => kesisimAlani(tahminKutusu(x), bb.yazi) > 0));
  const yersiz = sonuc
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x && !x.oturdu && !x.ocrOturdu && x.tur !== 'ses');
  if (sahipsiz.length && yersiz.length) {
    const esik = SAHIPSIZ_UZAKLIK * Math.hypot(G, Y);
    const ciftler = [];
    for (const y of yersiz) {
      const harf = String(y.x.orijinal).replace(/[^\p{L}\p{N}]/gu, '').length;
      for (const sb of sahipsiz) {
        const parca = sb.bb.parca ?? harf;
        if (harf && (parca < SIGMA_ORANI * harf || parca > 2.5 * harf)) continue;
        const m = uzaklik(y.x, sb.bb);
        // Bir balonun devamı olabilecek metin için yalnızca yakındaki balon.
        if (m <= (birlesecek.has(y.i) ? SAHIPSIZ_BIRLESME_UZAKLIK * Math.hypot(G, Y) : esik)) ciftler.push({ y, sb, m });
      }
    }
    ciftler.sort((a, b) => a.m - b.m);
    const yAlindi = new Set();
    const sAlindi = new Set();
    for (const { y, sb } of ciftler) {
      if (yAlindi.has(y.i) || sAlindi.has(sb.n)) continue;
      yAlindi.add(y.i);
      sAlindi.add(sb.n);
      sonuc[y.i] = { ...y.x, ...oran(sb.bb.yazi), balon: balonBicimi(sb.bb), oturdu: true };
    }
  }

  // Sahipsiz balona gitmeyen devam metinleri asıl balona eklenir (model tek
  // balonu ikiye bölmüş).
  for (const [i, n] of birlesecek) {
    if (sonuc[i]?.oturdu) continue;
    const hi = atanan.get(n).i;
    const hedef = sonuc[hi];
    const b = balonlar[i];
    if (hedef.ceviri !== b.ceviri) {
      // Okuma sırası: girdide önce gelen önce yazılır.
      const [ilk, son] = i < hi ? [b, hedef] : [hedef, b];
      hedef.ceviri = `${ilk.ceviri} ${son.ceviri}`;
      hedef.orijinal = `${ilk.orijinal} ${son.orijinal}`;
    }
    sonuc[i] = null;
  }
  // Kutusu bozuk gelip numarasıyla da bir balona oturamayan kayıt için
  // gösterilecek yer yok.
  return sonuc.filter((x) => x && !(x.kutusuz && !x.oturdu));
}

/**
 * Metin, harf parçası [parca] olan bir balona sığmayacak kadar uzun mu
 * (parça, harflerin NUMARA_PARCA_ORANI'ndan az)? Arka plan da kullanır:
 * böyle numaralı metinler balonsuz metinler gibi OCR'den geçer.
 */
export function metinSigmaz(orijinal, parca) {
  const harf = String(orijinal ?? '').replace(/[^\p{L}\p{N}]/gu, '').length;
  return parca != null && harf > 0 && parca < NUMARA_PARCA_ORANI * harf;
}

/**
 * Modelin verdiği numara açıkça yanlış mı? Metin o balona sığmayacak kadar
 * uzunsa (balondaki harf parçası metnin harflerinin NUMARA_PARCA_ORANI'ndan
 * az) ve modelin kutusunun merkezi balonun dışındaysa; ya da metin çok
 * uzunsa (NUMARA_KESIN_ORAN'dan az parça) kutuya bakılmadan. Kullanıcının
 * sayfasında kedinin gözü (4 parça) balon sanılıp numaralandı; model yanındaki
 * çizim üstü "FORSE PENSAVANO FOSSI MORTO..." yazısına (24 harf) o numarayı
 * verdi, çeviri göze sıkıştı. 1.7.9'da kutunun balona hiç değmemesi
 * şartı aranıyordu; Claude'un kutusu göze yakın düştüğü için kural
 * çalışmadı. Ölçülen gerçek balonlarda oran 0,5-0,9 (düşük çözünürlükte
 * harfler birleşip az parça sayılıyor), modelin kutusu da sık kayıyor.
 */
function numarayaGuvenilmez(b, bulunan, tahmin) {
  if (!metinSigmaz(b.orijinal, bulunan.parca)) return false;
  const harf = String(b.orijinal).replace(/[^\p{L}\p{N}]/gu, '').length;
  const parca = bulunan.parca;
  if (parca < NUMARA_KESIN_ORAN * harf) return true;
  const k = bulunan.kutu;
  const cx = (tahmin.x0 + tahmin.x1) / 2;
  const cy = (tahmin.y0 + tahmin.y1) / 2;
  return cx < k.x0 || cx > k.x1 || cy < k.y0 || cy > k.y1;
}

/**
 * Tahmini kutunun çevresindeki geçerli balonlardan tahminle en çok
 * örtüşen ve henüz kullanılmamış olanı. [harf] verilirse içindeki harf
 * parçası metne göre çok az olan bölge atlanır (uzun yazı küçük bir beyaz
 * alana, ör. bir gözün içine sıkışmasın).
 */
function enIyiBolge(resim, etiket, bolgeler, kullanilan, tahmin, yeniEtiket, doluKutular = [], harf = 0) {
  const sigar = (parca) => !harf || parca == null || parca >= SIGMA_ORANI * harf;
  const { genislik: G, yukseklik: Y } = resim;
  const tg = tahmin.x1 - tahmin.x0 + 1;
  const th = tahmin.y1 - tahmin.y0 + 1;
  const tahminAlani = tg * th;
  // Bölge tahminin birkaç katından büyük olamaz. Tahmin çoğunlukla yalnızca
  // yazının çevresi kadar sıkı, balon ise belirgin büyük; çizimdeki beyaz
  // alanları asıl eleyen şekil denetimi (balonMu).
  const azamiAlan = Math.min(SEKIL.enCokAlan * G * Y, Math.max(10 * tahminAlani, 0.03 * G * Y));
  const pay = 0.25;
  let enIyi = null;
  const denenen = new Set();
  for (let i = 0; i < TOHUM_SAYISI; i++) {
    for (let j = 0; j < TOHUM_SAYISI; j++) {
      const x = Math.round(tahmin.x0 - pay * tg + ((1 + 2 * pay) * tg * (i + 0.5)) / TOHUM_SAYISI);
      const y = Math.round(tahmin.y0 - pay * th + ((1 + 2 * pay) * th * (j + 0.5)) / TOHUM_SAYISI);
      if (x < 0 || y < 0 || x >= G || y >= Y) continue;
      const p = y * G + x;
      let no = etiket[p];
      if (no === 0 && !tohumMu(resim, etiket, p)) continue;
      if (no === 0) {
        no = yeniEtiket();
        bolgeler.set(no, doldur(resim, etiket, x, y, no, azamiAlan));
      }
      if (denenen.has(no)) continue;
      denenen.add(no);
      const bolge = bolgeler.get(no);
      if (!bolge || bolge.alan > azamiAlan) continue;
      const ortusme = kesisimAlani(bolge.kutu, tahmin) / Math.min(alan(bolge.kutu), tahminAlani);
      if (ortusme < EN_AZ_ORTUSME) continue;
      const bulgu = balonMu(resim, etiket, bolge);
      if (!bulgu.yazi) continue;
      // Çok bloklu bölgede dolu olmayan bloklar ayrı ayrı aday; tek bloklu
      // bölge başka kayda verildiyse atlanır.
      const adaylar = bulgu.bloklar
        ? bulgu.bloklar
          .filter((b) => !doluKutular.some((k) => kesisimAlani(k, b.kutu) > 0) && sigar(b.parca))
          .map((b) => ({ yazi: b.kutu, kutu: b.kutu, elips: false }))
        : kullanilan.has(no) || !sigar(bulgu.ozellik.parca) ? [] : [{ yazi: bulgu.yazi, kutu: bulgu.kutu, elips: bulgu.elips }];
      for (const a of adaylar) {
        const puan = kesisimAlani(a.yazi, tahmin) / alan(a.yazi) + ortusme;
        if (!enIyi || puan > enIyi.puan) enIyi = { puan, no, ...a, tekBlok: !bulgu.bloklar };
      }
    }
  }
  return enIyi;
}

/** Resim başına bir kez: aşınmış beyaz maske (1: çevresindeki her piksel beyaz). */
const maskeler = new WeakMap();
function asinmisMaske(resim) {
  let m = maskeler.get(resim);
  if (m) return m;
  const { gri, genislik: G, yukseklik: Y } = resim;
  const R = ASINDIRMA;
  // Ayrılabilir minimum süzgeci: önce yatay, sonra dikey "hepsi beyaz mı".
  const yatay = new Uint8Array(G * Y);
  for (let y = 0; y < Y; y++) {
    let ardisik = 0;
    const satir = y * G;
    const say = new Int32Array(G); // x'te biten ardışık beyaz uzunluğu
    for (let x = 0; x < G; x++) {
      ardisik = gri[satir + x] >= BEYAZ_ESIGI ? ardisik + 1 : 0;
      say[x] = ardisik;
    }
    for (let x = R; x < G - R; x++) if (say[x + R] >= 2 * R + 1) yatay[satir + x] = 1;
  }
  m = new Uint8Array(G * Y);
  for (let x = 0; x < G; x++) {
    let ardisik = 0;
    const say = new Int32Array(Y);
    for (let y = 0; y < Y; y++) {
      ardisik = yatay[y * G + x] ? ardisik + 1 : 0;
      say[y] = ardisik;
    }
    for (let y = R; y < Y - R; y++) if (say[y + R] >= 2 * R + 1) m[y * G + x] = 1;
  }
  maskeler.set(resim, m);
  return m;
}

/** Bu piksel bir bölgenin tohumu olabilir mi (aşınmış beyaz ve etiketsiz)? */
function tohumMu(resim, etiket, p) {
  return etiket[p] === 0 && asinmisMaske(resim)[p] === 1;
}

/**
 * (x, y)'den başlayan beyaz bölgeyi asıl beyaz piksellerde doldurur (4
 * komşuluk); balon ince yerlerinden bölünmez. Bölgenin "gövde kutusu",
 * yalnızca aşınmış maskeye giren (çevresi ASINDIRMA kadar beyaz)
 * piksellerinden çıkarılır ve ASINDIRMA kadar genişletilir: ince kuyruk ve
 * sivri uçlar gövde kutusuna girmez; doluluk ve şekil bu kutuda ölçülür,
 * yazı (delik) analizi ise tam kutuda yapılır ki kenara yakın harfler
 * kaybolmasın.
 * Bölge [azamiAlan]'ı aşarsa null (balon değil). Doldurulan pikseller
 * etiketlenir; aynı bölge başka tohumdan tekrar doldurulmaz.
 */
function doldur(resim, etiket, x, y, no, azamiAlan) {
  const { gri, genislik: G, yukseklik: Y } = resim;
  const maske = asinmisMaske(resim);
  const yigin = [y * G + x];
  etiket[y * G + x] = no;
  const tam = { x0: x, y0: y, x1: x, y1: y };
  const govde = { x0: x, y0: y, x1: x, y1: y };
  let sayi = 0;
  while (yigin.length) {
    const p = yigin.pop();
    sayi++;
    const px = p % G;
    const py = (p - px) / G;
    if (px < tam.x0) tam.x0 = px;
    if (px > tam.x1) tam.x1 = px;
    if (py < tam.y0) tam.y0 = py;
    if (py > tam.y1) tam.y1 = py;
    if (maske[p] === 1) {
      if (px < govde.x0) govde.x0 = px;
      if (px > govde.x1) govde.x1 = px;
      if (py < govde.y0) govde.y0 = py;
      if (py > govde.y1) govde.y1 = py;
    }
    if (px > 0) it(p - 1);
    if (px < G - 1) it(p + 1);
    if (py > 0) it(p - G);
    if (py < Y - 1) it(p + G);
  }
  function it(q) {
    if (etiket[q] === 0 && gri[q] >= BEYAZ_ESIGI) {
      etiket[q] = no;
      yigin.push(q);
    }
  }
  const govdeKutusu = {
    x0: Math.max(tam.x0, govde.x0 - ASINDIRMA),
    y0: Math.max(tam.y0, govde.y0 - ASINDIRMA),
    x1: Math.min(tam.x1, govde.x1 + ASINDIRMA),
    y1: Math.min(tam.y1, govde.y1 + ASINDIRMA),
  };
  // Taşan bölge de etiketli kalır: başka tohum onu tekrar denemesin.
  return sayi > azamiAlan ? null : { no, kutu: tam, govde: govdeKutusu, alan: sayi };
}

/**
 * Bölge bir balon mu? Balonsa içindeki yazının (biraz paylı, balonun
 * içinde kalan) sınırlarını ve şeklini ({yazi, elips}), değilse null döndürür. Delikler = bölgeye ait
 * olmayan ama bölge kutusunun kenarından da ulaşılamayan pikseller.
 */
function balonMu(resim, etiket, bolge) {
  const G = resim.genislik;
  const { x0, y0, x1, y1 } = bolge.kutu;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 12 || h < 12) return { sebep: 'küçük' };
  const bolgede = (lx, ly) => etiket[(y0 + ly) * G + (x0 + lx)] === bolge.no;

  // Kutunun kenarından bölgeye ait olmayan piksellerle ulaşılan her yer
  // "dış"tır (balonun çizgisi, kuyruğu, dışarıdaki çizim).
  const durum = new Uint8Array(w * h); // 0: delik adayı, 1: dış, 2: bölge, 3: sayılmış delik
  for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) if (bolgede(lx, ly)) durum[ly * w + lx] = 2;
  const yigin = [];
  const disaEkle = (i) => {
    if (durum[i] === 0) {
      durum[i] = 1;
      yigin.push(i);
    }
  };
  for (let lx = 0; lx < w; lx++) {
    disaEkle(lx);
    disaEkle((h - 1) * w + lx);
  }
  for (let ly = 0; ly < h; ly++) {
    disaEkle(ly * w);
    disaEkle(ly * w + w - 1);
  }
  while (yigin.length) {
    const i = yigin.pop();
    const lx = i % w;
    const ly = (i - lx) / w;
    if (lx > 0) disaEkle(i - 1);
    if (lx < w - 1) disaEkle(i + 1);
    if (ly > 0) disaEkle(i - w);
    if (ly < h - 1) disaEkle(i + w);
  }

  // Delik parçaları (8 komşuluk): yazıda birçok küçük parça (harfler),
  // çizimde bölgeyi boydan boya geçen büyük çizgiler olur.
  let delik = 0;
  let parcaSayisi = 0;
  let enBuyukG = 0;
  let enBuyukH = 0;
  let yazi = null;
  /** Parçaların yükseklikleri (harf boyu tutarlılığı için) ve kutuları (bloklar için). */
  const parcaBoylari = [];
  const parcalar = [];
  for (let i = 0; i < w * h; i++) {
    if (durum[i] !== 0) continue;
    parcaSayisi++;
    const p = { x0: w, y0: h, x1: -1, y1: -1, piksel: 0 };
    durum[i] = 3;
    yigin.push(i);
    while (yigin.length) {
      const j = yigin.pop();
      delik++;
      p.piksel++;
      const lx = j % w;
      const ly = (j - lx) / w;
      if (lx < p.x0) p.x0 = lx;
      if (lx > p.x1) p.x1 = lx;
      if (ly < p.y0) p.y0 = ly;
      if (ly > p.y1) p.y1 = ly;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = lx + dx;
          const ny = ly + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (durum[k] === 0) {
            durum[k] = 3;
            yigin.push(k);
          }
        }
      }
    }
    enBuyukG = Math.max(enBuyukG, p.x1 - p.x0 + 1);
    enBuyukH = Math.max(enBuyukH, p.y1 - p.y0 + 1);
    parcaBoylari.push(p.y1 - p.y0 + 1);
    parcalar.push(p);
    yazi = yazi
      ? { x0: Math.min(yazi.x0, p.x0), y0: Math.min(yazi.y0, p.y0), x1: Math.max(yazi.x1, p.x1), y1: Math.max(yazi.y1, p.y1) }
      : p;
  }
  if (!yazi) return { sebep: 'yazısız' };

  // Doluluk ve delik oranı gövde kutusunda (kuyruk ve sivri uçlar hariç).
  const gv = bolge.govde ?? bolge.kutu;
  let govdeBolge = 0;
  let govdeDelik = 0;
  for (let ly = gv.y0 - y0; ly <= gv.y1 - y0; ly++) {
    for (let lx = gv.x0 - x0; lx <= gv.x1 - x0; lx++) {
      const v = durum[ly * w + lx];
      if (v === 2) govdeBolge++;
      else if (v === 3) govdeDelik++;
    }
  }
  const govdeAlani = (gv.x1 - gv.x0 + 1) * (gv.y1 - gv.y0 + 1);
  const doluSekil = govdeBolge + govdeDelik;
  const doluluk = doluSekil / govdeAlani;
  if (doluluk < SEKIL.enAzDoluluk) return { sebep: `doluluk ${doluluk.toFixed(2)}` };
  const delikOrani = govdeDelik / doluSekil;
  if (delikOrani < SEKIL.enAzDelikKisa || delikOrani > SEKIL.enCokDelik) return { sebep: `delik ${delikOrani.toFixed(3)}` };
  // Büyük balonda çok kısa yazı ("SAI...") delik oranını enAzDelik'in altına
  // düşürüyor; o zaman aşağıda yazı bloğu harflerden oluşmalı ve sık olmalı.
  const azDelik = delikOrani < SEKIL.enAzDelik;
  // Tek parçalı "yazı" balon değil (gerçek en kısa balonlarda bile, ör. "!?",
  // "UAH", en az 2 parça var; kullanıcının sayfasında tek lekeli küçük beyaz
  // bir alan balon sayılıyordu).
  if (parcaSayisi < 2) return { sebep: 'tek leke' };
  if (enBuyukG > SEKIL.enBuyukParca * w && enBuyukH > SEKIL.enBuyukParca * h) return { sebep: 'büyük parça' };
  const sirali = [...parcaBoylari].sort((a, b) => a - b);
  const ortanca = sirali[sirali.length >> 1];
  if (parcaSayisi > SEKIL.enCokParca && ortanca <= SEKIL.enKucukHarf) {
    return { sebep: `tram: ${parcaSayisi} parça, boy ${ortanca}` };
  }
  const tutarli = parcaBoylari.filter((b) => b >= ortanca * 0.6 && b <= ortanca * 1.7).length / parcaSayisi;
  if (tutarli < SEKIL.enAzTutarlilik) return { sebep: `tutarlılık ${tutarli.toFixed(2)}` };
  if (ortanca < SEKIL.kucukHarfOrani * h && tutarli < SEKIL.kucukHarfTutarlilik) {
    return { sebep: `küçük harf ${(ortanca / h).toFixed(3)} / ${tutarli.toFixed(2)}` };
  }
  const kenar = Math.max(1, Math.round(SEKIL.kenarBoslugu * Math.min(w, h)));
  if (yazi.x0 < kenar || yazi.y0 < kenar || yazi.x1 > w - 1 - kenar || yazi.y1 > h - 1 - kenar) return { sebep: 'kenarda yazı' };
  const bloklar = yaziBloklari(parcalar, ortanca);
  // Harfler yazı kutusunun belirgin bir kısmını kaplar; seyrek noktalar
  // (tram, kumaş deseni) kaplamaz. Az parçalı kısa yazıda ("!?", "UAH")
  // kalın harfler kutunun yarısından çoğunu doldurur. Tek metinde ölçü
  // lekeleri atılmış bloğun kutusu: kullanıcının sayfasında tırtıklı kenarlı
  // "GLI UMANI..." balonunda kenar lekeleri ham kutuyu balon kadar büyütüp
  // gerçek yazıyı "seyrek" gösteriyordu.
  // Yalnızca blok harflerden oluşuyorsa (en az BLOK_OLCU_PARCA parça, ortanca
  // boyu en az BLOK_OLCU_HARF px): yoksa ince çizgi/tram bloğu (bir panelin
  // hız çizgileri) ya da iki lekelik bir yüz yoğun görünüp balon sanılıyordu.
  const blokParcalari = bloklar.length === 1
    ? parcalar.filter((p) => p.x0 >= bloklar[0].x0 && p.x1 <= bloklar[0].x1 && p.y0 >= bloklar[0].y0 && p.y1 <= bloklar[0].y1)
    : [];
  const blokBoylari = blokParcalari.map((p) => p.y1 - p.y0 + 1).sort((a, b) => a - b);
  const blokHarfli = blokParcalari.length >= BLOK_OLCU_PARCA && blokBoylari[blokBoylari.length >> 1] >= BLOK_OLCU_HARF;
  const olcuKutusu = blokHarfli ? bloklar[0] : yazi;
  const olcuDelik = blokHarfli ? blokParcalari.reduce((s, p) => s + p.piksel, 0) : delik;
  const yogunluk = olcuDelik / ((olcuKutusu.x1 - olcuKutusu.x0 + 1) * (olcuKutusu.y1 - olcuKutusu.y0 + 1));
  if (yogunluk < SEKIL.enAzYogunluk) return { sebep: `seyrek ${yogunluk.toFixed(3)}` };
  if (azDelik && !(blokHarfli && yogunluk >= SEKIL.kisaYaziYogunluk)) return { sebep: `delik ${delikOrani.toFixed(3)}` };
  if (parcaSayisi < SEKIL.azParca && yogunluk < SEKIL.azParcaYogunluk) return { sebep: `seyrek kısa ${yogunluk.toFixed(3)}` };

  // Yazı satırları arasına ve kenarına pay; balonun içinde kalarak.
  const pay = Math.round(Math.min(w, h) * 0.06) + 1;
  const ozellik = {
    parca: parcaSayisi,
    delik: +delikOrani.toFixed(3),
    doluluk: +doluluk.toFixed(2),
    ortancaBoy: +(ortanca / h).toFixed(3),
    tutarli: +tutarli.toFixed(2),
    yaziOrani: +(((yazi.x1 - yazi.x0 + 1) * (yazi.y1 - yazi.y0 + 1)) / (w * h)).toFixed(2),
    yogunluk: +yogunluk.toFixed(3),
  };
  const payli = (k) => ({
    x0: x0 + Math.max(0, k.x0 - pay),
    y0: y0 + Math.max(0, k.y0 - pay),
    x1: x0 + Math.min(w - 1, k.x1 + pay),
    y1: y0 + Math.min(h - 1, k.y1 + pay),
  });
  const cizimli = bloklar.length === 1 && bloklar.cizimAtildi;
  // Tek metinde kutu, lekeleri atılmış bloğun kutusu.
  const yaziKutusu = payli(bloklar.length === 1 ? bloklar[0] : yazi);
  const bolgeIntegrali = integral(durum, w, h);
  const kacinilacak = (bloklar.length > 1 ? bloklar.map(payli) : [yaziKutusu]);
  const yer = (hedef, ek) => isaretYeri(bolgeIntegrali, w, h, x0, y0, hedef, kacinilacak, ek);
  /** Bloklar sırayla: her biri öbürlerinden uzak ve önceki işaretlere değmeden. */
  const blokIsaretleri = [];
  if (bloklar.length > 1) {
    const kutular = bloklar.map(payli);
    kutular.forEach((k, i) => blokIsaretleri.push(yer(k, { digerleri: kutular.filter((_, j) => j !== i), yerlesik: blokIsaretleri.filter(Boolean) })));
  }
  return {
    ozellik,
    doluluk,
    yazi: yaziKutusu,
    isaret: bloklar.length > 1 ? null : yer(yaziKutusu),
    // Bölgede birbirinden ayrık birden çok yazı bloğu varsa (iç içe geçmiş
    // balonlar tek beyaz alan görünür) her biri ayrı balon sayılır.
    bloklar: bloklar.length > 1 ? bloklar.map((b, i) => ({ kutu: payli(b), parca: b.n, isaret: blokIsaretleri[i] })) : null,
    // Çizilecek balon kutusu: gövde, yazıyı da kesinlikle kapsayacak şekilde.
    // Balona bir çizim karışmışsa (atılan çizim bloğu) gövde o çizimi de
    // içerir; beyaz zemin onu örtmesin diye yalnızca yazının çevresi.
    kutu: cizimli ? yaziKutusu : {
      x0: Math.min(gv.x0, yaziKutusu.x0),
      y0: Math.min(gv.y0, yaziKutusu.y0),
      x1: Math.max(gv.x1, yaziKutusu.x1),
      y1: Math.max(gv.y1, yaziKutusu.y1),
    },
    // Dolu şekil gövde kutusunun ~%79'u: elips; ~%95+: dikdörtgen anlatım kutusu.
    elips: !cizimli && doluluk < SEKIL.dikdortgenDoluluk,
  };
}

/** Bölge piksellerinin (durum === 2) integral görüntüsü. */
function integral(durum, w, h) {
  const I = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let satir = 0;
    for (let x = 0; x < w; x++) {
      satir += durum[y * w + x] === 2 ? 1 : 0;
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + satir;
    }
  }
  return I;
}

/**
 * İşaret dairesinin yeri (gri kopyanın pikselleriyle): çevresindeki kenarı
 * 2r+1 olan karenin tamamı bölge (beyaz balon içi) olan ve hiçbir yazı
 * kutusuyla kesişmeyen noktalardan, hedef yazının hemen üstündeki ortalı
 * olan; üstte yoksa en yakını. Yer yoksa yarıçap küçültülür. (Önceden
 * işaret yazı kutusuna göre konuyordu; çizgiye değen harfler kutunun
 * dışında kaldığında işaret dar bir balonun ilk satırının üstüne biniyor,
 * model o balonu okuyamıyordu.)
 * Ortak beyaz alanda birden çok metin varsa işaret kendi metnine öbürlerinden
 * yakın olmalı ve önceki işaretlere değmemeli (kullanıcının sayfasında iki
 * metnin işaretleri aynı yere, birinin yanına üst üste çiziliyordu); böyle
 * bir yer yoksa yalnızca yakınlık şartı bırakılır.
 * @param {{digerleri?: PikselKutu[], yerlesik?: {x: number, y: number, r: number}[]}} [ek]
 *   Aynı alandaki öbür metinlerin kutuları ve önceden konmuş işaretler.
 * @returns {{x: number, y: number, r: number} | null}
 */
function isaretYeri(I, w, h, x0, y0, hedef, kacinilacak, { digerleri = [], yerlesik = [] } = {}) {
  const dolu = (ax, ay, bx, by) =>
    I[(by + 1) * (w + 1) + bx + 1] - I[ay * (w + 1) + bx + 1] - I[(by + 1) * (w + 1) + ax] + I[ay * (w + 1) + ax];
  const yerel = (k) => ({ x0: k.x0 - x0, y0: k.y0 - y0, x1: k.x1 - x0, y1: k.y1 - y0 });
  const hd = yerel(hedef);
  const kac = kacinilacak.map(yerel);
  const diger = digerleri.map(yerel);
  const konmus = yerlesik.map((i) => ({ x: i.x - x0, y: i.y - y0, r: i.r }));
  const hcx = (hd.x0 + hd.x1) / 2;
  for (const yakinlikSarti of diger.length ? [true, false] : [false]) {
    for (const r of ISARET_YARICAPLARI) {
      let enIyi = null;
      for (let y = r; y < h - r; y++) {
        for (let x = r; x < w - r; x++) {
          if (dolu(x - r, y - r, x + r, y + r) !== (2 * r + 1) * (2 * r + 1)) continue;
          if (kac.some((k) => x + r >= k.x0 && x - r <= k.x1 && y + r >= k.y0 && y - r <= k.y1)) continue;
          if (konmus.some((i) => Math.hypot(x - i.x, y - i.y) <= r + i.r + 2)) continue;
          if (yakinlikSarti) {
            const kendi = noktaKutuUzakligi(x, y, hd);
            if (diger.some((k) => noktaKutuUzakligi(x, y, k) * YAKINLIK_ORANI <= kendi)) continue;
          }
          const ustte = y + r < hd.y0;
          const maliyet = (ustte ? hd.y0 - (y + r) : 1000 + Math.abs(y - (hd.y0 + hd.y1) / 2)) + 0.5 * Math.abs(x - hcx);
          if (!enIyi || maliyet < enIyi.m) enIyi = { m: maliyet, x, y };
        }
      }
      if (enIyi) return { x: x0 + enIyi.x, y: y0 + enIyi.y, r };
    }
  }
  return null;
}

function noktaKutuUzakligi(x, y, k) {
  return Math.hypot(Math.max(k.x0 - x, 0, x - k.x1), Math.max(k.y0 - y, 0, y - k.y1));
}

/** Bu kadar parçalı metnin yanında, onun bu oranından az parçalı bloklar leke sayılır. */
const UZUN_METIN = 10;
const LEKE_ORANI = 0.1;
/**
 * Alt alta iki satır yatayda bu orandan az örtüşüyorsa (kısa satırın
 * genişliğine göre) ayrı metinlerdir: tek metnin satırları ortalı ya da
 * sola yaslı olsa da büyük ölçüde örtüşür.
 */
const SATIR_ORTUSME = 0.3;

/**
 * Bir bloğun parçalarını satırlara ayırır ve yatayda neredeyse hiç
 * örtüşmeyen ardışık satırlardan böler. Kullanıcının sayfasında birbirine
 * değen iki balonun yazıları ("…SALDI, OK?" ile hemen altında, solda
 * başlayan "MENOU HA DETTO…") satır aralığından yakın durduğu için tek blok
 * oluyor, iki metin tek numara alıyordu.
 * @param {PikselKutu[]} parcalar
 * @param {number[]} liste  Bloğun parça sıra numaraları.
 * @returns {number[][]}
 */
function satirdanBol(parcalar, liste, harfBoyu) {
  // Harf boyunda parçalar satırları kurar; aksan, nokta gibi küçükler ve
  // tek parçalı satırlar en yakın bölüme katılır.
  const buyuk = liste.filter((i) => parcalar[i].y1 - parcalar[i].y0 + 1 >= 0.6 * harfBoyu)
    .sort((a, b) => parcalar[a].y0 + parcalar[a].y1 - parcalar[b].y0 - parcalar[b].y1);
  const satirlar = [];
  for (const i of buyuk) {
    const p = parcalar[i];
    const st = satirlar.find((s) => Math.min(s.y1, p.y1) - Math.max(s.y0, p.y0) >= 0.5 * (p.y1 - p.y0 + 1));
    if (st) {
      st.liste.push(i);
      st.x0 = Math.min(st.x0, p.x0); st.x1 = Math.max(st.x1, p.x1);
      st.y0 = Math.min(st.y0, p.y0); st.y1 = Math.max(st.y1, p.y1);
    } else satirlar.push({ liste: [i], x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 });
  }
  // Tek parçalı "satır" (aksan, leke, satıra sığmayan harf) satır sayılmaz.
  const tam = satirlar.filter((st) => st.liste.length >= 2);
  if (tam.length < 4) return [liste];
  const tamlar = new Set(tam.flatMap((st) => st.liste));
  tam.sort((a, b) => a.y0 - b.y0);
  const bolumler = [[tam[0]]];
  for (let k = 1; k < tam.length; k++) {
    const a = tam[k - 1];
    const b = tam[k];
    const ortusme = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
    const kisa = Math.min(a.x1 - a.x0, b.x1 - b.x0) + 1;
    if (ortusme < SATIR_ORTUSME * kisa) bolumler.push([b]);
    else bolumler[bolumler.length - 1].push(b);
  }
  // Her bölüm en az iki satırlı olmalı: yan yana iki sütunun satırları
  // sırayla dizilince tek satırlık bölümler çıkıyor; orada bölme yapılmaz.
  if (bolumler.length < 2 || bolumler.some((sl) => sl.length < 2)) return [liste];
  const kutular = bolumler.map((sl) => ({
    x0: Math.min(...sl.map((s) => s.x0)), y0: Math.min(...sl.map((s) => s.y0)),
    x1: Math.max(...sl.map((s) => s.x1)), y1: Math.max(...sl.map((s) => s.y1)),
  }));
  const sonuc = bolumler.map((sl) => sl.flatMap((s) => s.liste));
  for (const i of liste) {
    if (tamlar.has(i)) continue;
    const p = parcalar[i];
    let enYakin = 0;
    kutular.forEach((k, j) => {
      if (noktaKutuUzakligi((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, k) < noktaKutuUzakligi((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, kutular[enYakin])) enYakin = j;
    });
    sonuc[enYakin].push(i);
  }
  return sonuc;
}

/**
 * Delik parçalarını yazı bloklarına ayırır: genişletilmiş kutuları kesişen
 * parçalar aynı bloktadır (aynı satırda yan yana harfler ya da dar satır
 * aralığıyla alt alta satırlar; yerel OCR gruplamasıyla aynı mantık).
 * Tek parçalı ve harften küçük bloklar (gürültü) atılır; bölme belirgin
 * değilse tek blok döner.
 * @param {PikselKutu[]} parcalar
 * @param {number} harfBoyu  Ortanca parça yüksekliği.
 * @returns {PikselKutu[]}
 */
export function yaziBloklari(parcalar, harfBoyu) {
  const harfBoyundaMi = (p) => {
    const h = p.y1 - p.y0 + 1;
    return h >= harfBoyu * 0.6 && h <= harfBoyu * 1.7;
  };
  const gx = 1.6 * harfBoyu;
  // Satır aralığı çoğunlukla harf boyunun yarısından az; ayrı balonların
  // metinleri arasında ise birkaç harf boyu boşluk olur.
  const gy = 1.5 * harfBoyu;
  const ata = parcalar.map((_, i) => i);
  const bul = (i) => (ata[i] === i ? i : (ata[i] = bul(ata[i])));
  for (let i = 0; i < parcalar.length; i++) {
    const a = parcalar[i];
    for (let j = i + 1; j < parcalar.length; j++) {
      const b = parcalar[j];
      if (a.x0 - gx <= b.x1 && b.x0 - gx <= a.x1 && a.y0 - gy <= b.y1 && b.y0 - gy <= a.y1) ata[bul(i)] = bul(j);
    }
  }
  const kokler = new Map();
  parcalar.forEach((_, i) => kokler.set(bul(i), [...(kokler.get(bul(i)) ?? []), i]));
  const blokNo = new Array(parcalar.length);
  let no = 0;
  for (const liste of kokler.values()) {
    for (const parca of satirdanBol(parcalar, liste, harfBoyu)) {
      for (const i of parca) blokNo[i] = no;
      no++;
    }
  }
  const gruplar = new Map();
  parcalar.forEach((p, i) => {
    const k = blokNo[i];
    const g = gruplar.get(k);
    const harfBoyunda = harfBoyundaMi(p) ? 1 : 0;
    if (!g) gruplar.set(k, { ...p, n: 1, boy: p.y1 - p.y0 + 1, tutarli: harfBoyunda });
    else {
      g.x0 = Math.min(g.x0, p.x0);
      g.y0 = Math.min(g.y0, p.y0);
      g.x1 = Math.max(g.x1, p.x1);
      g.y1 = Math.max(g.y1, p.y1);
      g.n++;
      g.boy = Math.max(g.boy, p.y1 - p.y0 + 1);
      g.tutarli += harfBoyunda;
    }
  });
  let bloklar = [...gruplar.values()].filter((g) => g.n >= 2 || g.y1 - g.y0 + 1 >= 0.8 * harfBoyu);
  // Başka bir metnin yanında, harften kısa ya da o metne göre çok az
  // parçalı uzak bloklar leke: alt ucu açık balonda çizimin balona karışan
  // kısmı (kullanıcının sayfasında 45 parçalık metnin altında kızın
  // saçındaki 1-3 piksellik lekeler yazı kutusunu yüzüne kadar uzatıyordu).
  const enCok = Math.max(0, ...bloklar.map((g) => g.n));
  // Parçalarının çoğu harf boyunda olmayan blok da yazı değil: kullanıcının
  // sayfasında balonun üstüne çizilmiş kızın başı balonla tek alan oldu ve
  // ayrı bir "metin" bloğu sayılıp numara aldı (parçaların 4/15'i harf
  // boyunda; yazı bloğunda 22/25). Model yazıya o numarayı verdi, çeviri
  // kızın yüzüne gitti.
  const leke = (g) => g.boy < 0.6 * harfBoyu || (enCok >= UZUN_METIN && g.n < LEKE_ORANI * enCok) ||
    (g.n >= 3 && g.tutarli / g.n < SEKIL.enAzTutarlilik);
  const cizimMi = (g) => g.n >= 3 && g.tutarli / g.n < SEKIL.enAzTutarlilik;
  let cizimAtildi = false;
  if (bloklar.some((g) => !leke(g))) {
    cizimAtildi = bloklar.some((g) => cizimMi(g) && !(g.boy < 0.6 * harfBoyu));
    bloklar = bloklar.filter((g) => !leke(g));
  }
  /** Sonuca not: yazı olmayan büyük bir çizim bloğu atıldı (balona çizim karışmış). */
  const isaretle = (liste) => Object.assign(liste, { cizimAtildi });
  // Bölme yalnızca belirgin ayrı metinlerde: her blokta en az 3 parça ve en
  // çok 3 blok. Yoksa tek metin sayılır (tireli kelimeler, geniş harf
  // aralığı bir balonu küçük parçalara bölüyordu).
  if (bloklar.length > 3 || bloklar.some((g) => g.n < 3)) {
    return isaretle(bloklar.length ? [bloklar.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), n: a.n + b.n }))] : []);
  }
  return isaretle(bloklar.map(({ x0, y0, x1, y1, n }) => ({ x0, y0, x1, y1, n })));
}

/** İki piksel kutusunun kesişim alanı (uçlar dahil). */
function kesisimAlani(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1;
  return w > 0 && h > 0 ? w * h : 0;
}

function alan(k) {
  return (k.x1 - k.x0 + 1) * (k.y1 - k.y0 + 1);
}
