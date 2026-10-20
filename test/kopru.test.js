import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OFFSCREEN_HEDEFI, yerelCevirmenKopru } from '../src/yerel/kopru.js';

const ISTEK = { resim: { veri: 'QUJD', tur: 'image/png' }, hedefDil: 'tr' };

/** Sahte Chrome: offscreen belgeyi açar, mesajlara [yanit] ile döner. */
function sahteChrome(yanit) {
  const api = {
    acilan: [],
    mesajlar: [],
    acik: false,
    runtime: {
      getContexts: async () => (api.acik ? [{}] : []),
      sendMessage: async (m) => (api.mesajlar.push(m), yanit),
    },
    offscreen: {
      createDocument: async (s) => {
        await new Promise((r) => setTimeout(r, 5));
        api.acilan.push(s);
        api.acik = true;
      },
    },
  };
  return api;
}

describe('yerelCevirmenKopru (Chrome, offscreen)', () => {
  it('belgeyi bir kez açar, isteği işaretli mesajla gönderir, sonucu döndürür', async () => {
    const api = sahteChrome({ sonuc: { balonlar: [1], kullanim: {} } });
    const k = yerelCevirmenKopru({ api, eposta: 'a@b.c' });
    const [s1] = await Promise.all([k.cevir(ISTEK), k.cevir(ISTEK)]);
    await k.cevir(ISTEK);
    assert.deepEqual(s1.balonlar, [1]);
    assert.equal(api.acilan.length, 1);
    assert.equal(api.acilan[0].url, 'offscreen/yerel.html');
    assert.deepEqual(api.acilan[0].reasons, ['WORKERS']);
    assert.deepEqual(api.mesajlar[0], { hedef: OFFSCREEN_HEDEFI, ...ISTEK, eposta: 'a@b.c' });
  });

  it('paketlenmiş hatayı YzHatasi olarak geri kurar; yanıt yoksa beklenmeyen hata', async () => {
    const hata = { hata: { anahtar: 'hata.mymemory.kota', parametreler: { x: 1 } } };
    await assert.rejects(yerelCevirmenKopru({ api: sahteChrome(hata) }).cevir(ISTEK), {
      name: 'YzHatasi',
      anahtar: 'hata.mymemory.kota',
      parametreler: { x: 1 },
    });
    await assert.rejects(yerelCevirmenKopru({ api: sahteChrome(undefined) }).cevir(ISTEK), {
      anahtar: 'hata.beklenmeyen',
    });
  });
});

describe('yerelCevirmenKopru (Firefox, doğrudan)', () => {
  it('motoru ilk istekte bir kez kurar ve doğrudan çalıştırır', async () => {
    let kurulum = 0;
    const dogrudanOlustur = async ({ eposta }) => {
      kurulum++;
      return { cevir: async (i) => ({ eposta, hedefDil: i.hedefDil }) };
    };
    const k = yerelCevirmenKopru({ api: { runtime: {} }, eposta: 'e', dogrudanOlustur });
    assert.equal(kurulum, 0); // Tesseract gereksiz yere yüklenmesin
    assert.deepEqual(await k.cevir(ISTEK), { eposta: 'e', hedefDil: 'tr' });
    await k.cevir(ISTEK);
    assert.equal(kurulum, 1);
  });

  it('yalnızca OCR: Firefox yolunda doğrudan, Chrome yolunda işlem: ocr mesajıyla', async () => {
    const k = yerelCevirmenKopru({ api: { runtime: {} }, dogrudanOcr: async (r) => ({ kelimeler: [], genislik: r.n }) });
    assert.deepEqual(await k.kelimeleriOku({ n: 5 }), { kelimeler: [], genislik: 5 });
  });
});

describe('yerelCevirmenKopru OCR (Chrome)', () => {
  it('offscreen belgeye islem: ocr ile gider', async () => {
    const api = sahteChrome({ sonuc: { kelimeler: [1] } });
    const s = await yerelCevirmenKopru({ api }).kelimeleriOku(ISTEK.resim);
    assert.deepEqual(s, { kelimeler: [1] });
    assert.deepEqual(api.mesajlar[0], { hedef: OFFSCREEN_HEDEFI, islem: 'ocr', resim: ISTEK.resim });
  });
});
