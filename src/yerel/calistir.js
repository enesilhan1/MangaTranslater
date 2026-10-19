// Yerel motoru gerçekten çalıştıran taraf: Chrome'da offscreen belge,
// Firefox'ta arka plan sayfası. Worker ve DOM gerektiren OCR (ve Chrome'da
// yalnızca pencere bağlamında bulunan Translator API) burada kullanılır.

import { YzHatasi } from '../yz/ortak.js';
import { ChromeCevirmeni, MyMemoryCevirmeni } from './metin_cevirmenleri.js';
import { kelimeleriOku } from './ocr.js';
import { YerelCevirmen } from './yerel_cevirmen.js';

/** Chrome çevirmeni dil paketlerini kurduktan sonra tekrar kullanmak için tek örnek. */
const chrome = new ChromeCevirmeni();

/** @param {{eposta?: string}} [p]  MyMemory e-postası (ayarlardan). */
export function yerelCevirmenOlustur({ eposta = '' } = {}) {
  return new YerelCevirmen({ ocr: kelimeleriOku, chrome, myMemory: new MyMemoryCevirmeni({ eposta }) });
}

/** Hata mesajla taşınabilsin diye düz nesneye çevrilir (kopru.js geri kurar). */
export function hatayiPaketle(e) {
  if (e instanceof YzHatasi) return { anahtar: e.anahtar, parametreler: e.parametreler };
  return { anahtar: 'hata.beklenmeyen', parametreler: { mesaj: String(e?.message ?? e) } };
}
