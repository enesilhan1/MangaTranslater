// Modelin verdiği kutuyu resimdeki gerçek balona oturtma.
//
// Görsel modeller (özellikle Claude) yazıyı doğru okuyup çevirse de kutunun
// konumunu kaba tahmin ediyor: kutu yazıdan kayıyor ya da komşu panele
// düşüyordu. Bu yüzden modelin kutusu yalnızca ipucu sayılır; asıl konum
// resmin piksellerinden bulunur:
//
// 1. Tahmini kutunun çevresinde beyaz bölgeler (balonun içi) taşma sınırlı
//    flood fill ile çıkarılır. Sınırı aşan bölge (açık uçlu balon, beyaz
//    arka plan, panel arası boşluk) balon sayılmaz.
// 2. Bölgenin içinde kalan, beyaz olmayan "delikler" yazıdır (harfler beyaz
//    zeminle çevrili). Deliği olmayan bölge balon değildir.
// 3. Tahmini kutuyla en çok örtüşen geçerli bölge seçilir; yeni kutu, o
//    balonun içindeki yazının sınırlarıdır (biraz paylı, balonun içinde).
//
// Uygun bölge bulunamazsa modelin kutusu olduğu gibi kalır. Ses efektleri
// çizimin üstünde olduğu için oturtulmaz. Saf hesaplama: gri tonlu piksel
// dizisi üzerinde çalışır (içerik betiği küçük bir analiz tuvalinden verir).

/** Bu parlaklıktan açık pikseller balon içi sayılır (JPEG gürültüsüne pay). */
export const BEYAZ_ESIGI = 190;
/** Tahmini kutunun içinde denenecek tohum noktaları (her eksende). */
const TOHUM_SAYISI = 7;
/** Bölgenin en az bu oranı tahmini kutuyla örtüşmeli. */
const EN_AZ_ORTUSME = 0.25;

/**
 * @typedef {{gri: Uint8Array, genislik: number, yukseklik: number}} GriResim
 *   Satır satır parlaklık değerleri (0 siyah, 255 beyaz).
 * @typedef {{x0: number, y0: number, x1: number, y1: number}} PikselKutu
 *   Uçlar dahil.
 */

/**
 * Balonların kutularını (0-1 oranlı) resimdeki balonlara oturtur ve aynı
 * balona düşen yinelenen kayıtları birleştirir.
 * @param {GriResim} resim
 * @param {import('./yz/cozumle.js').Balon[]} balonlar
 * @returns {import('./yz/cozumle.js').Balon[]}
 */
export function kutulariOturt(resim, balonlar) {
  const { genislik: G, yukseklik: Y } = resim;
  const etiket = new Int32Array(G * Y); // 0: bakılmadı, >0: bölge numarası
  /** Bulunan bölgeler (taşanlar null): aynı balona düşen sonraki kayıtlar da kullanır. */
  const bolgeler = new Map();
  let sonEtiket = 0;

  const oturmus = balonlar.map((b) => {
    if (b.tur === 'ses') return b;
    const tahmin = {
      x0: Math.floor(b.x * G),
      y0: Math.floor(b.y * Y),
      x1: Math.min(G - 1, Math.ceil((b.x + b.g) * G)),
      y1: Math.min(Y - 1, Math.ceil((b.y + b.h) * Y)),
    };
    const bolge = enIyiBolge(resim, etiket, bolgeler, tahmin, () => ++sonEtiket);
    if (!bolge) return b;
    const k = bolge.yazi;
    return { ...b, x: k.x0 / G, y: k.y0 / Y, g: (k.x1 - k.x0 + 1) / G, h: (k.y1 - k.y0 + 1) / Y, oturdu: true };
  });
  return yinelenenleriBirlestir(oturmus);
}

/**
 * Tahmini kutunun çevresindeki beyaz bölgelerden tahminle en çok örtüşen
 * ve içinde yazı olanı.
 */
