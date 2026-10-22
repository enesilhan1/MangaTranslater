// Koyu zeminli yazıları (siyah balondaki beyaz harfler, beyaz haleli koyu
// harfler) piksellerden bulur. Beyaz balon bulma (kutu_oturtma.js) bunları
// göremiyor, yerel OCR de bu yazı tiplerini neredeyse hiç okuyamıyor;
// kullanıcının sayfasında (8fb3ebce…/29) üç siyah balonun çevirisi modelin
// kayık kutularında kalıyordu. Bulunan bloklar beyaz balonlar gibi numara
// alır; çeviri koyu zeminle bloğun üstüne yazılır.

/**
 * Ayarlar. Kayıtlı 32 sayfada (siyah balonsuz) hiç bulgu yok; eşiğe en
 * yakın yanlış aday dış koyuluğu 0,50, gerçek siyah balonlar 0,89-0,90.
 */
export const TERS = Object.freeze({
  /** Bundan parlak piksel açık, karanlik'tan koyu piksel koyu sayılır. */
  parlak: 190,
  karanlik: 80,
  /** Harf adayının sınır komşularının en az bu oranı karşıt renkte. */
  sinirOrani: 0.6,
  /** Harf boyu (gri px) en az bu, en çok resim yüksekliğinin bu oranı. */
  enAzBoy: 4,
  enCokBoy: 0.05,
  /** Bundan büyük bağlı parça harf değil (zemin, çizim). */
  enCokAlan: 600,
  /** Blokta en az bu kadar harf; boy tutarlılığı ve satır komşuluğu oranları. */
  enAzParca: 6,
  enAzTutarlilik: 0.6,
  enAzKomsuluk: 0.6,
  /**
   * Bloğun çevresindeki (bir harf boyu kalınlığında) bandın en az bu oranı
   * disEsik'ten koyu olmalı: beyaz zemindeki sıradan yazılar elenir.
   */
  enAzDisKoyu: 0.7,
  disEsik: 120,
  /**
   * Koyu zeminde açık parçalı blokta parça genişliklerinin değişkenlik
   * katsayısı en çok bu: harfler benzer genişlikte; koyu çizimdeki açık
   * desenler (dikey çizgiler, perçinler, yıldız, göz) uzun ve kısa
   * parçaların karışımı. Boruto taramasında gerçek açık yazılarda ≤0,30,
   * yanlış bulgularda ≥0,39. Beyaz haleli koyu harflerde (siyah balon)
   * değişkenlik 0,38-0,44 olduğu için o kutupta uygulanmaz.
   */
  enCokGenislikDegiskenligi: 0.35,
});

/**
 * Sınırı karşıt renkte olan küçük bağlı parçalar: koyu zemindeki açık harf
 * ya da açık haleli koyu harf.
 * @param {import('./kutu_oturtma.js').GriResim} resim
 */
function harfAdaylari({ gri, genislik: G, yukseklik: Y }) {
  const sonuc = [];
  const yigin = [];
  for (const kutup of ['acik', 'koyu']) {
    const icinde = kutup === 'acik' ? (v) => v >= TERS.parlak : (v) => v < TERS.karanlik;
    const karsit = kutup === 'acik' ? (v) => v < TERS.karanlik + 40 : (v) => v >= TERS.parlak - 40;
    const etiket = new Uint8Array(G * Y);
    for (let p0 = 0; p0 < G * Y; p0++) {
      if (etiket[p0] || !icinde(gri[p0])) continue;
      let x0 = G, y0 = Y, x1 = -1, y1 = -1, alan = 0, sinir = 0, karsiSinir = 0, kenar = false;
      etiket[p0] = 1;
      yigin.push(p0);
      while (yigin.length) {
        const p = yigin.pop();
        const x = p % G;
        const y = (p - x) / G;
        alan++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (x === 0 || y === 0 || x === G - 1 || y === Y - 1) kenar = true;
        for (const q of [x > 0 ? p - 1 : -1, x < G - 1 ? p + 1 : -1, y > 0 ? p - G : -1, y < Y - 1 ? p + G : -1]) {
          if (q < 0) continue;
          if (icinde(gri[q])) {
            if (!etiket[q]) {
              etiket[q] = 1;
              yigin.push(q);
            }
          } else {
            sinir++;
            if (karsit(gri[q])) karsiSinir++;
          }
        }
      }
      const w = x1 - x0 + 1;
      const h = y1 - y0 + 1;
      if (kenar || alan > TERS.enCokAlan || h < TERS.enAzBoy || h > TERS.enCokBoy * Y || w > 3 * h || w * h < 6) continue;
      if (karsiSinir < TERS.sinirOrani * sinir) continue;
      sonuc.push({ x0, y0, x1, y1, h, kutup });
    }
  }
  return sonuc;
}

/** Parça genişliklerinin değişkenlik katsayısı (standart sapma / ortalama). */
function genislikDegiskenligi(ps) {
  const w = ps.map((p) => p.x1 - p.x0 + 1);
  const ort = w.reduce((t, v) => t + v, 0) / w.length;
  return Math.sqrt(w.reduce((t, v) => t + (v - ort) ** 2, 0) / w.length) / ort;
}

/** Parçaların satır sayısı (dikeyde örtüşenler aynı satır). */
function satirSayisi(ps) {
  const satirlar = [];
  for (const p of [...ps].sort((a, b) => a.y0 - b.y0)) {
    const s = satirlar.find((t) => Math.min(t.y1, p.y1) - Math.max(t.y0, p.y0) >= 0.5 * p.h);
    if (s) s.y1 = Math.max(s.y1, p.y1);
    else satirlar.push({ y0: p.y0, y1: p.y1 });
  }
  return satirlar.length;
}

