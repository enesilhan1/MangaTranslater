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
