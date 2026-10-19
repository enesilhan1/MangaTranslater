// Arka plandan gelen yerel çeviri isteklerini karşılar (src/yerel/kopru.js).

import { tarayici } from '../src/tarayici.js';
import { hatayiPaketle, yerelCevirmenOlustur } from '../src/yerel/calistir.js';
import { OFFSCREEN_HEDEFI } from '../src/yerel/kopru.js';

/** E-posta değişince MyMemory istemcisi yeniden kurulur; OCR işçisi ortak kalır. */
let motor = null;
let motorEpostasi = null;

tarayici.runtime.onMessage.addListener((mesaj, _gonderen, yanitla) => {
  if (mesaj?.hedef !== OFFSCREEN_HEDEFI) return false;
  if (!motor || motorEpostasi !== mesaj.eposta) {
    motor = yerelCevirmenOlustur({ eposta: mesaj.eposta });
    motorEpostasi = mesaj.eposta;
  }
  motor
    .cevir({ resim: mesaj.resim, hedefDil: mesaj.hedefDil })
    .then((sonuc) => yanitla({ sonuc }))
    .catch((e) => yanitla({ hata: hatayiPaketle(e) }));
  return true; // yanıt eşzamansız
});
