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
 * @typedef {{kutu: PikselKutu, yazi: PikselKutu}} BulunanBalon
 *   Balonun içi ve içindeki yazının sınırları (gri resmin pikselleriyle).
 */

/**
 * Resimdeki kapalı balonları bulur; okuma sırasıyla (yukarıdan aşağı, aynı
 * hizada soldan sağa) numaralanacak şekilde sıralı.
 * @param {GriResim} resim
 * @returns {BulunanBalon[]}
 */
export function balonlariBul(resim) {
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
      if (etiket[p] !== 0 || gri[p] < BEYAZ_ESIGI) continue;
      const bolge = doldur(resim, etiket, x, y, ++no, azamiAlan);
      if (!bolge || bolge.alan < enAzAlan) continue;
      if (bolge.kutu.x1 - bolge.kutu.x0 + 1 < SEKIL.enAzGenislik * G) continue;
      const yazi = balonMu(resim, etiket, bolge);
      if (yazi) bulunan.push({ kutu: bolge.kutu, yazi });
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
 *   balondaki yazının sınırlarıdır. Aynı balona düşen kayıtlar birleşir
 *   (aynı çeviri bir kez; farklıysa okuma sırasıyla art arda).
 * - Numarasız kayıtlar (ses efektleri hariç) tahmini kutuya en uygun,
 *   başka kayda verilmemiş geçerli balona oturtulur; yoksa olduğu gibi kalır.
 *   Farklı metinler hiçbir zaman birleştirilmez.
 * @param {GriResim} resim
 * @param {import('./yz/cozumle.js').Balon[]} balonlar  0-1 oranlı.
 * @param {BulunanBalon[]} [bulunanlar]  İşaretlenen balonlar (numara sırasıyla).
 */
export function kutulariOturt(resim, balonlar, bulunanlar = []) {
  const { genislik: G, yukseklik: Y } = resim;
  const oran = (k) => ({ x: k.x0 / G, y: k.y0 / Y, g: (k.x1 - k.x0 + 1) / G, h: (k.y1 - k.y0 + 1) / Y });

  /** bulunan balon numarası → sonuç kaydı */
  const dolu = new Map();
  const sonuc = [];
  const numarasiz = [];
  for (const b of balonlar) {
    const n = Number.isInteger(b.bolge) && b.bolge >= 1 && b.bolge <= bulunanlar.length ? b.bolge : 0;
    if (!n || b.tur === 'ses') {
      numarasiz.push(b);
      continue;
    }
    const es = dolu.get(n);
    if (es) {
      if (es.ceviri !== b.ceviri) {
        es.ceviri = `${es.ceviri} ${b.ceviri}`;
        es.orijinal = `${es.orijinal} ${b.orijinal}`;
      }
      continue;
    }
    const kayit = { ...b, ...oran(bulunanlar[n - 1].yazi), oturdu: true };
    dolu.set(n, kayit);
    sonuc.push(kayit);
  }

  // Numarasızlar: işaretlenen balonların içleri başka kayda verilemesin diye
  // önce etiketlenir.
  const etiket = new Int32Array(G * Y);
  const bolgeler = new Map();
  let sonEtiket = 0;
  const kullanilan = new Set();
  for (const [n] of dolu) {
    const k = bulunanlar[n - 1].kutu;
    const cx = Math.round((k.x0 + k.x1) / 2);
    // Balonun içinden bir beyaz piksel bul ve bölgeyi "kullanıldı" işaretle.
    for (let y = k.y0; y <= k.y1; y++) {
      const p = y * G + cx;
      if (resim.gri[p] >= BEYAZ_ESIGI && etiket[p] === 0) {
        const no = ++sonEtiket;
        bolgeler.set(no, doldur(resim, etiket, cx, y, no, SEKIL.enCokAlan * G * Y));
        kullanilan.add(no);
        break;
      }
    }
  }
  for (const b of numarasiz) {
    if (b.tur === 'ses') {
      sonuc.push(b);
      continue;
    }
    const tahmin = {
      x0: Math.floor(b.x * G),
      y0: Math.floor(b.y * Y),
      x1: Math.min(G - 1, Math.ceil((b.x + b.g) * G)),
      y1: Math.min(Y - 1, Math.ceil((b.y + b.h) * Y)),
    };
    const secilen = enIyiBolge(resim, etiket, bolgeler, kullanilan, tahmin, () => ++sonEtiket);
    if (!secilen) {
      sonuc.push(b);
      continue;
    }
    kullanilan.add(secilen.no);
    sonuc.push({ ...b, ...oran(secilen.yazi), oturdu: true });
  }
  return sonuc;
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
  // Bölge tahminin birkaç katından büyük olamaz (çizimdeki büyük beyaz alanlar).
  const azamiAlan = Math.min(SEKIL.enCokAlan * G * Y, Math.max(4 * tahminAlani, 0.01 * G * Y));
  const pay = 0.25;
  let enIyi = null;
  const denenen = new Set();
  for (let i = 0; i < TOHUM_SAYISI; i++) {
    for (let j = 0; j < TOHUM_SAYISI; j++) {
      const x = Math.round(tahmin.x0 - pay * tg + ((1 + 2 * pay) * tg * (i + 0.5)) / TOHUM_SAYISI);
      const y = Math.round(tahmin.y0 - pay * th + ((1 + 2 * pay) * th * (j + 0.5)) / TOHUM_SAYISI);
      if (x < 0 || y < 0 || x >= G || y >= Y) continue;
      const p = y * G + x;
      if (resim.gri[p] < BEYAZ_ESIGI) continue;
      let no = etiket[p];
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
      const yazi = balonMu(resim, etiket, bolge);
      if (!yazi) continue;
      const puan = kesisimAlani(yazi, tahmin) / alan(yazi) + ortusme;
      if (!enIyi || puan > enIyi.puan) enIyi = { puan, yazi, no };
    }
  }
  return enIyi;
}

/**
 * (x, y)'den başlayan beyaz bölgeyi doldurur (4 komşuluk). Bölge [azamiAlan]'ı
 * aşarsa null (balon değil). Doldurulan pikseller etiketlenir; aynı bölge
 * başka tohumdan tekrar doldurulmaz.
 */
function doldur(resim, etiket, x, y, no, azamiAlan) {
  const { gri, genislik: G, yukseklik: Y } = resim;
  const yigin = [y * G + x];
  etiket[y * G + x] = no;
  const kutu = { x0: x, y0: y, x1: x, y1: y };
  let sayi = 0;
  while (yigin.length) {
    const p = yigin.pop();
    sayi++;
    const px = p % G;
    const py = (p - px) / G;
    if (px < kutu.x0) kutu.x0 = px;
    if (px > kutu.x1) kutu.x1 = px;
    if (py < kutu.y0) kutu.y0 = py;
    if (py > kutu.y1) kutu.y1 = py;
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
  // Taşan bölge de etiketli kalır: başka tohum onu tekrar denemesin.
  return sayi > azamiAlan ? null : { no, kutu, alan: sayi };
}

/**
 * Bölge bir balon mu? Balonsa içindeki yazının (biraz paylı, balonun
 * içinde kalan) sınırlarını, değilse null döndürür. Delikler = bölgeye ait
 * olmayan ama bölge kutusunun kenarından da ulaşılamayan pikseller.
 */
function balonMu(resim, etiket, bolge) {
  const G = resim.genislik;
  const { x0, y0, x1, y1 } = bolge.kutu;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 12 || h < 12) return null;
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
    yazi = yazi
      ? { x0: Math.min(yazi.x0, p.x0), y0: Math.min(yazi.y0, p.y0), x1: Math.max(yazi.x1, p.x1), y1: Math.max(yazi.y1, p.y1) }
      : p;
  }
  if (!yazi) return null;

  const doluSekil = bolge.alan + delik;
  if (doluSekil / (w * h) < SEKIL.enAzDoluluk) return null;
  const delikOrani = delik / doluSekil;
  if (delikOrani < SEKIL.enAzDelik || delikOrani > SEKIL.enCokDelik) return null;
  if (parcaSayisi < 2 && (yazi.x1 - yazi.x0 + 1) > 0.35 * w) return null; // tek büyük leke
  if (enBuyukG > SEKIL.enBuyukParca * w && enBuyukH > SEKIL.enBuyukParca * h) return null;
  const kenar = Math.max(1, Math.round(SEKIL.kenarBoslugu * Math.min(w, h)));
  if (yazi.x0 < kenar || yazi.y0 < kenar || yazi.x1 > w - 1 - kenar || yazi.y1 > h - 1 - kenar) return null;

  // Yazı satırları arasına ve kenarına pay; balonun içinde kalarak.
  const pay = Math.round(Math.min(w, h) * 0.06) + 1;
  return {
    x0: x0 + Math.max(0, yazi.x0 - pay),
    y0: y0 + Math.max(0, yazi.y0 - pay),
    x1: x0 + Math.min(w - 1, yazi.x1 + pay),
    y1: y0 + Math.min(h - 1, yazi.y1 + pay),
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
