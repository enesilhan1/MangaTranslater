import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ChromeCevirmeni, MyMemoryCevirmeni } from '../src/yerel/metin_cevirmenleri.js';
import { YerelCevirmen } from '../src/yerel/yerel_cevirmen.js';

const k = (metin, x, y) => ({ metin, guven: 90, kutu: { x0: x, y0: y, x1: x + metin.length * 12, y1: y + 20 } });
const OCR_SONUCU = {
  kelimeler: [k("I'M", 100, 100), k('HUNGRY.', 150, 100), k('ME', 600, 600), k('TOO!', 640, 600)],
  genislik: 1000,
  yukseklik: 1000,
};
const RESIM = { veri: 'QUJD', tur: 'image/png' };

/** Çevirdiği metinleri kaydeden sahte metin çevirmeni. */
function kaydeden(onek) {
  const c = { gelen: [], cevir: async (metinler) => (c.gelen.push(...metinler), metinler.map((m) => `${onek}${m}`)) };
  return c;
}

describe('YerelCevirmen', () => {
  it('OCR → balon → cümle düzeninde çeviri; görsel istemcilerle aynı biçim', async () => {
    const myMemory = kaydeden('TR:');
    const y = new YerelCevirmen({ ocr: async () => OCR_SONUCU, myMemory });
    const s = await y.cevir({ resim: RESIM, hedefDil: 'tr' });
    assert.deepEqual(myMemory.gelen, ["I'm hungry.", 'Me too!']);
    assert.deepEqual(s.balonlar.map((b) => [b.orijinal, b.ceviri]), [
      ["I'M HUNGRY.", "TR:I'm hungry."],
      ['ME TOO!', 'TR:Me too!'],
    ]);
    for (const b of s.balonlar) for (const a of ['x', 'y', 'g', 'h']) assert.ok(b[a] >= 0 && b[a] <= 1);
    assert.deepEqual(s.kullanim, { girdi: 0, cikti: 0 });
  });

  it('Chrome yerleşik çevirmeni varsa onu kullanır', async () => {
    const chrome = new ChromeCevirmeni({
      availability: async () => 'available',
      create: async () => ({ translate: async (m) => `C:${m}` }),
    });
    const myMemory = kaydeden('M:');
    const s = await new YerelCevirmen({ ocr: async () => OCR_SONUCU, chrome, myMemory }).cevir({ resim: RESIM, hedefDil: 'de' });
    assert.equal(s.balonlar[0].ceviri, "C:I'm hungry.");
    assert.equal(myMemory.gelen.length, 0);
  });

  it('yazı yoksa çeviri servisine hiç gitmez; hedef İngilizceyse orijinal kalır', async () => {
    const myMemory = kaydeden('X');
    const bos = await new YerelCevirmen({
      ocr: async () => ({ kelimeler: [], genislik: 10, yukseklik: 10 }),
      myMemory,
    }).cevir({ resim: RESIM, hedefDil: 'tr' });
    assert.deepEqual(bos.balonlar, []);

    const en = await new YerelCevirmen({ ocr: async () => OCR_SONUCU, myMemory }).cevir({ resim: RESIM, hedefDil: 'en' });
    assert.equal(en.balonlar[0].ceviri, "I'M HUNGRY.");
    assert.equal(myMemory.gelen.length, 0);
  });

  it('boş gelen çeviride orijinal gösterilir; servis hatası aynen iletilir', async () => {
    const bosDonen = { cevir: async (m) => m.map(() => ' ') };
    const s = await new YerelCevirmen({ ocr: async () => OCR_SONUCU, myMemory: bosDonen }).cevir({ resim: RESIM, hedefDil: 'tr' });
    assert.equal(s.balonlar[1].ceviri, 'ME TOO!');

    const kota = { responseData: { translatedText: 'MYMEMORY WARNING' }, responseStatus: 429 };
    const myMemory = new MyMemoryCevirmeni({ fetch: async () => ({ text: async () => JSON.stringify(kota) }) });
    await assert.rejects(
      new YerelCevirmen({ ocr: async () => OCR_SONUCU, myMemory }).cevir({ resim: RESIM, hedefDil: 'tr' }),
      { anahtar: 'hata.mymemory.kotaEposta' },
    );
  });
});
