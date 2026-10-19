// Çevirilerin sayfada gösterimi (docs/SPEC.md §7). Aşama 4'te balonların
// üstüne çeviri katmanı olarak yazılacak; şimdilik içerik betiğinin
// kullandığı arayüz ve konsola özet.

/**
 * @typedef {Object} ResimDurumu
 * @property {string} kimlik
 * @property {'bekliyor'|'cevriliyor'|'tamam'|'hata'} durum
 * @property {import('../yz/cozumle.js').Balon[]} balonlar  Resme oranla; dilimler
 *   geldikçe artar.
 * @property {{anahtar: string, parametreler: object} | null} hata
 */

export class Gorunum {
  /** @param {HTMLImageElement} _img @param {ResimDurumu} durum */
  guncelle(_img, durum) {
    if (durum.durum === 'tamam' || durum.durum === 'hata') {
      console.debug('[Manga Çevirmen]', durum.kimlik, durum.durum, durum.balonlar.length, durum.hata ?? '');
    }
  }

  /** Resim sayfadan kalktı ya da yeniden çevrilecek. */
  kaldir(_img) {}
}
