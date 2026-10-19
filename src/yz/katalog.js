// Görsel çeviri için kullanılabilecek yapay zekâ sağlayıcıları ve modelleri
// (docs/SPEC.md §2.1). Hepsi resim okuyabilir; hız önemli olduğu için her
// sağlayıcıda hızlı modeller önce. Fiyatlar milyon token başına ABD doları,
// Ekim 2026.

/** @typedef {{tr: string, en: string}} IkiDilli */

/**
 * @typedef {Object} YzModeli
 * @property {string} saglayici
 * @property {string} id
 * @property {string} ad
 * @property {IkiDilli} aciklama
 * @property {boolean} [elle]   Kullanıcının elle yazdığı, listede olmayan model.
 * @property {number} [girdi]
 * @property {number} [cikti]
 */

export const SAGLAYICILAR = [
  {
    id: 'gemini',
    ad: 'Gemini (Google)',
    kisaAd: 'Gemini',
    anahtarSayfasi: 'https://aistudio.google.com/apikey',
    anahtarOneki: null,
    modeller: [
      {
        id: 'gemini-3.8-flash',
        ad: 'Gemini 3.8 Flash',
        aciklama: { tr: 'Hızlı, ücretsiz kotası var (önerilen)', en: 'Fast, has a free tier (recommended)' },
        girdi: 0.75, cikti: 3.75,
      },
      {
        id: 'gemini-3.5-flash-lite',
        ad: 'Gemini 3.5 Flash-Lite',
        aciklama: { tr: 'En ucuzu, ücretsiz kotası var', en: 'Cheapest, has a free tier' },
        girdi: 0.3, cikti: 2.5,
      },
      {
        id: 'gemini-4-argon',
        ad: 'Gemini 4 Argon',
        aciklama: { tr: 'En güçlüsü, yavaş, ücretsiz kotası yok', en: 'Most powerful, slower, no free tier' },
        girdi: 2, cikti: 10,
      },
    ],
  },
  {
    id: 'anthropic',
    ad: 'Claude (Anthropic)',
    kisaAd: 'Claude',
    anahtarSayfasi: 'https://console.anthropic.com/settings/keys',
    anahtarOneki: 'sk-ant-',
    modeller: [
      {
        id: 'claude-sonnet-5-5',
        ad: 'Claude Sonnet 5.5',
        aciklama: { tr: 'Hızlı ve kaliteli (önerilen)', en: 'Fast and accurate (recommended)' },
        girdi: 2, cikti: 10,
      },
      {
        id: 'claude-haiku-5-5',
        ad: 'Claude Haiku 5.5',
        aciklama: { tr: 'En hızlı ve en ucuzu', en: 'Fastest and cheapest' },
        girdi: 0.1, cikti: 0.5,
      },
      {
        id: 'claude-opus-5-5',
        ad: 'Claude Opus 5.5',
        aciklama: { tr: 'En akıllısı, daha yavaş', en: 'Most capable, slower' },
        girdi: 4, cikti: 20,
      },
    ],
  },
  {
    id: 'openai',
    ad: 'ChatGPT (OpenAI)',
    kisaAd: 'ChatGPT',
    anahtarSayfasi: 'https://platform.openai.com/api-keys',
    anahtarOneki: 'sk-',
    modeller: [
      {
        id: 'gpt-6.1-sol',
        ad: 'GPT-6.1 Sol',
        aciklama: { tr: 'Dengeli (önerilen)', en: 'Balanced (recommended)' },
        girdi: 2, cikti: 10,
      },
      {
        id: 'gpt-6-luna',
        ad: 'GPT-6 Luna',
        aciklama: { tr: 'En hızlı ve en ucuzu', en: 'Fastest and cheapest' },
        girdi: 0.1, cikti: 0.5,
      },
      {
        id: 'gpt-6-astra',
        ad: 'GPT-6 Astra',
        aciklama: { tr: 'En güçlüsü, pahalı', en: 'Most powerful, expensive' },
        girdi: 10, cikti: 50,
      },
    ],
  },
].map((s) => ({ ...s, modeller: s.modeller.map((m) => ({ ...m, saglayici: s.id })) }));

export const VARSAYILAN_SAGLAYICI = 'gemini';

/** Kimliğe göre sağlayıcı; bilinmiyorsa Gemini. */
export function saglayiciBul(id) {
  return SAGLAYICILAR.find((s) => s.id === id) ?? SAGLAYICILAR[0];
}

/**
 * Kayıtlı model kimliğine göre model; boşsa varsayılan, listede yoksa
 * elle yazılmış model.
 * @returns {YzModeli}
 */
export function modelBul(saglayiciId, modelId) {
  const s = saglayiciBul(saglayiciId);
  const id = (modelId ?? '').trim();
  if (!id) return s.modeller[0];
  return (
    s.modeller.find((m) => m.id === id) ?? {
      saglayici: s.id,
      id,
      ad: id,
      aciklama: { tr: 'Elle yazılan model', en: 'Custom model' },
      elle: true,
    }
  );
}

/**
 * @typedef {Object} Kullanim
 * @property {number} girdi   Resim dahil girdi token'ı.
 * @property {number} cikti   Düşünme dahil çıktı token'ı.
 */

/** Yaklaşık maliyet (dolar); fiyat bilinmiyorsa null. */
export function maliyet(model, k) {
  if (model.girdi == null || model.cikti == null) return null;
  return ((k.girdi ?? 0) * model.girdi + (k.cikti ?? 0) * model.cikti) / 1e6;
}

/** Anahtarın beklenen ön ekle başlayıp başlamadığı (sadece uyarı için). */
export function anahtarBicimiUygun(saglayiciId, anahtar) {
  const onek = saglayiciBul(saglayiciId).anahtarOneki;
  return !onek || anahtar.trim().startsWith(onek);
}
