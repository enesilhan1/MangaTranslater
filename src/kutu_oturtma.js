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
  enCokDelik: 0.45,
  /** En büyük tek delik parçası bölgenin bu oranından geniş/uzun olamaz (harf ≠ çizim çizgisi). */
  enBuyukParca: 0.5,
  /** Yazı balonun kenarına yapışık olamaz: her kenarda en az bu oranda boşluk. */
  kenarBoslugu: 0.03,
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
   * Çok sayıda minik parça tram dokusu/korkuluktur: parça sayısı bundan
   * fazla ve ortanca parça boyu en çok enKucukHarf pikselse balon değil.
   * (Kullanıcının sayfasında yanlış bulguda 122 parça, ortanca boy 1 px;
   * uzun yazılı gerçek balonda harfler ~10 px.)
   */
  enCokParca: 60,
  enKucukHarf: 3,
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
 * @typedef {{kutu: PikselKutu, yazi: PikselKutu, elips: boolean}} BulunanBalon
 *   Balonun içi, içindeki yazının sınırları (gri resmin pikselleriyle) ve
 *   şekli (oval mi, dikdörtgen anlatım kutusu mu).
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
      if (sonuc.yazi) bulunan.push({ kutu: sonuc.kutu, yazi: sonuc.yazi, elips: sonuc.elips });
    }
  }
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
 *   o balona eklenir. Baştan numarasız gelen metin hiçbir zaman başka
 *   metinle birleştirilmez ("... vardır. AH" hatası).
 * Sonuç girdinin sırasını korur.
 * @param {GriResim} resim
 * @param {import('./yz/cozumle.js').Balon[]} balonlar  0-1 oranlı.
 * @param {BulunanBalon[]} [bulunanlar]  İşaretlenen balonlar (numara sırasıyla).
 */
export function kutulariOturt(resim, balonlar, bulunanlar = []) {
  const { genislik: G, yukseklik: Y } = resim;
  const oran = (k) => ({ x: k.x0 / G, y: k.y0 / Y, g: (k.x1 - k.x0 + 1) / G, h: (k.y1 - k.y0 + 1) / Y });
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
    const n = Number.isInteger(b.bolge) && b.bolge >= 1 && b.bolge <= bulunanlar.length ? b.bolge : 0;
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
    sonuc[i] = { ...balonlar[i], ...oran(bb.yazi), balon: { ...oran(bb.kutu), elips: bb.elips }, oturdu: true };
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
  numarasiz.sort((a, b) => a - b);
  for (const i of numarasiz) {
    const b = balonlar[i];
    if (b.tur === 'ses') {
      sonuc[i] = b;
      continue;
    }
    const tahmin = tahminKutusu(b);
    const secilen = enIyiBolge(resim, etiket, bolgeler, kullanilan, tahmin, () => ++sonEtiket);
    if (secilen) {
      kullanilan.add(secilen.no);
      sonuc[i] = { ...b, ...oran(secilen.yazi), balon: { ...oran(secilen.kutu), elips: secilen.elips }, oturdu: true, bolge: 0 };
      continue;
    }
    // Aynı numarayı alıp tahmini de o balonun içindeyse aynı balonun devamıdır.
    const n = yerinden.get(i);
    if (n && kesisimAlani(bulunanlar[n - 1].kutu, tahmin) / alan(tahmin) >= 0.5) {
      const hi = atanan.get(n).i;
      const hedef = sonuc[hi];
      if (hedef.ceviri !== b.ceviri) {
        // Okuma sırası: girdide önce gelen önce yazılır.
        const [ilk, son] = i < hi ? [b, hedef] : [hedef, b];
        hedef.ceviri = `${ilk.ceviri} ${son.ceviri}`;
        hedef.orijinal = `${ilk.orijinal} ${son.orijinal}`;
      }
      continue;
    }
    sonuc[i] = b;
  }
  return sonuc.filter(Boolean);
}

/**
 * Tahmini kutunun çevresindeki geçerli balonlardan tahminle en çok
 * örtüşen ve henüz kullanılmamış olanı.
 */
