// Yerel OCR'nin okuduğu metinleri çeviren servisler (docs/SPEC.md §2.2):
// Chrome'da tarayıcının yerleşik çevirmeni (cihazda), Firefox'ta ya da
// yerleşik çevirmen kullanılamıyorsa MyMemory'nin ücretsiz API'si.

import { YzHatasi } from '../yz/ortak.js';

/** Chrome Translator API dil kodları BCP 47; listemizde yalnızca Çince farklı. */
/**
 * availability() bazı ortamlarda hiç dönmüyor (gömülü Chromium'da 4 sn'de
 * bile yanıt vermediği görüldü). Bu sürede dönmezse çevirmen kullanılamaz
 * sayılır; çeviri MyMemory'ye düşer, açılır pencere de takılmaz.
 */
export const DURUM_ZAMAN_ASIMI_MS = 3000;

const CHROME_KODLARI = { 'zh-CN': 'zh' };

/**
 * Chrome'un yerleşik çevirmeni (Translator API, Chrome 138+). Çeviri
 * cihazda yapılır; dil paketi ilk kullanımda bir kez iner. Chrome bu ilk
 * indirmeyi yalnızca kullanıcı tıklamasıyla başlatır: paket yokken
 * tıklamasız create() hata verir; açılır penceredeki "çevirmeni hazırla"
 * düğmesi bunun için (hazirla).
 */
export class ChromeCevirmeni {
  /**
   * @param {any} api  Translator global'i (testlerde sahtesi).
   * @param {{zamanAsimiMs?: number}} [p]
   */
  constructor(api = globalThis.Translator, { zamanAsimiMs = DURUM_ZAMAN_ASIMI_MS } = {}) {
    this.api = api;
    this.zamanAsimiMs = zamanAsimiMs;
    /** @type {Map<string, Promise<any>>} dil çifti → çevirmen */
    this.cevirmenler = new Map();
  }

  /** Bu tarayıcıda yerleşik çevirmen var mı? */
  get varMi() {
    return typeof this.api?.create === 'function';
  }

  /**
   * @returns {Promise<'unavailable'|'downloadable'|'downloading'|'available'>}
   */
  async durum(kaynak, hedef) {
    if (!this.varMi) return 'unavailable';
    let sayac;
    const zamanAsimi = new Promise((coz) => {
      sayac = setTimeout(() => coz('unavailable'), this.zamanAsimiMs);
    });
    try {
      return await Promise.race([this.api.availability(this.secenek(kaynak, hedef)), zamanAsimi]);
    } catch {
      return 'unavailable';
    } finally {
      clearTimeout(sayac);
    }
  }

  secenek(kaynak, hedef) {
    return {
      sourceLanguage: CHROME_KODLARI[kaynak] ?? kaynak,
      targetLanguage: CHROME_KODLARI[hedef] ?? hedef,
    };
  }

  /**
   * Dil paketini indirip çevirmeni kurar. Paket henüz yoksa kullanıcı
   * tıklamasının hemen ardından çağrılmalıdır.
   * @param {(oran: number) => void} [ilerleme]  İndirme oranı (0-1).
   */
  hazirla(kaynak, hedef, ilerleme) {
    const anahtar = `${kaynak}>${hedef}`;
    let p = this.cevirmenler.get(anahtar);
    if (!p) {
      p = this.api.create({
        ...this.secenek(kaynak, hedef),
        monitor: (m) => m.addEventListener?.('downloadprogress', (e) => ilerleme?.(e.loaded)),
      });
      this.cevirmenler.set(anahtar, p);
      // Başarısız kurulum önbellekte kalmasın; sonraki deneme yeniden kursun.
      p.catch(() => this.cevirmenler.delete(anahtar));
    }
    return p;
  }

  /**
   * @param {string[]} metinler
   * @returns {Promise<string[]>}
   */
  async cevir(metinler, { kaynak, hedef }) {
    let cevirmen;
    try {
      cevirmen = await this.hazirla(kaynak, hedef);
    } catch (e) {
      // Paket inmemişken tıklamasız create(): NotAllowedError.
      if (e?.name === 'NotAllowedError') throw new YzHatasi('hata.cevirmen.hazirla');
      throw new YzHatasi('hata.cevirmen.chrome', { mesaj: String(e?.message ?? e) });
    }
    return Promise.all(metinler.map((m) => cevirmen.translate(m)));
  }
}

