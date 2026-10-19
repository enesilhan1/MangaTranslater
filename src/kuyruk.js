// Çeviri işlerinin öncelikli kuyruğu (docs/SPEC.md §6). Arka planda tek
// kuyruk vardır: birden çok sekme açık olsa da sağlayıcıya aynı anda en çok
// [esZaman] istek gider (kota/hız sınırını aşmamak için). Ekrandaki resim
// önce, birkaç ekran ilerideki sonra, görünmeyen (önceden yüklenmiş) en son
// çevrilir; okuyucu kaydırdıkça içerik betiği öncelikleri günceller.

import { YzHatasi } from './yz/ortak.js';

export const Oncelik = Object.freeze({
  GIZLI: 1, // Sayfada yüklü ama görünmüyor (sonraki sayfalar)
  YAKIN: 2, // Birkaç ekran ileride
  GORUNUR: 3, // Şu an ekranda
});

export class Kuyruk {
  /** @param {{esZaman?: number}} [p] */
  constructor({ esZaman = 3 } = {}) {
    this._esZaman = esZaman;
    /** @type {Map<string, {oncelik: number, sira: number, is: Function, coz: Function, reddet: Function}>} */
    this.bekleyen = new Map();
    /** @type {Map<string, AbortController>} */
    this.calisan = new Map();
    this._sayac = 0;
  }

  get esZaman() {
    return this._esZaman;
  }

  /** Motor değişince (yerel OCR tek işçiyle çalışır) güncellenir. */
  set esZaman(n) {
    this._esZaman = Math.max(1, n);
    this._yurut();
  }

  /** Kuyrukta (bekleyen ya da çalışan) iş var mı? */
  get bosMu() {
    return this.bekleyen.size === 0 && this.calisan.size === 0;
  }

  /**
   * [is] sırası gelince bir AbortSignal ile çağrılır. Aynı [id] zaten
   * kuyruktaysa yenisi eskisinin yerine geçer (eskisi iptal edilir).
   * @template T
   * @param {string} id
   * @param {number} oncelik
   * @param {(sinyal: AbortSignal) => Promise<T>} is
   * @returns {Promise<T>}
   */
  ekle(id, oncelik, is) {
    this.iptal(id);
    return new Promise((coz, reddet) => {
      this.bekleyen.set(id, { oncelik, sira: this._sayac++, is, coz, reddet });
      this._yurut();
    });
  }

  oncelikDegistir(id, oncelik) {
    const b = this.bekleyen.get(id);
    if (b) b.oncelik = oncelik;
  }

  /** Kimliği [onEk] ile başlayan bekleyen işlerin (bir resmin dilimleri) önceliği. */
  onEkOncelik(onEk, oncelik) {
    for (const [id, b] of this.bekleyen) if (id.startsWith(onEk)) b.oncelik = oncelik;
  }

  /** Bekleyen işi kuyruktan çıkarır, çalışanı durdurur. */
  iptal(id) {
    const b = this.bekleyen.get(id);
    if (b) {
      this.bekleyen.delete(id);
      b.reddet(new YzHatasi('hata.durduruldu'));
    }
    this.calisan.get(id)?.abort();
  }

  /** Kimliği [onEk] ile başlayan tüm işleri iptal eder (ör. kapanan sekme). */
  onEkIptal(onEk) {
    for (const id of [...this.bekleyen.keys(), ...this.calisan.keys()]) {
      if (id.startsWith(onEk)) this.iptal(id);
    }
  }

  _yurut() {
    while (this.calisan.size < this._esZaman && this.bekleyen.size) {
      let secilen = null;
      for (const [id, b] of this.bekleyen) {
        if (!secilen || b.oncelik > secilen[1].oncelik ||
            (b.oncelik === secilen[1].oncelik && b.sira < secilen[1].sira)) {
          secilen = [id, b];
        }
      }
      const [id, b] = secilen;
      this.bekleyen.delete(id);
      const denetci = new AbortController();
      this.calisan.set(id, denetci);
      Promise.resolve()
        .then(() => b.is(denetci.signal))
        .then(b.coz, b.reddet)
        .finally(() => {
          // Aynı kimlikle yeni bir iş başlamışsa onun kaydına dokunma.
          if (this.calisan.get(id) === denetci) this.calisan.delete(id);
          this._yurut();
        });
    }
  }
}
