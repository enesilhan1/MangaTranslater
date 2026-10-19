// İçerik betiğinden arka plana gelen mesajlar. Her yanıt {sonuc} ya da
// {hata: {anahtar, parametreler}} biçimindedir (YzHatasi mesajla
// taşınamadığı için).
//
//   {tip: 'cevir', resimKimligi, dilim, oncelik, resim: {veri, tur}}
//       → {balonlar, onbellekten}
//   {tip: 'oncelik', resimKimligi, oncelik}   (yanıt beklenmez)
//   {tip: 'iptal', resimKimligi?}             (yoksa sekmenin tüm işleri)
//   {tip: 'resimGetir', adres}                → {veri, tur}
//
// Açılır pencereden (sekmesiz gönderen):
//   {tip: 'onbellekTemizle'}
//
// Kuyruk kimliği "<sekme>:<resimKimligi>#<dilim>": böylece bir sekmenin ya
// da bir resmin bütün dilimleri ön ekle bulunur.

import { bayttanBase64 } from './base64.js';
import { hatayiPaketle, YzHatasi } from './yz/ortak.js';

/** Bu boyuttan büyük resim indirilmez (bozuk/kötü niyetli adreslere karşı). */
export const AZAMI_RESIM_BAYTI = 30 * 1024 * 1024;

const kimlik = (sekme, resim, dilim) => `${sekme}:${resim}#${dilim}`;

/**
 * @param {any} mesaj
 * @param {{tab?: {id: number}}} gonderen
 * @param {{cevirici: import('./cevirici.js').Cevirici,
 *   kuyruk: import('./kuyruk.js').Kuyruk, onbellek?: import('./onbellek.js').Onbellek,
 *   fetch?: typeof fetch}} ortam
 * @returns {Promise<object> | null}  Yanıt (null: bu mesaj bizim değil).
 */
export function mesajIsle(mesaj, gonderen, { cevirici, kuyruk, onbellek, fetch: f = globalThis.fetch }) {
  if (typeof mesaj?.tip !== 'string') return null;
  const sar = (is) =>
    Promise.resolve()
      .then(is)
      .then((sonuc) => ({ sonuc }), (e) => ({ hata: hatayiPaketle(e) }));

  const sekme = gonderen?.tab?.id;
  if (sekme == null) {
    // Açılır pencere ya da başka bir eklenti sayfası.
    if (mesaj.tip === 'onbellekTemizle') return sar(() => onbellek.temizle().then(() => true));
    return null;
  }

  switch (mesaj.tip) {
    case 'cevir':
      return sar(() =>
        cevirici.dilimCevir({
          id: kimlik(sekme, mesaj.resimKimligi, mesaj.dilim),
          oncelik: mesaj.oncelik,
          resim: mesaj.resim,
        }),
      );
    case 'oncelik':
      kuyruk.onEkOncelik(`${sekme}:${mesaj.resimKimligi}#`, mesaj.oncelik);
      return Promise.resolve({ sonuc: true });
    case 'iptal':
      kuyruk.onEkIptal(mesaj.resimKimligi == null ? `${sekme}:` : `${sekme}:${mesaj.resimKimligi}#`);
      return Promise.resolve({ sonuc: true });
    case 'resimGetir':
      return sar(() => resimGetir(mesaj.adres, f));
    default:
      return null;
  }
}

/**
 * Başka alan adındaki resmi arka planda indirir. İçerik betiği, sayfanın
 * CORS kuralları yüzünden çoğu manga CDN'inden resmi okuyamıyor; arka plan
 * site izniyle okuyabiliyor.
 */
export async function resimGetir(adres, f = globalThis.fetch) {
  let url;
  try {
    url = new URL(adres);
  } catch {
    throw new YzHatasi('hata.resimAlinamadi', { mesaj: 'geçersiz adres' });
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new YzHatasi('hata.resimAlinamadi', { mesaj: url.protocol });
  }
  let y;
  try {
    y = await f(url.href, { credentials: 'include' });
  } catch {
    throw new YzHatasi('hata.resimAlinamadi', { mesaj: 'bağlantı' });
  }
  if (!y.ok) throw new YzHatasi('hata.resimAlinamadi', { mesaj: `HTTP ${y.status}` });
  const tur = (y.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!tur.startsWith('image/')) throw new YzHatasi('hata.resimAlinamadi', { mesaj: tur || 'tür yok' });
  const veri = await y.arrayBuffer();
  if (veri.byteLength > AZAMI_RESIM_BAYTI) throw new YzHatasi('hata.resimAlinamadi', { mesaj: 'çok büyük' });
  return { veri: bayttanBase64(veri), tur };
}
