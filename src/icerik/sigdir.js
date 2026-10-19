// Çeviri yazısını balon kutusuna sığdırma (docs/SPEC.md §7). Arama saf;
// "sığıyor mu" ölçümü görünüm katmanında DOM ile yapılır.

/** Bundan küçük yazı okunmuyor; sığmasa da bu boyutta gösterilir. */
export const EN_KUCUK_PUNTO = 8;
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
