// Çeviri yazısını balon kutusuna sığdırma (docs/SPEC.md §7). Arama saf;
// "sığıyor mu" ölçümü görünüm katmanında DOM ile yapılır.

/** Bundan küçük yazı okunmuyor; sığmasa da bu boyutta gösterilir. */
export const EN_KUCUK_PUNTO = 8;
/**
 * Son çare: şekilli balonda EN_KUCUK_PUNTO'da bile sığmayan yazı kesilmesin
 * diye bu boyuta kadar inilir (gorunum.js _sonCare).
 */
export const ACIL_PUNTO = 6;
/** Çok büyük balonda bile yazı bundan büyük olmasın. */
export const EN_BUYUK_PUNTO = 42;

/**
 * Kutunun boyutuna göre denenecek en büyük punto: kutu yüksekliğinin
 * yarısı (tek satırlık kısa yazı da kutuyu dev harflerle doldurmasın).
 */
export function puntoUstSiniri(kutuYuksekligi) {
  return Math.max(EN_KUCUK_PUNTO, Math.min(EN_BUYUK_PUNTO, Math.floor(kutuYuksekligi * 0.5)));
}

/**
 * Orijinal yazının kutudaki tahmini puntosu. Bir harf yaklaşık 0,6 punto
 * genişliğinde, satır 1,15 punto yüksekliğinde; yazı kutunun yaklaşık
 * yarısını kaplar (kenar boşluğu, satır sonları). Katsayı test sayfasıyla
 * ayarlandı: 228x112 px kutuda 27 harflik 26,7 px'lik yazı → tahmin 26 px.
 * Çeviri bundan en çok %15 büyük yazılır; aksi halde kısa bir çeviri balonu
 * dev harflerle doldurup orijinalden çok daha iri görünüyordu.
 */
export const DOLULUK = 0.5;

export function orijinalPuntosu(genislik, yukseklik, harfSayisi) {
  const n = Math.max(4, harfSayisi);
  return Math.sqrt((DOLULUK * genislik * yukseklik) / (n * 0.6 * 1.15));
}

/** Denenecek en büyük punto: kutu sınırı ile orijinal yazı boyutunun küçüğü. */
export function puntoTavani(genislik, yukseklik, harfSayisi) {
  const tavan = Math.min(puntoUstSiniri(yukseklik), Math.floor(orijinalPuntosu(genislik, yukseklik, harfSayisi) * 1.15));
  return Math.max(EN_KUCUK_PUNTO, tavan);
}

/**
 * [enAz, enCok] arasında sigarMi'nin doğru olduğu en büyük tam sayı punto
 * (ikili arama; sığma punto küçüldükçe bozulmaz varsayılır). Hiçbiri
 * sığmıyorsa enAz.
 * @param {(punto: number) => boolean} sigarMi
 */
export function puntoBul(sigarMi, enAz = EN_KUCUK_PUNTO, enCok = EN_BUYUK_PUNTO) {
  let alt = enAz;
  let ust = enCok;
  let enIyi = enAz;
  while (alt <= ust) {
    const orta = (alt + ust) >> 1;
    if (sigarMi(orta)) {
      enIyi = orta;
      alt = orta + 1;
    } else {
      ust = orta - 1;
    }
  }
  return enIyi;
}

/**
 * Büyütülen kutuyu komşu kutulara değmeyecek şekilde kırpar. Kutular
 * {x, y, g, h} (0-1). Komşu hangi yandaysa kutunun o kenarı komşunun
 * kenarına çekilir. Asıl kutuyla zaten biraz kesişen komşuda kenar
 * kesişmenin ortasına çekilir (iki kutu da büyürken kesişmeyi paylaşır).
 * Biri öbürünü içine alıyorsa komşu yok sayılır.
 * Kullanıcının sayfasında yan yana iki anlatımın kutuları %30 büyürken
 * birbirinin üstüne çıkıp yazıları kesiyordu; aralarında boşluk olmayan
 * iki anlatımın kutuları ise paylarından ötürü zaten birkaç piksel
 * kesiştiği için hiç kırpılmıyordu.
 * @returns {{x: number, y: number, g: number, h: number}}
 */
export function buyumeyiKirp(buyuk, ozgun, digerleri) {
  const kenar = (k) => ({ x0: k.x, y0: k.y, x1: k.x + k.g, y1: k.y + k.h });
  const b = kenar(buyuk);
  const o = kenar(ozgun);
  const kesisir = (a, c) => a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1;
  const icerir = (a, c) => a.x0 <= c.x0 && a.y0 <= c.y0 && a.x1 >= c.x1 && a.y1 >= c.y1;
  for (const d of digerleri.map(kenar)) {
    if (!kesisir(b, d) || icerir(d, o) || icerir(o, d)) continue;
    // Komşunun asıl kutuya göre yönü; çaprazsa aradaki boşluğu (ya da
    // kesişmesi az olan) eksen.
    const sag = d.x0 - o.x1;
    const sol = o.x0 - d.x1;
    const alt = d.y0 - o.y1;
    const ust = o.y0 - d.y1;
    const yatay = Math.max(sag, sol);
    const dikey = Math.max(alt, ust);
    // Yeni kenar: komşunun kenarı; kesişiyorlarsa kesişmenin ortası.
    const sinir = (asil, komsu, bosluk) => (bosluk >= 0 ? komsu : (asil + komsu) / 2);
    if (yatay >= dikey) {
      if (sag >= sol) b.x1 = Math.min(b.x1, sinir(o.x1, d.x0, sag));
      else b.x0 = Math.max(b.x0, sinir(o.x0, d.x1, sol));
    } else if (alt >= ust) b.y1 = Math.min(b.y1, sinir(o.y1, d.y0, alt));
    else b.y0 = Math.max(b.y0, sinir(o.y0, d.y1, ust));
  }
  // Kırpılan kutu asıl kutudan en çok kesişmenin yarısı kadar küçülür.
  return { x: b.x0, y: b.y0, g: b.x1 - b.x0, h: b.y1 - b.y0 };
}
