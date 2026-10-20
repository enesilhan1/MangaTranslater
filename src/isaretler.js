// Modele giden resim kopyasına çizilen numaralı balon işaretleri
// ("set-of-marks"). Görsel modeller konumu koordinat olarak kaba tahmin
// ediyor ama resimde gördükleri bir numarayı güvenilir şekilde
// söyleyebiliyor; böylece her metin, piksellerden bulunan gerçek balona
// (src/kutu_oturtma.js balonlariBul) bağlanır. İşaret yalnızca modele giden
// kopyada; sayfada gösterilen resim değişmez.

/**
 * İşaretlerin yeri ve boyutu. İşaret balonun **içine** konur ki hangi balona
 * ait olduğu belirsiz kalmasın; yazıya bitişik durur ki etiketlediği metnin
 * dibinde olsun (boşluğun ortasına konunca alttaki boşlukta balonun
 * kuyruğuna inip komşu balona yaklaşıyordu): önce yazının hemen üstüne
 * (ortalı), sığmazsa hemen soluna, o da sığmazsa hemen altına; hiçbirine sığmıyorsa
 * balonun sınırlayıcı kutusunun sol üst köşesine. (İlk sürümde işaret hep
 * köşedeydi, yani balonun dışında; kullanıcının sayfasında Claude iki
 * farklı balonun metnine aynı numarayı verdi.)
 * @param {import('./kutu_oturtma.js').BulunanBalon[]} bulunanlar  Gri kopyanın pikselleriyle.
 * @param {number} olcek  Gri kopyadan gönderilen resme ölçek.
 * @param {number} genislik  Gönderilen resmin genişliği.
 * @param {number} [yukseklik]  Gönderilen resmin yüksekliği (taşmayı önlemek için).
 * @returns {{no: number, x: number, y: number, r: number}[]}  Daire merkezi ve yarıçapı.
 */
export function isaretKonumlari(bulunanlar, olcek, genislik, yukseklik = Infinity) {
  const r = Math.max(9, Math.round(genislik * 0.016));
  const gerekli = 2 * r + 2;
  const sinirla = (v, ust) => Math.min(Math.max(r, Math.round(v)), ust - r);
  return bulunanlar.map((b, i) => {
    // Balon bulunurken piksellerden seçilmiş, hiçbir harfe değmeyen yer.
    if (b.isaret) {
      return {
        no: i + 1,
        x: Math.round(b.isaret.x * olcek),
        y: Math.round(b.isaret.y * olcek),
        r: Math.max(6, Math.min(r, Math.round(b.isaret.r * olcek))),
      };
    }
    const k = { x0: b.kutu.x0 * olcek, y0: b.kutu.y0 * olcek, x1: (b.kutu.x1 + 1) * olcek, y1: (b.kutu.y1 + 1) * olcek };
    const y = { x0: b.yazi.x0 * olcek, y0: b.yazi.y0 * olcek, x1: (b.yazi.x1 + 1) * olcek, y1: (b.yazi.y1 + 1) * olcek };
    let x;
    let yy;
    if (y.y0 - k.y0 >= gerekli) {
      x = (y.x0 + y.x1) / 2;
      yy = y.y0 - r - 1;
    } else if (y.x0 - k.x0 >= gerekli) {
      x = y.x0 - r - 1;
      yy = (y.y0 + y.y1) / 2;
    } else if (k.y1 - y.y1 >= gerekli) {
      x = (y.x0 + y.x1) / 2;
      yy = y.y1 + r + 1;
    } else {
      x = k.x0 + r * 0.4;
      yy = k.y0 + r * 0.4;
    }
    return { no: i + 1, x: sinirla(x, genislik), y: sinirla(yy, yukseklik), r };
  });
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