/**
 * Yan yana iki yazı (kullanıcının sayfasında "…AND ALL THEIR ALLIES!" ile
 * "I'LL KILL BALMUNG…") tek blok olur; bütün satırlar boyunca boş kalan
 * dikey bir oluktan (en az yarım harf boyu) ayrılır. Her iki yan da en az
 * iki satırlı olmalı: tek satırlık yazı kelimelerinden bölünmesin.
 */
function sutunlaraBol(ps) {
  const boylar = ps.map((p) => p.h).sort((a, b) => a - b);
  const ort = boylar[boylar.length >> 1];
  const sirali = [...ps].sort((a, b) => a.x0 - b.x0);
  const sutunlar = [[sirali[0]]];
  let sag = sirali[0].x1;
  for (const p of sirali.slice(1)) {
    if (p.x0 - sag >= 0.5 * ort) sutunlar.push([p]);
    else sutunlar[sutunlar.length - 1].push(p);
    sag = Math.max(sag, p.x1);
  }
  if (sutunlar.length < 2 || sutunlar.some((s) => satirSayisi(s) < 2)) return [ps];
  return sutunlar;
}

/**
 * Koyu zeminli yazı blokları, beyaz balon bulgularıyla aynı biçimde (ters:
 * true). [mevcut] balonların içindeki bloklar atlanır.
 * @param {import('./kutu_oturtma.js').GriResim} resim
 * @param {import('./kutu_oturtma.js').BulunanBalon[]} [mevcut]
 * @returns {import('./kutu_oturtma.js').BulunanBalon[]}
 */
export function tersYazilariBul(resim, mevcut = []) {
  const { gri, genislik: G, yukseklik: Y } = resim;
  const parcalar = harfAdaylari(resim);
  // Aynı satırdaki harfler (arası en çok bir harf boyu) ve dar satır
  // aralığıyla alt alta satırlar aynı blokta.
  const ata = parcalar.map((_, i) => i);
  const bul = (i) => (ata[i] === i ? i : (ata[i] = bul(ata[i])));
  for (let i = 0; i < parcalar.length; i++) {
    for (let j = i + 1; j < parcalar.length; j++) {
      const a = parcalar[i];
      const c = parcalar[j];
      if (a.kutup !== c.kutup) continue;
      const h = Math.max(a.h, c.h);
      if (Math.min(a.h, c.h) < 0.5 * h) continue;
      if (Math.max(c.x0 - a.x1, a.x0 - c.x1) <= h && Math.max(c.y0 - a.y1, a.y0 - c.y1) <= 0.7 * h) ata[bul(i)] = bul(j);
    }
  }
  const gruplar = new Map();
  parcalar.forEach((p, i) => gruplar.set(bul(i), [...(gruplar.get(bul(i)) ?? []), p]));

  const sonuc = [];
  for (const ps of [...gruplar.values()].flatMap(sutunlaraBol)) {
    if (ps.length < TERS.enAzParca) continue;
    const boylar = ps.map((p) => p.h).sort((a, b) => a - b);
    const ort = boylar[boylar.length >> 1];
    const tutarli = ps.filter((p) => p.h >= 0.6 * ort && p.h <= 1.7 * ort).length / ps.length;
    if (tutarli < TERS.enAzTutarlilik) continue;
    // Harfin satırda yanında başka harf var mı (gürültü dağınık durur).
    const komsulu = ps.filter((p) => ps.some((q) => q !== p &&
      Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) >= 0.5 * Math.min(p.h, q.h) &&
      Math.max(q.x0 - p.x1, p.x0 - q.x1) <= Math.max(p.h, q.h))).length / ps.length;
    if (komsulu < TERS.enAzKomsuluk) continue;
    if (ps[0].kutup === 'acik' && genislikDegiskenligi(ps) > TERS.enCokGenislikDegiskenligi) continue;
    const k = {
      x0: Math.min(...ps.map((p) => p.x0)), y0: Math.min(...ps.map((p) => p.y0)),
      x1: Math.max(...ps.map((p) => p.x1)), y1: Math.max(...ps.map((p) => p.y1)),
    };
    if (k.x1 - k.x0 + 1 < 3 * ort) continue;
    const cx = (k.x0 + k.x1) / 2;
    const cy = (k.y0 + k.y1) / 2;
    if (mevcut.some(({ kutu: m }) => cx >= m.x0 && cx <= m.x1 && cy >= m.y0 && cy <= m.y1)) continue;
    let koyu = 0;
    let top = 0;
    for (let y = Math.max(0, k.y0 - ort); y <= Math.min(Y - 1, k.y1 + ort); y++) {
      for (let x = Math.max(0, k.x0 - ort); x <= Math.min(G - 1, k.x1 + ort); x++) {
        if (x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1) continue;
        top++;
        if (gri[y * G + x] < TERS.disEsik) koyu++;
      }
    }
    if (!top || koyu < TERS.enAzDisKoyu * top) continue;
    // Zemin harflerin halesini de örtsün; işaret bloğun hemen üstünde (yer
    // yoksa altında), koyu zeminde.
    const pay = Math.max(1, Math.round(0.3 * ort));
    const kutu = { x0: Math.max(0, k.x0 - pay), y0: Math.max(0, k.y0 - pay), x1: Math.min(G - 1, k.x1 + pay), y1: Math.min(Y - 1, k.y1 + pay) };
    const r = Math.max(4, Math.round(0.9 * ort));
    const ust = kutu.y0 - r - 1;
    const isaret = { x: Math.round(cx), y: ust - r >= 0 ? ust : Math.min(Y - 1 - r, kutu.y1 + r + 1), r };
    sonuc.push({ kutu, yazi: k, elips: false, ters: true, parca: ps.length, isaret });
  }
  return sonuc;
}
