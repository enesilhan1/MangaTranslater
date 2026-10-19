// İçerik betiğinden arka plana mesaj (src/mesajlar.js). Yanıt {sonuc} ya da
// {hata} biçiminde gelir; hata YzHatasi olarak atılır.

import { tarayici } from '../tarayici.js';
import { YzHatasi } from '../yz/ortak.js';

/** Eklenti güncellenip/yeniden yüklenip bu betik sahipsiz kaldı mı? */
export function eklentiKoptuMu() {
  try {
    return !tarayici.runtime?.id;
  } catch {
    return true;
  }
}

export async function arkaPlanaGonder(mesaj) {
  if (eklentiKoptuMu()) throw new YzHatasi('hata.eklentiYenilendi');
  let yanit;
  try {
    yanit = await tarayici.runtime.sendMessage(mesaj);
  } catch (e) {
    if (eklentiKoptuMu() || /context invalidated/i.test(String(e?.message))) {
      throw new YzHatasi('hata.eklentiYenilendi');
    }
    throw new YzHatasi('hata.beklenmeyen', { mesaj: String(e?.message ?? e) });
  }
  if (!yanit) throw new YzHatasi('hata.beklenmeyen', { mesaj: 'arka plan yanıt vermedi' });
  if (yanit.hata) throw new YzHatasi(yanit.hata.anahtar, yanit.hata.parametreler);
  return yanit.sonuc;
}

/** Yanıt beklenmeyen bildirim (öncelik/iptal); hata önemsiz. */
export function arkaPlanaBildir(mesaj) {
  if (eklentiKoptuMu()) return;
  tarayici.runtime.sendMessage(mesaj).catch(() => {});
}
