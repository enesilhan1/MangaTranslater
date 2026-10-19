import { AZAMI_CIKTI, GorselIstemci, YanitSonu } from './gorsel.js';
import { YANIT_SEMASI } from './istem.js';
import { YzHatasi, sayi } from './ortak.js';

/** Anthropic Messages API (POST /v1/messages). */
export class AnthropicIstemcisi extends GorselIstemci {
  static ad = 'Claude';
  static adres = 'https://api.anthropic.com/v1/messages';

  /**
   * Sunucu taraflı yedek model ("fallbacks": "default"): güvenlik
   * sınıflandırıcısı bir isteği reddederse API uygun bir yedek modelle
   * kendisi tekrar dener. Opus 5.5 ve Sonnet 5.5'te var, Haiku'da yok;
   * elle yazılan modellerde bilinmediği için gönderilmez.
   */
  get yedekModel() {
    return this.model.id === 'claude-opus-5-5' || this.model.id === 'claude-sonnet-5-5';
  }

  govde({ resim, sistem, metin }) {
    return {
      model: this.model.id,
      max_tokens: AZAMI_CIKTI,
      system: sistem,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: resim.tur, data: resim.veri } },
            { type: 'text', text: metin },
          ],
        },
      ],
      output_config: {
        // Okuma + çeviri için düşük efor yeterli ve en hızlısı.
        effort: 'low',
        format: { type: 'json_schema', schema: YANIT_SEMASI },
      },
      ...(this.yedekModel ? { fallbacks: 'default' } : {}),
    };
  }

  async iste({ resim, sistem, metin, sinyal }) {
    const j = await this.istek.gonder(AnthropicIstemcisi.adres, {
      saglayiciAdi: this.ad,
      sinyal,
      basliklar: {
        'x-api-key': this.apiAnahtari,
        'anthropic-version': '2023-06-01',
        // Tarayıcıdan (eklentiden) doğrudan çağrı için gerekli; anahtar
        // kullanıcının kendisine ait ve yalnızca onun bilgisayarında.
        'anthropic-dangerous-direct-browser-access': 'true',
        ...(this.yedekModel ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
      },
      govde: this.govde({ resim, sistem, metin }),
      hataCevir: (durum, mesaj) =>
        durum === 400 && mesaj.toLowerCase().includes('credit balance')
          ? new YzHatasi('hata.bakiye.anthropic')
          : null,
    });

    const icerik = Array.isArray(j.content) ? j.content : [];
    const u = j.usage ?? {};
    return {
      metin: icerik
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join(''),
      son:
        j.stop_reason === 'refusal'
          ? YanitSonu.RET
          : j.stop_reason === 'max_tokens'
            ? YanitSonu.UZUNLUK
            : YanitSonu.BITTI,
      kullanim: {
        girdi:
          sayi(u, 'input_tokens') +
          sayi(u, 'cache_read_input_tokens') +
          sayi(u, 'cache_creation_input_tokens'),
        cikti: sayi(u, 'output_tokens'),
      },
    };
  }
}
