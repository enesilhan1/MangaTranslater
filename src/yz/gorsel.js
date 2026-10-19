import { balonlariCoz } from './cozumle.js';
import { kullaniciMetni, sistemIstemi } from './istem.js';
import { YzHatasi } from './ortak.js';

/** Yanıtın neden bittiği (sağlayıcıdan bağımsız). */
export const YanitSonu = Object.freeze({
  BITTI: 'bitti',
  UZUNLUK: 'uzunluk', // Çıktı sınırına takıldı; JSON yarım kalmış olabilir.
  RET: 'ret', // Model ya da güvenlik filtresi isteği reddetti.
});

/**
 * @typedef {{veri: string, tur: string}} Resim  Base64 veri + MIME türü.
 * @typedef {{metin: string, son: string,
 *   kullanim: import('./katalog.js').Kullanim}} HamYanit
 */

/**
 * Üç sağlayıcının ortak kısmı: istemi kurar, yanıtı balonlara çevirir,
 * reddi ve yarım kalan yanıtı anlaşılır hataya dönüştürür. Alt sınıflar
 * yalnızca [iste]'yi (sağlayıcının kendi istek/yanıt biçimi) yazar.
 */
export class GorselIstemci {
  /** Hata mesajlarında görünen ad. */
  static ad = '';

  /**
   * @param {{model: import('./katalog.js').YzModeli, apiAnahtari: string,
   *   istek: import('./http_istegi.js').JsonIstegi}} p
   */
  constructor({ model, apiAnahtari, istek }) {
    this.model = model;
    this.apiAnahtari = apiAnahtari;
    this.istek = istek;
  }

  get ad() {
    return /** @type {typeof GorselIstemci} */ (this.constructor).ad;
  }

  /**
   * @param {{resim: Resim, sistem: string, metin: string, sinyal?: AbortSignal}} _p
   * @returns {Promise<HamYanit>}
   */
  async iste(_p) {
    throw new Error('alt sınıf tanımlamalı');
  }

  /**
   * Resimdeki yazıları bulur ve [hedefDil]'e çevirir.
   * @param {{resim: Resim, hedefDil: string, sinyal?: AbortSignal}} p
   * @returns {Promise<{balonlar: import('./cozumle.js').Balon[],
   *   kullanim: import('./katalog.js').Kullanim}>}
   */
  async cevir({ resim, hedefDil, sinyal }) {
    const { metin, son, kullanim } = await this.iste({
      resim,
      sistem: sistemIstemi(hedefDil),
      metin: kullaniciMetni(hedefDil),
      sinyal,
    });
    if (son === YanitSonu.RET) throw new YzHatasi('hata.ret', { ad: this.ad });
    if (son === YanitSonu.UZUNLUK) throw new YzHatasi('hata.uzunluk', { ad: this.ad });
    return { balonlar: balonlariCoz(metin, this.ad), kullanim };
  }
}

/** Çıktı sınırı: kalabalık bir sayfada bile JSON'un yarım kalmaması için. */
export const AZAMI_CIKTI = 8000;
