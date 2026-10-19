// Çevrilecek resmin boyut ve dilim planı (docs/SPEC.md §5, §6). Saf
// hesaplama; piksel işlemleri içerik betiğinde (icerik/resim_al.js).
//
// - Gönderilmeden önce resim en çok HEDEF_GENISLIK'e küçültülür: daha büyük
//   resim balon yazısını daha iyi okutmuyor, yalnızca yüklemeyi ve görsel
//   token maliyetini artırıyor. Hiç büyütülmez (OCR kendi büyütmesini yapar).
// - Normal bir sayfa (en/boy oranı ~1:2'ye kadar) tek parça gider.
// - Daha uzun resimler (webtoon şeritleri) yaklaşık 1:1,5'lik dilimlere
//   bölünür. Kesim, hedef yüksekliğin çevresinde en tek düze satırdan
//   yapılır: paneller arası boşluklar tek renktir; balonların ortasından
//   kesilmesi böylece önlenir.

export const HEDEF_GENISLIK = 1400;
/** Ölçeklenmiş yükseklik/genişlik bu oranı aşmıyorsa tek parça. */
const TEK_PARCA_ORANI = 2;
/** Dilim hedef yüksekliği (genişliğe oranla). */
const DILIM_ORANI = 1.5;
/** Kesim, hedefin bu oran kadar yukarısı/aşağısı içinde aranır. */
const ARAMA_PENCERESI = 0.25;

/**
 * @param {number} genislik  Resmin özgün piksel genişliği.
 * @param {number} yukseklik
 * @param {number[] | null} [skorlar]  Satırların tek düzelik skoru (küçük =
 *   tek renk, kesime uygun); resmin yüksekliğine eşit aralıklı örnekler.
 *   Verilmezse tam hedef yükseklikten kesilir.
 * @returns {{olcek: number, dilimler: {y0: number, y1: number}[]}}
 *   Ölçek (≤1) ve dilimler (özgün piksellerle, uç uca, örtüşmesiz).
 */
export function dilimleriPlanla(genislik, yukseklik, skorlar = null) {
  const olcek = Math.min(1, HEDEF_GENISLIK / genislik);
  if (yukseklik <= genislik * TEK_PARCA_ORANI) return { olcek, dilimler: [{ y0: 0, y1: yukseklik }] };

  const hedef = genislik * DILIM_ORANI;
  const pencere = hedef * ARAMA_PENCERESI;
  const dilimler = [];
  let y0 = 0;
  // Son dilim çok kısa kalmasın: kalan, bir dilim + yarım dilimden azsa bitir.
  while (yukseklik - y0 > hedef * 1.5) {
    const kes = kesimSec(skorlar, yukseklik, y0 + hedef - pencere, y0 + hedef + pencere, y0 + hedef);
    dilimler.push({ y0, y1: kes });
    y0 = kes;
  }
  dilimler.push({ y0, y1: yukseklik });
  return { olcek, dilimler };
}

/** [alt, ust] aralığında en düşük skorlu satır; eşitlikte hedefe en yakın. */
function kesimSec(skorlar, yukseklik, alt, ust, hedef) {
  if (!skorlar?.length) return Math.round(hedef);
  const oran = skorlar.length / yukseklik;
  let enIyi = Math.round(hedef);
  let enIyiSkor = Infinity;
  for (let i = Math.ceil(alt * oran); i <= Math.floor(ust * oran) && i < skorlar.length; i++) {
    const y = Math.round(i / oran);
    const s = skorlar[i];
    if (s < enIyiSkor || (s === enIyiSkor && Math.abs(y - hedef) < Math.abs(enIyi - hedef))) {
      enIyi = y;
      enIyiSkor = s;
    }
  }
  return enIyi;
}

/**
 * Bir satırın tek düzelik skoru: parlaklık değerlerinin standart sapması.
 * Panel arası boşlukta ~0, yazı/çizim olan satırda yüksek.
 * @param {ArrayLike<number>} rgba  Satırın RGBA baytları.
 */
export function satirSkoru(rgba) {
  let t = 0;
  let t2 = 0;
  const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) {
    const p = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    t += p;
    t2 += p * p;
  }
  const ort = t / n;
  return Math.sqrt(Math.max(0, t2 / n - ort * ort));
}

/**
 * Dilimlerin balonlarını (dilime oranla 0-1) bütün resme oranla 0-1'e
 * çevirir. Dilimler yatayda resmin tamamıdır; yalnızca dikey konum ve
 * yükseklik ölçeklenir.
 * @param {{y0: number, y1: number}} dilim  Özgün piksellerle.
 * @param {number} yukseklik  Resmin özgün yüksekliği.
 * @param {import('./yz/cozumle.js').Balon[]} balonlar
 */
export function dilimBalonlariniYerlestir(dilim, yukseklik, balonlar) {
  const bas = dilim.y0 / yukseklik;
  const oran = (dilim.y1 - dilim.y0) / yukseklik;
  return balonlar.map((b) => ({ ...b, y: bas + b.y * oran, h: b.h * oran }));
}
