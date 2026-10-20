import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { balonlariCoz } from '../src/yz/cozumle.js';

const yakin = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

describe('balonlariCoz', () => {
  it('0-1000 kutuyu 0-1 oranlı x/y/g/h yapar', () => {
    const [b] = balonlariCoz(
      JSON.stringify({ balonlar: [{ kutu: [100, 200, 300, 600], orijinal: 'Hi!', ceviri: 'Selam!' }] }),
      'Gemini',
    );
    yakin(b.x, 0.2);
    yakin(b.y, 0.1);
    yakin(b.g, 0.4);
    yakin(b.h, 0.2);
    assert.equal(b.orijinal, 'Hi!');
    assert.equal(b.ceviri, 'Selam!');
  });

  it('kod bloğu ve açıklama içindeki JSON\'u bulur; düz dizi de olur', () => {
    const metin = 'İşte:\n```json\n{"balonlar":[{"kutu":[0,0,500,500],"orijinal":"A","ceviri":"B"}]}\n```';
    assert.equal(balonlariCoz(metin, 'X').length, 1);
    const dizi = '[{"kutu":[0,0,500,500],"orijinal":"A","ceviri":"B"}]';
    assert.equal(balonlariCoz(dizi, 'X').length, 1);
  });

  it('0-1 ölçeğindeki kutuları tanır', () => {
    const [b] = balonlariCoz('{"balonlar":[{"kutu":[0.1,0.2,0.3,0.6],"orijinal":"A","ceviri":"B"}]}', 'X');
    yakin(b.x, 0.2);
    yakin(b.g, 0.4);
  });

  it('ters köşeleri düzeltir, taşanları sınırlar', () => {
    const [b] = balonlariCoz('{"balonlar":[{"kutu":[300,600,-50,1200],"orijinal":"A","ceviri":"B"}]}', 'X');
    yakin(b.x, 0.6);
    yakin(b.y, 0);
    yakin(b.g, 0.4);
    yakin(b.h, 0.3);
  });

  it('bozuk/boş kayıtları atar, çeviri boşsa orijinali kullanır, boşlukları toplar', () => {
    const j = {
      balonlar: [
        { kutu: [0, 0, 100], orijinal: 'eksik kutu', ceviri: 'x' },
        { kutu: [0, 0, 100, 'a'], orijinal: 'sayı değil', ceviri: 'x' },
        { kutu: [0, 0, 100, 100], orijinal: '', ceviri: '' },
        { kutu: [10, 10, 11, 11], orijinal: 'çok küçük', ceviri: 'x' },
        { kutu: [0, 0, 100, 100], orijinal: '  BOOM\n!  ', ceviri: '' },
        null,
      ],
    };
    const b = balonlariCoz(JSON.stringify(j), 'X');
    assert.equal(b.length, 1);
    assert.equal(b[0].ceviri, 'BOOM !');
  });

  it('yazı yoksa boş liste', () => {
    assert.deepEqual(balonlariCoz('{"balonlar":[]}', 'X'), []);
  });

  it('JSON bulunamazsa bozukYanit hatası', () => {
    assert.throws(() => balonlariCoz('Üzgünüm, yapamam.', 'Claude'), {
      anahtar: 'hata.bozukYanit',
      parametreler: { ad: 'Claude' },
    });
    assert.throws(() => balonlariCoz('{"baska":1}', 'X'), { anahtar: 'hata.bozukYanit' });
  });

  it('türü okur (İngilizce eş adlarıyla), bilinmeyen tür balon; box_2d eş adı', () => {
    const j = { balonlar: [
      { kutu: [0, 0, 100, 100], tur: 'ses', orijinal: 'BOOM', ceviri: 'GÜM' },
      { box_2d: [0, 0, 100, 100], tur: 'Narration', orijinal: 'A', ceviri: 'B' },
      { kutu: [0, 0, 100, 100], orijinal: 'A', ceviri: 'B' },
    ] };
    assert.deepEqual(balonlariCoz(JSON.stringify(j), 'X').map((b) => b.tur), ['ses', 'anlatim', 'balon']);
  });
});
