// Tesseract.js ile resimdeki kelimeleri okur. Worker ve DOM gerektirdiği
// için Chrome'da offscreen belgede, Firefox'ta arka plan sayfasında çalışır
// (ocr_kopru.js); Chrome'un service worker'ında çalışamaz.

import Tesseract from '../../vendor/tesseract/tesseract.esm.min.js';
import { tarayici } from '../tarayici.js';
import { kelimeleriTopla } from './gruplama.js';

/** Tesseract'ın LSTM motoru (OEM 1); eski motor dosyaları pakette yok. */
const YALNIZ_LSTM = 1;
/** Seyrek metin kipi: sırası/düzeni belirsiz dağınık yazılar (manga balonları). */
const SEYREK_METIN = '11';

/** @type {Promise<any> | null} */
let isciSozu = null;

/** Tek bir Tesseract işçisi kurulur ve sonraki resimlerde tekrar kullanılır. */
function isciAl() {
  if (!isciSozu) {
    const url = (yol) => tarayici.runtime.getURL(`vendor/tesseract/${yol}`);
    isciSozu = Tesseract.createWorker('eng', YALNIZ_LSTM, {
      workerPath: url('worker.min.js'),
      corePath: url('cekirdek'),
      langPath: url('dil'),
      // Eklenti sayfalarında blob: worker'a CSP izin vermiyor; dosyadan yüklenir.
      workerBlobURL: false,
      // Dil verisi zaten eklentinin içinde; IndexedDB'ye ayrıca yazmaya gerek yok.
      cacheMethod: 'none',
      gzip: true,
    }).then(async (isci) => {
      await isci.setParameters({ tessedit_pageseg_mode: SEYREK_METIN });
      return isci;
    });
    isciSozu.catch(() => {
      isciSozu = null; // kurulum başarısızsa sonraki çağrı yeniden denesin
    });
  }
  return isciSozu;
}

/**
 * @param {import('../yz/gorsel.js').Resim} resim  Base64 veri + MIME türü.
 * @returns {Promise<{kelimeler: import('./gruplama.js').OcrKelimesi[],
 *   genislik: number, yukseklik: number}>}
 */
export async function kelimeleriOku(resim) {
  const blob = await (await fetch(`data:${resim.tur};base64,${resim.veri}`)).blob();
  const bitmap = await createImageBitmap(blob);
  const { width: genislik, height: yukseklik } = bitmap;
  bitmap.close();

  const isci = await isciAl();
  const { data } = await isci.recognize(blob, {}, { blocks: true, text: false });
  return { kelimeler: kelimeleriTopla(data.blocks), genislik, yukseklik };
}