function enIyiBolge(resim, etiket, bolgeler, kullanilan, tahmin, yeniEtiket) {
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
      if (denenen.has(no) || kullanilan.has(no)) continue;
      denenen.add(no);
      const bolge = bolgeler.get(no);
      if (!bolge || bolge.alan > azamiAlan) continue;
      const ortusme = kesisimAlani(bolge.kutu, tahmin) / Math.min(alan(bolge.kutu), tahminAlani);
      if (ortusme < EN_AZ_ORTUSME) continue;
      const bulgu = balonMu(resim, etiket, bolge);
      if (!bulgu.yazi) continue;
      const { yazi } = bulgu;
      const puan = kesisimAlani(yazi, tahmin) / alan(yazi) + ortusme;
      if (!enIyi || puan > enIyi.puan) enIyi = { puan, yazi, no, kutu: bulgu.kutu, elips: bulgu.elips };
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
  /** Parçaların yükseklikleri (harf boyu tutarlılığı için). */
  const parcaBoylari = [];
  for (let i = 0; i < w * h; i++) {
    if (durum[i] !== 0) continue;
    parcaSayisi++;
    const p = { x0: w, y0: h, x1: -1, y1: -1 };
    durum[i] = 3;
    yigin.push(i);
    while (yigin.length) {
      const j = yigin.pop();
      delik++;
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
  if (delikOrani < SEKIL.enAzDelik || delikOrani > SEKIL.enCokDelik) return { sebep: `delik ${delikOrani.toFixed(3)}` };
  if (parcaSayisi < 2 && (yazi.x1 - yazi.x0 + 1) > 0.35 * w) return { sebep: 'tek leke' };
  if (enBuyukG > SEKIL.enBuyukParca * w && enBuyukH > SEKIL.enBuyukParca * h) return { sebep: 'büyük parça' };
  const sirali = [...parcaBoylari].sort((a, b) => a - b);
  const ortanca = sirali[sirali.length >> 1];
  if (parcaSayisi > SEKIL.enCokParca && ortanca <= SEKIL.enKucukHarf) {
    return { sebep: `tram: ${parcaSayisi} parça, boy ${ortanca}` };
  }
  const tutarli = parcaBoylari.filter((b) => b >= ortanca * 0.6 && b <= ortanca * 1.7).length / parcaSayisi;
  if (tutarli < SEKIL.enAzTutarlilik) return { sebep: `tutarlılık ${tutarli.toFixed(2)}` };
  const kenar = Math.max(1, Math.round(SEKIL.kenarBoslugu * Math.min(w, h)));
  if (yazi.x0 < kenar || yazi.y0 < kenar || yazi.x1 > w - 1 - kenar || yazi.y1 > h - 1 - kenar) return { sebep: 'kenarda yazı' };

  // Yazı satırları arasına ve kenarına pay; balonun içinde kalarak.
  const pay = Math.round(Math.min(w, h) * 0.06) + 1;
  const ozellik = {
    parca: parcaSayisi,
    delik: +delikOrani.toFixed(3),
    doluluk: +doluluk.toFixed(2),
    ortancaBoy: +(ortanca / h).toFixed(3),
    tutarli: +tutarli.toFixed(2),
    yaziOrani: +(((yazi.x1 - yazi.x0 + 1) * (yazi.y1 - yazi.y0 + 1)) / (w * h)).toFixed(2),
  };
  const yaziKutusu = {
    x0: x0 + Math.max(0, yazi.x0 - pay),
    y0: y0 + Math.max(0, yazi.y0 - pay),
    x1: x0 + Math.min(w - 1, yazi.x1 + pay),
    y1: y0 + Math.min(h - 1, yazi.y1 + pay),
  };
  return {
    ozellik,
    doluluk,
    yazi: yaziKutusu,
    // Çizilecek balon kutusu: gövde, yazıyı da kesinlikle kapsayacak şekilde.
    kutu: {
      x0: Math.min(gv.x0, yaziKutusu.x0),
      y0: Math.min(gv.y0, yaziKutusu.y0),
      x1: Math.max(gv.x1, yaziKutusu.x1),
      y1: Math.max(gv.y1, yaziKutusu.y1),
    },
    // Dolu şekil gövde kutusunun ~%79'u: elips; ~%95+: dikdörtgen anlatım kutusu.
    elips: doluluk < SEKIL.dikdortgenDoluluk,
  };
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
