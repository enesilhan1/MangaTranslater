import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { geminiSemasi } from '../src/yz/gemini.js';
import { YANIT_SEMASI } from '../src/yz/istem.js';
import { istemciOlustur } from '../src/yz/istemciler.js';
import { modelBul } from '../src/yz/katalog.js';
import { sahteFetch } from './yardimci.js';

const RESIM = { veri: 'QUJD', tur: 'image/jpeg' };
const JSON_YANIT = JSON.stringify({
  balonlar: [{ kutu: [100, 100, 200, 400], orijinal: 'Run!', ceviri: 'Koş!' }],
});

function kur(saglayici, yanitlar, modelId = '') {
  const fetch = sahteFetch(yanitlar);
  const istemci = istemciOlustur({
    model: modelBul(saglayici, modelId),
    apiAnahtari: 'anahtar',
    fetch,
    tekrarBeklemesiMs: 1,
  });
  return { fetch, istemci, cevir: () => istemci.cevir({ resim: RESIM, hedefDil: 'tr' }) };
}

describe('Gemini', () => {
  const yanit = (ek = {}) => ({
    govde: {
      candidates: [{ content: { parts: [{ text: 'düşünce', thought: true }, { text: JSON_YANIT }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 1300, candidatesTokenCount: 80, thoughtsTokenCount: 20 },
      ...ek,
    },
  });

  it('resmi inlineData olarak, JSON şemasıyla gönderir; düşünce parçasını atlar', async () => {
    const { fetch, cevir } = kur('gemini', [yanit()]);
    const s = await cevir();
    assert.equal(s.balonlar.length, 1);
    assert.equal(s.balonlar[0].ceviri, 'Koş!');
    assert.deepEqual(s.kullanim, { girdi: 1300, cikti: 100 });

    const i = fetch.istekler[0];
    assert.match(i.adres, /models\/gemini-3\.8-flash:generateContent$/);
    assert.equal(i.basliklar['x-goog-api-key'], 'anahtar');
    assert.deepEqual(i.govde.contents[0].parts[0], { inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
    assert.match(i.govde.systemInstruction.parts[0].text, /Turkish/);
    const g = i.govde.generationConfig;
    assert.equal(g.responseMimeType, 'application/json');
    assert.equal(g.responseSchema.type, 'OBJECT');
    assert.deepEqual(g.thinkingConfig, { thinkingLevel: 'low' });
  });

  it('elle yazılan modelde düşünme ayarı gönderilmez', async () => {
    const { fetch, cevir } = kur('gemini', [yanit()], 'gemini-2.5-flash');
    await cevir();
    assert.equal(fetch.istekler[0].govde.generationConfig.thinkingConfig, undefined);
  });

  it('aday yoksa ya da güvenlik nedeniyle bittiyse ret hatası', async () => {
    await assert.rejects(kur('gemini', [{ govde: { promptFeedback: { blockReason: 'SAFETY' } } }]).cevir(), {
      anahtar: 'hata.ret',
      parametreler: { ad: 'Gemini' },
    });
    const g = { candidates: [{ content: { parts: [] }, finishReason: 'IMAGE_SAFETY' }] };
    await assert.rejects(kur('gemini', [{ govde: g }]).cevir(), { anahtar: 'hata.ret' });
  });

  it('MAX_TOKENS → uzunluk hatası; kota ve anahtar hataları', async () => {
    const g = { candidates: [{ content: { parts: [{ text: '{"balonlar":[' }] }, finishReason: 'MAX_TOKENS' }] };
    await assert.rejects(kur('gemini', [{ govde: g }]).cevir(), { anahtar: 'hata.uzunluk' });

    const kota = { durum: 429, govde: { error: { message: 'Resource has been exhausted (e.g. check quota).' } } };
    await assert.rejects(kur('gemini', [kota]).cevir(), { anahtar: 'hata.kota.gemini' });

    const anahtar = { durum: 400, govde: { error: { message: 'API key not valid.' } } };
    await assert.rejects(kur('gemini', [anahtar]).cevir(), { anahtar: 'hata.anahtar' });
  });

  it('geminiSemasi tür adlarını büyütür, additionalProperties alanını atar', () => {
    const s = geminiSemasi(YANIT_SEMASI);
    assert.equal(s.additionalProperties, undefined);
    const oge = s.properties.balonlar.items;
    assert.equal(oge.type, 'OBJECT');
    assert.equal(oge.additionalProperties, undefined);
    assert.equal(oge.properties.kutu.items.type, 'INTEGER');
    assert.deepEqual(oge.required, ['kutu', 'orijinal', 'ceviri']);
  });
});

describe('Claude', () => {
  const yanit = (ek = {}) => ({
    govde: {
      content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON_YANIT }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1500, output_tokens: 90 },
      ...ek,
    },
  });

  it('resmi base64 bloğu olarak, yapılandırılmış çıktı ve düşük eforla gönderir', async () => {
    const { fetch, cevir } = kur('anthropic', [yanit()]);
    const s = await cevir();
    assert.equal(s.balonlar[0].orijinal, 'Run!');
    assert.deepEqual(s.kullanim, { girdi: 1500, cikti: 90 });

    const i = fetch.istekler[0];
    assert.equal(i.adres, 'https://api.anthropic.com/v1/messages');
    assert.equal(i.basliklar['x-api-key'], 'anahtar');
    assert.equal(i.basliklar['anthropic-dangerous-direct-browser-access'], 'true');
    assert.equal(i.govde.model, 'claude-sonnet-5-5');
    assert.deepEqual(i.govde.messages[0].content[0], {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' },
    });
    assert.equal(i.govde.output_config.effort, 'low');
    assert.deepEqual(i.govde.output_config.format, { type: 'json_schema', schema: YANIT_SEMASI });
    assert.equal(i.govde.thinking, undefined); // Sonnet 5.5'te "disabled" 400 verir
  });

  it('yedek model yalnızca Sonnet/Opus 5.5\'te', async () => {
    const sonnet = kur('anthropic', [yanit()]);
    await sonnet.cevir();
    assert.equal(sonnet.fetch.istekler[0].govde.fallbacks, 'default');
    assert.equal(sonnet.fetch.istekler[0].basliklar['anthropic-beta'], 'server-side-fallback-2026-07-01');

    const haiku = kur('anthropic', [yanit()], 'claude-haiku-5-5');
    await haiku.cevir();
    assert.equal(haiku.fetch.istekler[0].govde.fallbacks, undefined);
    assert.equal(haiku.fetch.istekler[0].basliklar['anthropic-beta'], undefined);
  });

  it('refusal → ret, max_tokens → uzunluk, bakiye hatası', async () => {
    await assert.rejects(kur('anthropic', [yanit({ stop_reason: 'refusal', content: [] })]).cevir(), {
      anahtar: 'hata.ret',
      parametreler: { ad: 'Claude' },
    });
    await assert.rejects(kur('anthropic', [yanit({ stop_reason: 'max_tokens' })]).cevir(), {
      anahtar: 'hata.uzunluk',
    });
    const bakiye = { durum: 400, govde: { error: { message: 'Your credit balance is too low' } } };
    await assert.rejects(kur('anthropic', [bakiye]).cevir(), { anahtar: 'hata.bakiye.anthropic' });
  });
});

describe('ChatGPT', () => {
  const yanit = (ek = {}) => ({
    govde: {
      output: [
        { type: 'reasoning', summary: [] },
        { type: 'message', content: [{ type: 'output_text', text: JSON_YANIT }] },
      ],
      usage: { input_tokens: 1100, output_tokens: 70 },
      ...ek,
    },
  });

  it('resmi data URL olarak, katı json_schema ve düşük eforla gönderir', async () => {
    const { fetch, cevir } = kur('openai', [yanit()]);
    const s = await cevir();
    assert.equal(s.balonlar.length, 1);
    assert.deepEqual(s.kullanim, { girdi: 1100, cikti: 70 });

    const i = fetch.istekler[0];
    assert.equal(i.adres, 'https://api.openai.com/v1/responses');
    assert.equal(i.basliklar.authorization, 'Bearer anahtar');
    assert.deepEqual(i.govde.input[0].content[0], {
      type: 'input_image',
      image_url: 'data:image/jpeg;base64,QUJD',
      detail: 'high',
    });
    assert.deepEqual(i.govde.text.format, { type: 'json_schema', name: 'balonlar', schema: YANIT_SEMASI, strict: true });
    assert.deepEqual(i.govde.reasoning, { effort: 'low' });
    assert.equal(i.govde.store, false);
  });

  it('refusal parçası → ret, yarım yanıt → uzunluk, kota bitti → bakiye', async () => {
    const ret = { output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] };
    await assert.rejects(kur('openai', [{ govde: ret }]).cevir(), { anahtar: 'hata.ret' });
    await assert.rejects(
      kur('openai', [yanit({ incomplete_details: { reason: 'max_output_tokens' } })]).cevir(),
      { anahtar: 'hata.uzunluk' },
    );
    const kota = { durum: 429, govde: { error: { message: 'You exceeded your current quota' } } };
    await assert.rejects(kur('openai', [kota]).cevir(), { anahtar: 'hata.bakiye.openai' });
  });
});

describe('istemciOlustur', () => {
  it('bilinmeyen sağlayıcıda hata', () => {
    assert.throws(() => istemciOlustur({ model: { saglayici: 'deepseek', id: 'x' }, apiAnahtari: 'a' }), /Bilinmeyen/);
  });
});
