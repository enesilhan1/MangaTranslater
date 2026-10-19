// "Bu sitede her zaman çevir" listesi (docs/SPEC.md §4). Listede alan adları
// tutulur ("www." olmadan); bir alan adı alt alan adlarını da kapsar
// (mangadex.org → www.mangadex.org, cdn.mangadex.org). İçerik betiği
// yalnızca bu sitelere kaydedilir; listede olmayan sitede eklenti hiçbir şey
// yapmaz.

/** Kayıtlı içerik betiğinin kimliği (tek kayıt, bütün siteler). */
export const BETIK_KIMLIGI = 'manga-cevirmen';
export const YUKLEYICI = 'src/icerik/yukleyici.js';

/**
 * Adresin alan adı ("www." olmadan, küçük harf); http(s) değilse null
 * (chrome://, about:, dosya, eklenti sayfaları listeye eklenemez).
 */
export function alanAdi(adres) {
  let u;
  try {
    u = new URL(adres);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return u.hostname.toLowerCase().replace(/^www\./, '') || null;
}

/** [ad] listedeki bir alan adının kendisi ya da alt alan adı mı? */
export function siteKapsar(siteler, ad) {
  if (!ad) return false;
  return siteler.some((s) => ad === s || ad.endsWith(`.${s}`));
}

/** Listeye ekler (zaten kapsanıyorsa değiştirmez); sıralı, yinelenmesiz. */
export function siteEkle(siteler, ad) {
  if (!ad || siteKapsar(siteler, ad)) return [...siteler];
  return [...siteler, ad].sort();
}

/**
 * [ad]'ı kapsayan bütün kayıtları çıkarır: www.mangadex.org'da "kapat"
 * denince listedeki mangadex.org da çıkar, yoksa site açık kalırdı.
 */
export function siteCikar(siteler, ad) {
  return siteler.filter((s) => !(ad === s || ad.endsWith(`.${s}`)));
}

/** İçerik betiği kaydının eşleşme desenleri. */
export function desenler(siteler) {
  return siteler.flatMap((s) => [`*://${s}/*`, `*://*.${s}/*`]);
}

/**
 * İçerik betiği kaydını site listesine eşitler: önce eski kayıt silinir,
 * liste boş değilse yenisi yapılır. Arka planda liste değişince ve tarayıcı
 * açılınca çağrılır (Firefox kayıtları oturumlar arasında tutmayabiliyor).
 */
export async function betikKaydiniEsitle(scripting, siteler) {
  const kayitli = await scripting.getRegisteredContentScripts({ ids: [BETIK_KIMLIGI] });
  if (kayitli.length) await scripting.unregisterContentScripts({ ids: [BETIK_KIMLIGI] });
  if (!siteler.length) return;
  await scripting.registerContentScripts([
    {
      id: BETIK_KIMLIGI,
      matches: desenler(siteler),
      js: [YUKLEYICI],
      runAt: 'document_idle',
      allFrames: false,
    },
  ]);
}
