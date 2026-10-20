// Uzun kelimelere hece sınırında yumuşak tire (U+00AD) ekleme. Dar bir
// balonda kelime en küçük puntoda bile sığmıyorsa tarayıcı ortadan
// keyfi kırmak yerine hece sınırından tireyle böler (kullanıcının
// sayfasında "sınıflandırılıyo / r:" gibi). Türkçe ve Azerbaycan Türkçesi
// hece kuralları düzenli: her hecede bir ünlü; iki ünlü arasında tek ünsüz
// varsa o ünsüzden önce ("ya-zı"), iki ya da daha çok ünsüz varsa
// sonuncusundan önce ("sı-nıf-lan-dı"), iki ünlü yan yanaysa aralarından
// ("sa-at"). Diğer dillerde metin olduğu gibi kalır.

const YUMUSAK_TIRE = '­';
const UNLULER = new Set('aâeıiîoöuûüəAÂEIİÎOÖUÛÜƏ');
/** Bundan kısa kelimeler bölünmez; bölünen parçalar en az 2 harf. */
const EN_KISA_KELIME = 8;
const EN_KISA_PARCA = 2;

/** Bu dilde heceleme var mı? */
export const hecelenirMi = (dil) => dil === 'tr' || dil === 'az';

/** Tek bir harf dizisinin hece sınırları (bölüneceği konumlar). */
export function heceSinirlari(kelime) {
  const unlu = [...kelime].map((h) => UNLULER.has(h));
  const sinirlar = [];
  let onceki = -1;
  for (let i = 0; i < unlu.length; i++) {
    if (!unlu[i]) continue;
    if (onceki >= 0) {
      const unsuz = i - onceki - 1;
      sinirlar.push(unsuz === 0 ? i : i - 1);
    }
    onceki = i;
  }
  return sinirlar.filter((s) => s >= EN_KISA_PARCA && unlu.length - s >= EN_KISA_PARCA);
}

/** Metindeki uzun kelimelere hece sınırında yumuşak tire ekler. */
export function hecele(metin, dil) {
  if (!hecelenirMi(dil)) return metin;
  return metin.replace(/\p{L}+/gu, (kelime) => {
    const harfler = [...kelime];
    if (harfler.length < EN_KISA_KELIME) return kelime;
    const sinirlar = new Set(heceSinirlari(kelime));
    return harfler.map((h, i) => (sinirlar.has(i) ? YUMUSAK_TIRE + h : h)).join('');
  });
}
