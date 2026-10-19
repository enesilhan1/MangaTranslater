// Hangi resimlerin çevrileceği (docs/SPEC.md §5): yalnızca manga sayfası
// olabilecek kadar büyük olanlar. İkonlar, avatarlar, kapak küçük
// resimleri, reklam afişleri atlanır.

/** Resmin kendi (dosyadaki) boyutu en az bu olmalı. */
export const EN_AZ_DOGAL = { genislik: 400, yukseklik: 400 };
/** Sayfada gösteriliyorsa en az bu genişlikte görünmeli. */
export const EN_AZ_GORUNEN_GENISLIK = 250;
/** Yatayda bu kadar basık resimler afiş/banner'dır. */
const EN_FAZLA_YATAY_ORAN = 2.5;

/**
 * @param {{dogalGenislik: number, dogalYukseklik: number,
 *   gorunenGenislik: number, gorunuyorMu: boolean}} r
 *   [gorunuyorMu] false: display:none gibi yerleşimi olmayan (önceden
 *   yüklenmiş sonraki sayfalar); bunlarda yalnızca doğal boyuta bakılır.
 */
export function adayMi({ dogalGenislik, dogalYukseklik, gorunenGenislik, gorunuyorMu }) {
  if (dogalGenislik < EN_AZ_DOGAL.genislik || dogalYukseklik < EN_AZ_DOGAL.yukseklik) return false;
  if (dogalGenislik / dogalYukseklik > EN_FAZLA_YATAY_ORAN) return false;
  if (gorunuyorMu && gorunenGenislik < EN_AZ_GORUNEN_GENISLIK) return false;
  return true;
}
