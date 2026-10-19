import { AnthropicIstemcisi } from './anthropic.js';
import { GeminiIstemcisi } from './gemini.js';
import { JsonIstegi } from './http_istegi.js';
import { OpenAiIstemcisi } from './openai.js';

const SINIFLAR = {
  gemini: GeminiIstemcisi,
  anthropic: AnthropicIstemcisi,
  openai: OpenAiIstemcisi,
};

/**
 * Modelin sağlayıcısına göre görsel çeviri istemcisi oluşturur.
 * @param {{model: import('./katalog.js').YzModeli, apiAnahtari: string,
 *   fetch?: typeof fetch, tekrarBeklemesiMs?: number}} p
 * @returns {import('./gorsel.js').GorselIstemci}
 */
export function istemciOlustur({ model, apiAnahtari, fetch, tekrarBeklemesiMs }) {
  const Sinif = SINIFLAR[model.saglayici];
  if (!Sinif) throw new Error(`Bilinmeyen sağlayıcı: ${model.saglayici}`);
  return new Sinif({ model, apiAnahtari, istek: new JsonIstegi({ fetch, tekrarBeklemesiMs }) });
}
