// OCR öncesi resim hazırlığının saf (test edilebilir) kısmı.

/** Büyütmeden sonra resmin geçmeyeceği piksel sayısı (OCR süresi bununla artar). */
const AZAMI_PIKSEL = 4_000_000;

/**
 * Tesseract küçük yazıda hata yapıyor; tipik manga sayfası (~800 px
 * genişlik) 2 kat büyütülünce balon yazıları belirgin şekilde daha doğru
 * okunuyor (denemede "IT!" → "Im" hatası düzeldi). Geniş resimler ve
 * piksel sınırını aşacaklar daha az büyütülür, hiç küçültülmez.
 */
export function buyutmeOlcegi(genislik, yukseklik) {
  const istenen = genislik < 1200 ? 2 : genislik < 1800 ? 1.5 : 1;
  const sinir = Math.sqrt(AZAMI_PIKSEL / (genislik * yukseklik));
  return Math.max(1, Math.min(istenen, sinir));
}
