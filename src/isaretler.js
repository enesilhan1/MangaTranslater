// Modele giden resim kopyasına çizilen numaralı balon işaretleri
// ("set-of-marks"). Görsel modeller konumu koordinat olarak kaba tahmin
// ediyor ama resimde gördükleri bir numarayı güvenilir şekilde
// söyleyebiliyor; böylece her metin, piksellerden bulunan gerçek balona
// (src/kutu_oturtma.js balonlariBul) bağlanır. İşaret yalnızca modele giden
// kopyada; sayfada gösterilen resim değişmez.

/**
 * İşaretlerin yeri ve boyutu: balonun sınırlayıcı kutusunun sol üst köşesi.
 * Elips balonda bu köşe balonun dışında kalır, yazıyı örtmez.
 * @param {import('./kutu_oturtma.js').BulunanBalon[]} bulunanlar  Gri kopyanın pikselleriyle.
 * @param {number} olcek  Gri kopyadan gönderilen resme ölçek.
 * @param {number} genislik  Gönderilen resmin genişliği.
 * @returns {{no: number, x: number, y: number, r: number}[]}  Daire merkezi ve yarıçapı.
 */
export function isaretKonumlari(bulunanlar, olcek, genislik) {
  const r = Math.max(9, Math.round(genislik * 0.016));
  return bulunanlar.map((b, i) => ({
    no: i + 1,
    x: Math.max(r, Math.round(b.kutu.x0 * olcek + r * 0.4)),
    y: Math.max(r, Math.round(b.kutu.y0 * olcek + r * 0.4)),
    r,
  }));
}

/**
 * Modele metinle de verilen işaretli alan listesi: [ymin, xmin, ymax, xmax],
 * 0-1000 (istemdeki kutu biçimi).
 * @param {import('./kutu_oturtma.js').BulunanBalon[]} bulunanlar
 * @param {{genislik: number, yukseklik: number}} gri  Gri kopyanın boyutu.
 */
export function bolgeListesi(bulunanlar, gri) {
  const b = (v, n) => Math.round((v / n) * 1000);
  return bulunanlar.map((x, i) => ({
    no: i + 1,
    kutu: [b(x.kutu.y0, gri.yukseklik), b(x.kutu.x0, gri.genislik), b(x.kutu.y1 + 1, gri.yukseklik), b(x.kutu.x1 + 1, gri.genislik)],
  }));
}
