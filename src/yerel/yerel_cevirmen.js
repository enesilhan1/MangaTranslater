// Yerel motorun tamamı (docs/SPEC.md §2.2): OCR → balonlara gruplama →
// metin çevirisi. Görsel istemcilerle (yz/gorsel.js) aynı arayüzü sunar:
// cevir({resim, hedefDil, sinyal}) → {balonlar, kullanim}; böylece
// çağıran taraf hangi motorun seçili olduğunu bilmek zorunda kalmaz.

import { balonlaraGrupla, cumleDuzeni } from './gruplama.js';
import { metinCevirmeniSec } from './metin_cevirmenleri.js';

/** İlk sürümde OCR yalnızca İngilizce okur (SPEC §2.2). */
export const KAYNAK_DIL = 'en';

export class YerelCevirmen {
  /**
   * @param {{
   *   ocr: (resim: import('../yz/gorsel.js').Resim) => Promise<{
   *     kelimeler: import('./gruplama.js').OcrKelimesi[], genislik: number, yukseklik: number}>,
   *   chrome?: import('./metin_cevirmenleri.js').ChromeCevirmeni,
   *   myMemory: import('./metin_cevirmenleri.js').MyMemoryCevirmeni,
   * }} p
   */
  constructor({ ocr, chrome, myMemory }) {
    this.ocr = ocr;
    this.chrome = chrome;
    this.myMemory = myMemory;
  }

  /**
   * @param {{resim: import('../yz/gorsel.js').Resim, hedefDil: string, sinyal?: AbortSignal}} p
   */
  async cevir({ resim, hedefDil, sinyal }) {
    const kullanim = { girdi: 0, cikti: 0 }; // ücretsiz; token yok
    const { kelimeler, genislik, yukseklik } = await this.ocr(resim);
    const gruplar = balonlaraGrupla(kelimeler, { genislik, yukseklik });
    if (!gruplar.length) return { balonlar: [], kullanim };

    // Hedef dil kaynakla aynıysa çeviri gereksiz.
    if (hedefDil === KAYNAK_DIL) {
      return { balonlar: gruplar.map((g) => ({ ...g, tur: 'balon', ceviri: g.orijinal })), kullanim };
    }

    const cevirmen = await metinCevirmeniSec({
      chrome: this.chrome,
      myMemory: this.myMemory,
      kaynak: KAYNAK_DIL,
      hedef: hedefDil,
    });
    const ceviriler = await cevirmen.cevir(
      gruplar.map((g) => cumleDuzeni(g.orijinal)),
      { kaynak: KAYNAK_DIL, hedef: hedefDil, sinyal },
    );
    return {
      // OCR ses efektlerini okuyamadığı için hepsi balon/anlatım sayılır.
      balonlar: gruplar.map((g, i) => ({ ...g, tur: 'balon', ceviri: ceviriler[i]?.trim() || g.orijinal })),
      kullanim,
    };
  }
}
