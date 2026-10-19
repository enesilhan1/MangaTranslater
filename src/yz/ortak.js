// Sağlayıcıdan bağımsız ortak türler ve yardımcılar.

/**
 * Kullanıcıya gösterilecek hata. Metin dil dosyasından ([anahtar]) gelir,
 * böylece arayüz dili değişince eski hatalar da çevrilir.
 */
export class YzHatasi extends Error {
  constructor(anahtar, parametreler = {}) {
    super(anahtar);
    this.name = 'YzHatasi';
    this.anahtar = anahtar;
    this.parametreler = parametreler;
  }
}

/** Kullanım nesnesindeki bir sayı (yoksa 0). */
export function sayi(nesne, anahtar) {
  const v = nesne?.[anahtar];
  return typeof v === 'number' ? Math.trunc(v) : 0;
}

/**
 * Hata mesajla (runtime.sendMessage) taşınabilsin diye düz nesneye
 * çevrilir; alan taraf new YzHatasi(anahtar, parametreler) ile geri kurar.
 */
export function hatayiPaketle(e) {
  if (e instanceof YzHatasi) return { anahtar: e.anahtar, parametreler: e.parametreler };
  return { anahtar: 'hata.beklenmeyen', parametreler: { mesaj: String(e?.message ?? e) } };
}
