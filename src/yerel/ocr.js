// Tesseract.js ile resimdeki kelimeleri okur. Worker ve DOM gerektirdiği
// için Chrome'da offscreen belgede, Firefox'ta arka plan sayfasında çalışır
// (kopru.js); Chrome'un service worker'ında çalışamaz.

import Tesseract from '../../vendor/tesseract/tesseract.esm.min.js';
import { tarayici } from '../tarayici.js';
import { kelimeleriTopla } from './gruplama.js';
import { buyutmeOlcegi } from './on_isleme.js';

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
  const olcek = buyutmeOlcegi(bitmap.width, bitmap.height);
  const genislik = Math.round(bitmap.width * olcek);
  const yukseklik = Math.round(bitmap.height * olcek);

  let girdi = blob;
  if (olcek > 1) {
    const tuval = new OffscreenCanvas(genislik, yukseklik);
    const ctx = tuval.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, genislik, yukseklik);
    girdi = await tuval.convertToBlob({ type: 'image/png' });
  }
  bitmap.close();

  const isci = await isciAl();
  const { data } = await isci.recognize(girdi, {}, { blocks: true, text: false });
  // Kutular büyütülmüş resmin pikselleriyle; boyut da onunla verilir, oranlar değişmez.
  return { kelimeler: kelimeleriTopla(data.blocks), genislik, yukseklik };
}