const MYMEMORY_ADRESI = 'https://api.mymemory.translated.net/get';
/** MyMemory isteği en çok 500 bayt kabul ediyor; Türkçe karakterlere pay. */
const MYMEMORY_PARCA = 400;
const AYNI_ANDA = 4;

/**
 * MyMemory resmi ücretsiz API'si. Anahtarsız günlük ~5.000, e-postayla
 * (`de` parametresi) ~50.000 karakter. Hata durumlarında da HTTP 200 ve
 * gövdede `responseStatus` (bazen metin olarak) döndürüyor.
 */
export class MyMemoryCevirmeni {
  /** @param {{fetch?: typeof fetch, eposta?: string}} [p] */
  constructor({ fetch: f, eposta = '' } = {}) {
    this.fetch = f ?? ((...a) => globalThis.fetch(...a));
    this.eposta = eposta.trim();
  }

  async cevir(metinler, { kaynak, hedef, sinyal }) {
    const sonuclar = new Array(metinler.length);
    let sira = 0;
    const isci = async () => {
      while (sira < metinler.length) {
        const i = sira++;
        const parcalar = parcala(metinler[i], MYMEMORY_PARCA);
        const ceviriler = [];
        for (const p of parcalar) ceviriler.push(await this.tekCeviri(p, kaynak, hedef, sinyal));
        sonuclar[i] = ceviriler.join(' ');
      }
    };
    await Promise.all(Array.from({ length: Math.min(AYNI_ANDA, metinler.length) }, isci));
    return sonuclar;
  }

  async tekCeviri(metin, kaynak, hedef, sinyal) {
    const adres = new URL(MYMEMORY_ADRESI);
    adres.searchParams.set('q', metin);
    adres.searchParams.set('langpair', `${kaynak}|${hedef}`);
    if (this.eposta) adres.searchParams.set('de', this.eposta);

    let j;
    try {
      const y = await this.fetch(adres.href, { signal: sinyal });
      j = JSON.parse(await y.text());
    } catch {
      if (sinyal?.aborted) throw new YzHatasi('hata.durduruldu');
      throw new YzHatasi('hata.baglanti', { ad: 'MyMemory' });
    }
    const durum = Number(j?.responseStatus);
    const ceviri = String(j?.responseData?.translatedText ?? '');
    if (j?.quotaFinished === true || durum === 429 || ceviri.startsWith('MYMEMORY WARNING')) {
      throw new YzHatasi(this.eposta ? 'hata.mymemory.kota' : 'hata.mymemory.kotaEposta');
    }
    if (durum !== 200) {
      throw new YzHatasi('hata.reddetti', { ad: 'MyMemory', durum, mesaj: String(j?.responseDetails ?? '') });
    }
    return ceviri;
  }
}

/** Uzun metni cümle sınırlarından, olmazsa kelime sınırından böler. */
export function parcala(metin, enFazla) {
  if (metin.length <= enFazla) return [metin];
  const parcalar = [];
  let kalan = metin;
  while (kalan.length > enFazla) {
    const bolum = kalan.slice(0, enFazla);
    let kes = Math.max(bolum.lastIndexOf('. '), bolum.lastIndexOf('! '), bolum.lastIndexOf('? '));
    kes = kes > 0 ? kes + 1 : bolum.lastIndexOf(' ');
    if (kes <= 0) kes = enFazla;
    parcalar.push(kalan.slice(0, kes).trim());
    kalan = kalan.slice(kes).trim();
  }
  if (kalan) parcalar.push(kalan);
  return parcalar;
}

/**
 * Kullanılacak çevirmeni seçer: Chrome'da yerleşik çevirmen bu dil çiftini
 * destekliyorsa o, değilse MyMemory.
 * @param {{chrome?: ChromeCevirmeni, myMemory: MyMemoryCevirmeni,
 *   kaynak: string, hedef: string}} p
 */
export async function metinCevirmeniSec({ chrome, myMemory, kaynak, hedef }) {
  if (chrome?.varMi && (await chrome.durum(kaynak, hedef)) !== 'unavailable') return chrome;
  return myMemory;
}