function enIyiBolge(resim, etiket, bolgeler, tahmin, yeniEtiket) {
  const { genislik: G, yukseklik: Y } = resim;
  const tg = tahmin.x1 - tahmin.x0 + 1;
  const th = tahmin.y1 - tahmin.y0 + 1;
  const tahminAlani = tg * th;
  // Bölge en çok bu kadar büyüyebilir: tahminin birkaç katı, resmin üçte biri.
  const azamiAlan = Math.min(0.3 * G * Y, Math.max(8 * tahminAlani, 0.01 * G * Y));
  // Tohumlar tahmini kutunun biraz dışına da taşar (kayık tahmin).
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
      if (denenen.has(no)) continue;
      denenen.add(no);
      const bolge = bolgeler.get(no);
      if (!bolge) continue;
      const ortusme = kesisimAlani(bolge.kutu, tahmin) / Math.min(alan(bolge.kutu), tahminAlani);
      if (ortusme < EN_AZ_ORTUSME) continue;
      const yazi = yaziKutusu(resim, etiket, bolge);
      if (!yazi) continue;
      // Yazının tahminle örtüşmesi seçimi belirler: iki balon da tahmine
      // değiyorsa yazısı tahminin üstünde olan kazanır.
      const puan = kesisimAlani(yazi, tahmin) / alan(yazi) + ortusme;
      if (!enIyi || puan > enIyi.puan) enIyi = { puan, yazi };
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
  let tasti = false;
  while (yigin.length) {
    const p = yigin.pop();
    sayi++;
    if (sayi > azamiAlan) tasti = true; // etiketlemeye devam: başka tohum bu bölgeyi denemesin
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
  return tasti ? null : { no, kutu, alan: sayi };
}

/**
 * Bölgenin içindeki delikler (bölgeye ait olmayan ama dışarıyla bağlantısı
 * da olmayan pikseller) = yazı. Delik yoksa null. Kutu biraz paylıdır ve
 * bölgenin (balon içinin) dışına çıkmaz.
 */
function yaziKutusu(resim, etiket, bolge) {
  const G = resim.genislik;
  const { x0, y0, x1, y1 } = bolge.kutu;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 3 || h < 3) return null;
  // Bölge kutusunun kenarından, bölgeye ait olmayan piksellerle ulaşılabilen
  // her yer "dış"tır (balonun çizgisi, kuyruğu, dışarıdaki çizim).
  const dis = new Uint8Array(w * h);
  const bolgede = (lx, ly) => etiket[(y0 + ly) * G + (x0 + lx)] === bolge.no;
  const yigin = [];
  const ekle = (lx, ly) => {
    const i = ly * w + lx;
    if (!dis[i] && !bolgede(lx, ly)) {
      dis[i] = 1;
      yigin.push(i);
    }
  };
  for (let lx = 0; lx < w; lx++) {
    ekle(lx, 0);
    ekle(lx, h - 1);
  }
  for (let ly = 0; ly < h; ly++) {
    ekle(0, ly);
    ekle(w - 1, ly);
  }
  while (yigin.length) {
    const i = yigin.pop();
    const lx = i % w;
    const ly = (i - lx) / w;
    if (lx > 0) ekle(lx - 1, ly);
    if (lx < w - 1) ekle(lx + 1, ly);
    if (ly > 0) ekle(lx, ly - 1);
    if (ly < h - 1) ekle(lx, ly + 1);
  }
  let yazi = null;
  let delik = 0;
  for (let ly = 0; ly < h; ly++) {
    for (let lx = 0; lx < w; lx++) {
      if (dis[ly * w + lx] || bolgede(lx, ly)) continue;
      delik++;
      if (!yazi) yazi = { x0: lx, y0: ly, x1: lx, y1: ly };
      else {
        if (lx < yazi.x0) yazi.x0 = lx;
        if (lx > yazi.x1) yazi.x1 = lx;
        if (ly < yazi.y0) yazi.y0 = ly;
        if (ly > yazi.y1) yazi.y1 = ly;
      }
    }
  }
  // Birkaç gürültü pikseli yazı sayılmaz.
  if (!yazi || delik < Math.max(6, 0.002 * bolge.alan)) return null;
  // Yazı satırları arasına ve kenarına pay; balonun içinde kalarak.
  const pay = Math.round(Math.min(w, h) * 0.06) + 1;
  return {
    x0: x0 + Math.max(0, yazi.x0 - pay),
    y0: y0 + Math.max(0, yazi.y0 - pay),
    x1: x0 + Math.min(w - 1, yazi.x1 + pay),
    y1: y0 + Math.min(h - 1, yazi.y1 + pay),
  };
}

/**
 * Aynı balona oturan kayıtlar (model bir balonu iki kez verdiyse ya da iki
 * tahmin aynı balona düştüyse) birleştirilir: aynı çeviriyse biri atılır,
 * farklıysa çeviriler okuma sırasıyla art arda yazılır.
 */
function yinelenenleriBirlestir(balonlar) {
  const sonuc = [];
  for (const b of balonlar) {
    const es = b.oturdu && sonuc.find((s) => s.oturdu && ayniKutu(s, b));
    if (!es) {
      sonuc.push(b);
      continue;
    }
    if (es.ceviri !== b.ceviri) {
      es.ceviri = `${es.ceviri} ${b.ceviri}`;
      es.orijinal = `${es.orijinal} ${b.orijinal}`;
    }
  }
  return sonuc;
}

function ayniKutu(a, b) {
  const k = kesisimAlani(
    { x0: a.x, y0: a.y, x1: a.x + a.g, y1: a.y + a.h },
    { x0: b.x, y0: b.y, x1: b.x + b.g, y1: b.y + b.h },
    0,
  );
  return k / Math.min(a.g * a.h, b.g * b.h) > 0.7;
}

/** İki kutunun kesişim alanı ([uc]=1: uçlar dahil piksel kutuları). */
function kesisimAlani(a, b, uc = 1) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + uc;
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + uc;
  return w > 0 && h > 0 ? w * h : 0;
}

function alan(k) {
  return (k.x1 - k.x0 + 1) * (k.y1 - k.y0 + 1);
}
