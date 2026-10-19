// Çeviri önbelleği (docs/SPEC.md §6): aynı resim tekrar açılınca çeviri
// anında gösterilir. Kayıt anahtarı resmin içeriğinin özeti + motor
// kimliği + hedef dil; resim adresi kullanılmaz (MangaDex gibi siteler her
// açılışta yeni blob: adresi veriyor). Boyut sınırlıdır; sınır aşılınca en
// uzun süredir kullanılmayan kayıtlar silinir.

/**
 * @typedef {{anahtar: string, balonlar: object[], zaman: number}} Kayit
 * @typedef {{al(anahtar: string): Promise<Kayit|undefined>,
 *   koy(kayit: Kayit): Promise<void>, say(): Promise<number>,
 *   enEskileriSil(adet: number): Promise<void>, temizle(): Promise<void>}} Arka
 *   Depolama arka ucu: IndexedDB (idbArkaUcu) ya da testlerde bellek.
 */

export const AZAMI_KAYIT = 5000;

/** Resim verisinin SHA-256 özeti (onaltılık). */
export async function ozetCikar(veri) {
  const baytlar = new TextEncoder().encode(veri);
  const ozet = await crypto.subtle.digest('SHA-256', baytlar);
  return [...new Uint8Array(ozet)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const kayitAnahtari = (ozet, motorKimligi, hedefDil) => `${ozet}|${motorKimligi}|${hedefDil}`;

export class Onbellek {
  /**
   * @param {Arka} arka
   * @param {{azami?: number, simdi?: () => number}} [p]
   */
  constructor(arka, { azami = AZAMI_KAYIT, simdi = Date.now } = {}) {
    this.arka = arka;
    this.azami = azami;
    this.simdi = simdi;
  }

  /** Kayıtlı balonlar ya da null. Okunan kayıt "yeni kullanıldı" sayılır. */
  async al(anahtar) {
    const k = await this.arka.al(anahtar);
    if (!k) return null;
    // Kullanım zamanını güncelle; beklemeye gerek yok, hata da önemsiz.
    this.arka.koy({ ...k, zaman: this.simdi() }).catch(() => {});
    return k.balonlar;
  }

  async koy(anahtar, balonlar) {
    await this.arka.koy({ anahtar, balonlar, zaman: this.simdi() });
    const adet = await this.arka.say();
    // Her eklemede silmemek için %10 pay bırakılarak toplu silinir.
    if (adet > this.azami) await this.arka.enEskileriSil(adet - Math.floor(this.azami * 0.9));
  }

  temizle() {
    return this.arka.temizle();
  }
}

/** IndexedDB arka ucu (arka planda; tarayıcı başına tek veritabanı). */
export function idbArkaUcu(ad = 'manga-cevirmen') {
  let dbSozu = null;
  const db = () =>
    (dbSozu ??= new Promise((coz, reddet) => {
      const istek = indexedDB.open(ad, 1);
      istek.onupgradeneeded = () => {
        const depo = istek.result.createObjectStore('ceviriler', { keyPath: 'anahtar' });
        depo.createIndex('zaman', 'zaman');
      };
      istek.onsuccess = () => coz(istek.result);
      istek.onerror = () => {
        dbSozu = null;
        reddet(istek.error);
      };
    }));

  /** Tek işlemlik yardımcı: [is] depo üzerinde istek(ler) başlatır. */
  const islem = async (kip, is) => {
    const t = (await db()).transaction('ceviriler', kip);
    const depo = t.objectStore('ceviriler');
    const sonuc = is(depo);
    return new Promise((coz, reddet) => {
      t.oncomplete = () => coz(sonuc?.result);
      t.onerror = () => reddet(t.error);
      t.onabort = () => reddet(t.error);
    });
  };

  return {
    al: (anahtar) => islem('readonly', (d) => d.get(anahtar)),
    koy: async (kayit) => {
      await islem('readwrite', (d) => d.put(kayit));
    },
    say: () => islem('readonly', (d) => d.count()),
    enEskileriSil: async (adet) => {
      await islem('readwrite', (d) => {
        let kalan = adet;
        d.index('zaman').openCursor().onsuccess = (e) => {
          const imlec = e.target.result;
          if (!imlec || kalan-- <= 0) return;
          imlec.delete();
          imlec.continue();
        };
      });
    },
    temizle: async () => {
      await islem('readwrite', (d) => d.clear());
    },
  };
}
