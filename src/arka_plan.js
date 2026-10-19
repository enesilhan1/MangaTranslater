// Arka plan (Chrome'da service worker, Firefox'ta arka plan sayfası).
// İçerik betiklerinden gelen çeviri isteklerini tek bir öncelikli kuyruk,
// önbellek ve ayarlardaki motorla karşılar (src/mesajlar.js).

import { AyarDeposu, ayarlariTamamla } from './ayarlar.js';
import { Cevirici } from './cevirici.js';
import { Kuyruk } from './kuyruk.js';
import { mesajIsle } from './mesajlar.js';
import { Onbellek, idbArkaUcu } from './onbellek.js';
import { betikKaydiniEsitle } from './siteler.js';
import { tarayici } from './tarayici.js';

const kuyruk = new Kuyruk();
const ayarDeposu = new AyarDeposu(tarayici.storage.local);
const onbellek = new Onbellek(idbArkaUcu());
const cevirici = new Cevirici({ ayarDeposu, onbellek, kuyruk });

tarayici.runtime.onMessage.addListener((mesaj, gonderen, yanitla) => {
  const yanit = mesajIsle(mesaj, gonderen, { cevirici, kuyruk, onbellek });
  if (!yanit) return false; // başkasının mesajı (ör. offscreen belgeye giden)
  uyanikTut();
  yanit.then(yanitla);
  return true; // yanıt eşzamansız
});

// Alt+T: etkin sekmedeki içerik betiğine orijinal ↔ çeviri geçişi.
tarayici.commands.onCommand.addListener(async (komut, sekme) => {
  if (komut !== 'orijinal-ceviri') return;
  const id = sekme?.id ?? (await tarayici.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  // Çeviri açık olmayan sitede içerik betiği yok; hata önemsiz.
  if (id != null) tarayici.tabs.sendMessage(id, { tip: 'gecis' }).catch(() => {});
});

// İçerik betiği yalnızca "her zaman çevir" listesindeki sitelere kayıtlı
// (src/siteler.js). Liste açılır pencerede değişince ve tarayıcı açılınca
// kayıt eşitlenir (Firefox dinamik kayıtları oturumlar arasında
// tutmayabiliyor). Eşitlemeler sıraya konur ki hızlı art arda değişiklikte
// iki kayıt işlemi çakışmasın.
let esitleme = Promise.resolve();
function kaydiEsitle(siteler) {
  esitleme = esitleme
    .then(() => betikKaydiniEsitle(tarayici.scripting, siteler))
    .catch((e) => console.warn('[Manga Çevirmen] içerik betiği kaydı:', e));
}
const listeyleEsitle = async () => kaydiEsitle((await ayarDeposu.oku()).siteler);
tarayici.runtime.onInstalled.addListener(listeyleEsitle);
tarayici.runtime.onStartup.addListener(listeyleEsitle);
tarayici.storage.onChanged.addListener((d, alan) => {
  if (alan !== 'local' || !d.ayarlar) return;
  const eski = ayarlariTamamla(d.ayarlar.oldValue).siteler;
  const yeni = ayarlariTamamla(d.ayarlar.newValue).siteler;
  if (JSON.stringify(eski) !== JSON.stringify(yeni)) kaydiEsitle(yeni);
});

// Kapanan sekmenin bekleyen işleri boşuna çevrilmesin.
tarayici.tabs.onRemoved.addListener((sekme) => kuyruk.onEkIptal(`${sekme}:`));

// Chrome, olay gelmeyen service worker'ı ~30 sn sonra durdurur; uzun bir
// görsel YZ isteği ya da kalabalık kuyruk yarıda kalmasın diye iş varken
// 20 sn'de bir zararsız bir API çağrısıyla uyanık tutulur.
let uyanik = null;
function uyanikTut() {
  uyanik ??= setInterval(() => {
    if (kuyruk.bosMu) {
      clearInterval(uyanik);
      uyanik = null;
    } else {
      tarayici.runtime.getPlatformInfo();
    }
  }, 20_000);
}
