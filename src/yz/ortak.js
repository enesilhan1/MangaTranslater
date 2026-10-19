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
