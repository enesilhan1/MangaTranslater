import { AZAMI_CIKTI, GorselIstemci, YanitSonu } from './gorsel.js';
import { YANIT_SEMASI } from './istem.js';
import { YzHatasi, sayi } from './ortak.js';

/** OpenAI Responses API (POST /v1/responses). */
export class OpenAiIstemcisi extends GorselIstemci {
  static ad = 'ChatGPT';
  static adres = 'https://api.openai.com/v1/responses';

  govde({ resim, sistem, metin }) {
    return {
      model: this.model.id,
      instructions: sistem,
      input: [
        {
          role: 'user',
          content: [
            // Küçük balon yazıları için tam çözünürlük.
            { type: 'input_image', image_url: `data:${resim.tur};base64,${resim.veri}`, detail: 'high' },
            { type: 'input_text', text: metin },
          ],
        },
      ],
      reasoning: { effort: 'low' },
      text: { format: { type: 'json_schema', name: 'balonlar', schema: YANIT_SEMASI, strict: true } },
      max_output_tokens: AZAMI_CIKTI,
      store: false,
    };
  }

  async iste({ resim, sistem, metin, sinyal }) {
    const j = await this.istek.gonder(OpenAiIstemcisi.adres, {
      saglayiciAdi: this.ad,
      sinyal,
      basliklar: { authorization: `Bearer ${this.apiAnahtari}` },
      govde: this.govde({ resim, sistem, metin }),
      hataCevir: (durum, mesaj) =>
        durum === 429 && mesaj.toLowerCase().includes('quota')
          ? new YzHatasi('hata.bakiye.openai')
          : null,
    });

    let yanitMetni = '';
    let ret = false;
    for (const o of Array.isArray(j.output) ? j.output : []) {
      if (o.type !== 'message') continue;
      for (const p of o.content ?? []) {
        if (p.type === 'output_text') yanitMetni += p.text;
        if (p.type === 'refusal') ret = true;
      }
    }
    const neden = j.incomplete_details?.reason;
    const u = j.usage ?? {};
    return {
      metin: yanitMetni,
      son:
        ret || neden === 'content_filter'
          ? YanitSonu.RET
          : neden === 'max_output_tokens'
            ? YanitSonu.UZUNLUK
            : YanitSonu.BITTI,
      kullanim: { girdi: sayi(u, 'input_tokens'), cikti: sayi(u, 'output_tokens') },
    };
  }
}
