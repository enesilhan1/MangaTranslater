import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SAGLAYICILAR,
  VARSAYILAN_SAGLAYICI,
  anahtarBicimiUygun,
  maliyet,
  modelBul,
  saglayiciBul,
} from '../src/yz/katalog.js';

describe('Katalog', () => {
  it('üç görsel sağlayıcı, varsayılan Gemini, DeepSeek yok', () => {
    assert.deepEqual(SAGLAYICILAR.map((s) => s.id), ['gemini', 'anthropic', 'openai']);
    assert.equal(VARSAYILAN_SAGLAYICI, 'gemini');
    for (const s of SAGLAYICILAR) {
      assert.ok(s.modeller.length >= 2);
      for (const m of s.modeller) {
        assert.equal(m.saglayici, s.id);
        assert.ok(m.aciklama.tr && m.aciklama.en);
      }
    }
  });

  it('modelBul: boşsa varsayılan, listede yoksa elle yazılan', () => {
    assert.equal(modelBul('gemini', '').id, 'gemini-3.8-flash');
    assert.equal(modelBul('anthropic', undefined).id, 'claude-sonnet-5-5');
    assert.equal(modelBul('openai', 'gpt-6-luna').ad, 'GPT-6 Luna');
    const elle = modelBul('anthropic', '  ozel-model ');
    assert.equal(elle.id, 'ozel-model');
    assert.equal(elle.elle, true);
    assert.equal(elle.saglayici, 'anthropic');
    assert.equal(saglayiciBul('deepseek').id, 'gemini');
  });

  it('maliyet: bilinen modelde dolar, elle yazılanda null', () => {
    const m = modelBul('anthropic', 'claude-haiku-5-5');
    assert.equal(maliyet(m, { girdi: 1e6, cikti: 1e6 }), 0.6);
    assert.equal(maliyet(modelBul('openai', 'ozel'), { girdi: 1 }), null);
  });

  it('anahtar ön eki kontrolü', () => {
    assert.equal(anahtarBicimiUygun('anthropic', 'sk-ant-abc'), true);
    assert.equal(anahtarBicimiUygun('anthropic', 'sk-abc'), false);
    assert.equal(anahtarBicimiUygun('gemini', 'AIza...'), true);
  });
});
