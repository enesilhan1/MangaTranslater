// Arka plandan yerel motora köprü. Chrome'un service worker'ı Worker
// oluşturamadığı ve DOM'u olmadığı için yerel motor orada çalışamaz:
// - Chrome: istek bir offscreen belgeye (offscreen/yerel.html) mesajla gider.
// - Firefox: offscreen API yok ama arka plan zaten DOM'lu bir sayfa;
//   motor doğrudan çalıştırılır.
// İki durumda da dışarıya görsel istemcilerle aynı cevir() arayüzü sunulur.
// Ayrıca yalnızca OCR (kelimeleriOku): görsel YZ'nin balonsuz metinlerini
// harflerin yerine oturtmak için (src/ocr_oturtma.js).

import { tarayici } from '../tarayici.js';
import { YzHatasi } from '../yz/ortak.js';

/** Offscreen belgeye giden mesajların işareti (arka plan bunları yok sayar). */
export const OFFSCREEN_HEDEFI = 'offscreen-yerel';
const OFFSCREEN_ADRESI = 'offscreen/yerel.html';

/** Aynı anda birden çok çağrı tek belge açsın diye. */
let belgeSozu = null;

async function offscreenHazirla(api) {
  const acik = await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (acik.length) return;
  belgeSozu ??= api.offscreen
    .createDocument({
      url: OFFSCREEN_ADRESI,
      reasons: ['WORKERS'],
      justification: 'Tesseract OCR bir Web Worker içinde çalışır; service worker Worker oluşturamaz.',
    })
    .finally(() => {
      belgeSozu = null;
    });
  await belgeSozu;
}

/**
 * @param {{api?: any, eposta?: string,
 *   dogrudanOlustur?: (p: {eposta: string}) => Promise<{cevir: Function}>,
 *   dogrudanOcr?: (resim: object) => Promise<object>}} [p]
 *   [dogrudanOlustur]/[dogrudanOcr] Firefox yolunda motoru/OCR'yi kurar (testlerde sahtesi).
 */
export function yerelCevirmenKopru({ api = tarayici, eposta = '', dogrudanOlustur, dogrudanOcr } = {}) {
  if (api.offscreen?.createDocument) {
    return {
      async cevir({ resim, hedefDil }) {
        await offscreenHazirla(api);
        const yanit = await api.runtime.sendMessage({ hedef: OFFSCREEN_HEDEFI, resim, hedefDil, eposta });
        if (!yanit) throw new YzHatasi('hata.beklenmeyen', { mesaj: 'offscreen yanıt vermedi' });
        if (yanit.hata) throw new YzHatasi(yanit.hata.anahtar, yanit.hata.parametreler);
        return yanit.sonuc;
      },
      async kelimeleriOku(resim) {
        await offscreenHazirla(api);
        const yanit = await api.runtime.sendMessage({ hedef: OFFSCREEN_HEDEFI, islem: 'ocr', resim });
        if (!yanit) throw new YzHatasi('hata.beklenmeyen', { mesaj: 'offscreen yanıt vermedi' });
        if (yanit.hata) throw new YzHatasi(yanit.hata.anahtar, yanit.hata.parametreler);
        return yanit.sonuc;
      },
    };
  }

  // Firefox: Tesseract yalnızca yerel motor ilk kez kullanılınca yüklenir.
  const olustur =
    dogrudanOlustur ?? (async (p) => (await import('./calistir.js')).yerelCevirmenOlustur(p));
  const ocr = dogrudanOcr ?? (async (resim) => (await import('./calistir.js')).kelimeleriOku(resim));
  let motor = null;
  return {
    async cevir(istek) {
      motor ??= olustur({ eposta });
      return (await motor).cevir(istek);
    },
    kelimeleriOku: (resim) => ocr(resim),
  };
}
