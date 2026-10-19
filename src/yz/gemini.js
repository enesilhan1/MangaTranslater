import { AZAMI_CIKTI, GorselIstemci, YanitSonu } from './gorsel.js';
import { YANIT_SEMASI } from './istem.js';
import { YzHatasi, sayi } from './ortak.js';

/** Google Gemini API (POST /v1beta/models/{model}:generateContent). */
export class GeminiIstemcisi extends GorselIstemci {
  static ad = 'Gemini';

  get adres() {
    return (
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      `${encodeURIComponent(this.model.id)}:generateContent`
    );
  }

  govde({ resim, sistem, metin }) {
    return {
      systemInstruction: { parts: [{ text: sistem }] },
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: resim.tur, data: resim.veri } }, { text: metin }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: geminiSemasi(YANIT_SEMASI),
        maxOutputTokens: AZAMI_CIKTI,
        // Hız için az düşünme. Elle yazılan (ör. eski) modeller bu alanı
        // tanımayabileceği için yalnızca listedeki modellerde gönderilir.
        ...(this.model.elle ? {} : { thinkingConfig: { thinkingLevel: 'low' } }),
      },
    };
  }

  async iste({ resim, sistem, metin, sinyal }) {
    const j = await this.istek.gonder(this.adres, {
      saglayiciAdi: this.ad,
      sinyal,
      basliklar: { 'x-goog-api-key': this.apiAnahtari },
      govde: this.govde({ resim, sistem, metin }),
      hataCevir: (durum, mesaj) => {
        const k = mesaj.toLowerCase();
        if (durum === 400 && k.includes('api key')) return new YzHatasi('hata.anahtar', { ad: this.ad });
        if (durum === 429 && (k.includes('quota') || k.includes('exhausted'))) {
          return new YzHatasi('hata.kota.gemini');
        }
        return null;
      },
    });

    const u = j.usageMetadata ?? {};
    const kullanim = {
      girdi: sayi(u, 'promptTokenCount'),
      cikti: sayi(u, 'candidatesTokenCount') + sayi(u, 'thoughtsTokenCount'),
    };

    const aday = Array.isArray(j.candidates) ? j.candidates[0] : null;
    // Aday yoksa istek güvenlik filtresine takılmıştır (promptFeedback.blockReason).
    if (!aday) return { metin: '', son: YanitSonu.RET, kullanim };

    const parcalar = Array.isArray(aday.content?.parts) ? aday.content.parts : [];
    const yanitMetni = parcalar
      .filter((p) => typeof p.text === 'string' && p.thought !== true)
      .map((p) => p.text)
      .join('');
    const neden = aday.finishReason;
    const retNedenleri = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY'];
    return {
      metin: yanitMetni,
      son:
        neden === 'MAX_TOKENS'
          ? YanitSonu.UZUNLUK
          : retNedenleri.includes(neden)
            ? YanitSonu.RET
            : YanitSonu.BITTI,
      kullanim,
    };
  }
}

/**
 * JSON Schema'yı Gemini'nin responseSchema biçimine çevirir: tür adları
 * büyük harf (OBJECT, STRING...), Gemini'nin tanımadığı
 * additionalProperties atılır. Diğer alanlar aynen kalır.
 */
export function geminiSemasi(sema) {
  const donustur = (d) => {
    if (Array.isArray(d)) return d.map(donustur);
    if (!d || typeof d !== 'object') return d;
    const sonuc = {};
    for (const [k, v] of Object.entries(d)) {
      if (k === 'additionalProperties') continue;
      if (k === 'type' && typeof v === 'string') sonuc[k] = v.toUpperCase();
      else if (k === 'properties' && v && typeof v === 'object') {
        sonuc[k] = Object.fromEntries(Object.entries(v).map(([p, s]) => [p, donustur(s)]));
      } else sonuc[k] = donustur(v);
    }
    return sonuc;
  };
  return donustur(sema);
}
