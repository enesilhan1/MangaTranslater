import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { heceSinirlari, hecele } from '../src/icerik/heceleme.js';

const goster = (s) => s.replaceAll('­', '-');

describe('Türkçe heceleme', () => {
  it('hece kuralları: tek ünsüzden önce, ünsüz kümesinde sonuncudan önce, yan yana ünlü arası', () => {
    assert.equal(goster(hecele('sınıflandırılıyor', 'tr')), 'sı-nıf-lan-dı-rı-lı-yor');
    assert.equal(goster(hecele('Kesinlikle', 'tr')), 'Ke-sin-lik-le');
    assert.equal(goster(hecele('saatlerce', 'tr')), 'sa-at-ler-ce');
    assert.equal(goster(hecele('İnsanlığın', 'tr')), 'İn-san-lı-ğın');
  });

  it('kısa kelimeler ve diğer diller olduğu gibi; noktalama korunur', () => {
    assert.equal(hecele('Bu kıyafet ne böyle!?', 'tr'), 'Bu kıyafet ne böyle!?');
    assert.equal(goster(hecele('"Dünya"nın gerçeği, sınıflandırılıyor:', 'tr')), '"Dünya"nın gerçeği, sı-nıf-lan-dı-rı-lı-yor:');
    assert.equal(hecele('sınıflandırılıyor', 'en'), 'sınıflandırılıyor');
  });

  it('kelimenin başında ve sonunda tek harflik parça bırakmaz', () => {
    for (const s of heceSinirlari('arabalarımızdan')) assert.ok(s >= 2 && 'arabalarımızdan'.length - s >= 2);
  });
});
