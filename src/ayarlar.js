// Ayarlar: yalnızca bu bilgisayarda, storage.local'da (docs/SPEC.md §9).
// Açılır pencere, arka plan ve içerik betiği aynı modülü kullanır.
//
//   ayarlar  {arayuzDili, motor, saglayici, modeller: {saglayici: modelId},
//             anahtarlar: {saglayici: anahtar}, hedefDil, eposta, siteler}

import { VARSAYILAN_HEDEF_DIL } from './diller.js';
import { VARSAYILAN_SAGLAYICI, modelBul } from './yz/katalog.js';

export const Motor = Object.freeze({
  GORSEL: 'gorsel', // Görsel yapay zekâ (SPEC §2.1)
  YEREL: 'yerel', // Tesseract + yerleşik çevirmen / MyMemory (SPEC §2.2)
});

export const VARSAYILAN_AYARLAR = Object.freeze({
  arayuzDili: 'tr',
  motor: Motor.GORSEL,
  saglayici: VARSAYILAN_SAGLAYICI,
  modeller: {},
  anahtarlar: {},
  hedefDil: VARSAYILAN_HEDEF_DIL,
  /** MyMemory günlük sınırını 5.000'den 50.000 karaktere çıkarır. */
  eposta: '',
  /** "Bu sitede her zaman çevir" listesi: alan adları (SPEC §4). */
  siteler: [],
});

/** Kayıtlı ayarları varsayılanlarla tamamlar (eski/eksik kayıtlar bozulmasın). */
export function ayarlariTamamla(kayitli) {
  const a = kayitli ?? {};
  return {
    ...VARSAYILAN_AYARLAR,
    ...a,
    motor: Object.values(Motor).includes(a.motor) ? a.motor : VARSAYILAN_AYARLAR.motor,
    modeller: { ...(a.modeller ?? {}) },
    anahtarlar: { ...(a.anahtarlar ?? {}) },
    siteler: Array.isArray(a.siteler) ? [...a.siteler] : [],
  };
}

/** Seçili görsel model (sağlayıcının kayıtlı modeli, yoksa varsayılanı). */
export function seciliModel(a) {
  return modelBul(a.saglayici, a.modeller[a.saglayici]);
}

/**
 * Sonucu belirleyen ayarların kimliği. Önbellek bu kimlikle ayrılır: başka
 * modelle ya da motorla yapılmış çeviri, seçim değişince gösterilmez.
 */
export function motorKimligi(a) {
  if (a.motor === Motor.YEREL) return 'yerel';
  const m = seciliModel(a);
  return `gorsel:${m.saglayici}:${m.id}`;
}

export class AyarDeposu {
  /** @param {{get: Function, set: Function}} alan  storage.local */
  constructor(alan) {
    this.alan = alan;
    this._sira = Promise.resolve();
  }

  async oku() {
    const { ayarlar } = await this.alan.get('ayarlar');
    return ayarlariTamamla(ayarlar);
  }

  /** Oku-değiştir-yaz; aynı anda iki güncelleme birbirini ezmesin diye sıralı. */
  guncelle(degistir) {
    const is = async () => {
      const a = await this.oku();
      const yeni = ayarlariTamamla(degistir(a) ?? a);
      await this.alan.set({ ayarlar: yeni });
      return yeni;
    };
    const p = this._sira.then(is, is);
    this._sira = p.catch(() => {});
    return p;
  }
}
