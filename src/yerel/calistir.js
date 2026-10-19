// Yerel motoru gerçekten çalıştıran taraf: Chrome'da offscreen belge,
// Firefox'ta arka plan sayfası. Worker ve DOM gerektiren OCR (ve Chrome'da
// yalnızca pencere bağlamında bulunan Translator API) burada kullanılır.

import { ChromeCevirmeni, MyMemoryCevirmeni } from './metin_cevirmenleri.js';
import { kelimeleriOku } from './ocr.js';
import { YerelCevirmen } from './yerel_cevirmen.js';

/** Chrome çevirmeni dil paketlerini kurduktan sonra tekrar kullanmak için tek örnek. */
const chrome = new ChromeCevirmeni();

/** @param {{eposta?: string}} [p]  MyMemory e-postası (ayarlardan). */
export function yerelCevirmenOlustur({ eposta = '' } = {}) {
  return new YerelCevirmen({ ocr: kelimeleriOku, chrome, myMemory: new MyMemoryCevirmeni({ eposta }) });
}
