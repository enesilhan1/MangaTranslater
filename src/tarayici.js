// Chrome ve Firefox için ortak eklenti API'si. Firefox `browser` adıyla
// promise döndüren API'yi verir; Chrome (ve Edge, Brave gibi Chromium
// tabanlılar) `chrome` adıyla aynısını verir.

export const tarayici = globalThis.browser ?? globalThis.chrome;

/**
 * Resimleri almak ve içerik betiğini çalıştırmak için gereken site erişimi.
 * Kurulumda istenmez (manifest optional_host_permissions); kullanıcı bir
 * siteyi listeye eklerken ya da "şimdi çevir"e basınca açılır pencereden
 * istenir. Bütün siteler: manga resimleri çoğu zaman sitenin kendisinden
 * değil, alan adı değişen ayrı sunuculardan geliyor. Çeviri servisleri
 * (Gemini, OpenAI, Anthropic, MyMemory) eklentiye CORS ile izin verdiği
 * için onlara erişim izni gerekmez.
 */
export const SITE_IZNI = { origins: ['<all_urls>'] };

/**
 * Site erişimi verilmiş mi? Firefox bu izni kullanıcıya bırakır (kapatılabilir),
 * Chrome'da da kullanıcı "tıklayınca" ya da belirli sitelerle sınırlayabilir.
 */
export async function siteIzniVarMi(api = tarayici) {
  try {
    return await api.permissions.contains(SITE_IZNI);
  } catch {
    return true; // izin API'si yoksa (ör. testler) engel sayma
  }
}
