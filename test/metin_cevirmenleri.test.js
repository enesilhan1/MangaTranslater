import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ChromeCevirmeni,
  MyMemoryCevirmeni,
  metinCevirmeniSec,
  parcala,
} from '../src/yerel/metin_cevirmenleri.js';

/** Sahte Translator API. [durum] availability sonucu. */
function sahteTranslator({ durum = 'available', createHatasi } = {}) {
  const api = {
    olusturulan: [],
    availability: async () => durum,
    create: async (s) => {
      api.olusturulan.push(s);
      if (createHatasi) throw createHatasi;
      return { translate: async (m) => `[${s.targetLanguage}] ${m}` };
    },
  };
  return api;
}

describe('ChromeCevirmeni', () => {
  it('çeviri sırasını korur, dil çifti başına bir kez kurar, zh-CN → zh', async () => {
    const api = sahteTranslator();
    const c = new ChromeCevirmeni(api);
    assert.deepEqual(await c.cevir(['a', 'b'], { kaynak: 'en', hedef: 'tr' }), ['[tr] a', '[tr] b']);
    await c.cevir(['c'], { kaynak: 'en', hedef: 'tr' });
    await c.cevir(['d'], { kaynak: 'en', hedef: 'zh-CN' });
    assert.deepEqual(
      api.olusturulan.map((s) => [s.sourceLanguage, s.targetLanguage]),
      [['en', 'tr'], ['en', 'zh']],
    );
  });

  it('API yoksa ya da hata verirse unavailable', async () => {
    assert.equal(new ChromeCevirmeni(undefined).varMi, false);
    assert.equal(await new ChromeCevirmeni(undefined).durum('en', 'tr'), 'unavailable');
    const bozuk = { create() {}, availability: async () => { throw new Error('x'); } };
    assert.equal(await new ChromeCevirmeni(bozuk).durum('en', 'tr'), 'unavailable');
  });

  it('paket inmemişken tıklamasız kurulum → hazirla hatası; sonra yeniden denenir', async () => {
    const hata = Object.assign(new Error('Requires user activation'), { name: 'NotAllowedError' });
    const api = sahteTranslator({ durum: 'downloadable', createHatasi: hata });
    const c = new ChromeCevirmeni(api);
    await assert.rejects(c.cevir(['a'], { kaynak: 'en', hedef: 'tr' }), { anahtar: 'hata.cevirmen.hazirla' });
    await assert.rejects(c.cevir(['a'], { kaynak: 'en', hedef: 'tr' }));
    assert.equal(api.olusturulan.length, 2);
  });

  it('hazirla indirme ilerlemesini bildirir', async () => {
    const oranlar = [];
    const api = {
      availability: async () => 'downloadable',
      create: async (s) => {
        s.monitor({ addEventListener: (_, f) => [0.5, 1].forEach((loaded) => f({ loaded })) });
        return { translate: async (m) => m };
      },
    };
    await new ChromeCevirmeni(api).hazirla('en', 'tr', (o) => oranlar.push(o));
    assert.deepEqual(oranlar, [0.5, 1]);
  });
});

/** MyMemory için sahte fetch: GET adreslerini kaydeder. */
function sahteMyMemory(yanit) {
  const adresler = [];
  const f = async (adres) => {
    adresler.push(new URL(adres));
    const q = new URL(adres).searchParams.get('q');
    const g = typeof yanit === 'function' ? yanit(q) : yanit;
    if (g instanceof Error) throw g;
    return { text: async () => JSON.stringify(g) };
  };
  f.adresler = adresler;
  return f;
}
const tamam = (q) => ({ responseData: { translatedText: `TR:${q}` }, responseStatus: 200 });

describe('MyMemoryCevirmeni', () => {
  it('her metni sırası korunarak çevirir, dil çifti ve e-posta gönderir', async () => {
    const fetch = sahteMyMemory(tamam);
    const c = new MyMemoryCevirmeni({ fetch, eposta: ' ben@ornek.com ' });
    const s = await c.cevir(['bir', 'iki', 'üç', 'dört', 'beş'], { kaynak: 'en', hedef: 'tr' });
    assert.deepEqual(s, ['TR:bir', 'TR:iki', 'TR:üç', 'TR:dört', 'TR:beş']);
    assert.equal(fetch.adresler[0].searchParams.get('langpair'), 'en|tr');
    assert.equal(fetch.adresler[0].searchParams.get('de'), 'ben@ornek.com');
  });

  it('e-posta yoksa de parametresi gönderilmez; uzun metin parçalanır', async () => {
    const fetch = sahteMyMemory(tamam);
    const uzun = `${'a'.repeat(300)}. ${'b'.repeat(300)}.`;
    const [s] = await new MyMemoryCevirmeni({ fetch }).cevir([uzun], { kaynak: 'en', hedef: 'tr' });
    assert.equal(fetch.adresler.length, 2);
    assert.equal(fetch.adresler[0].searchParams.has('de'), false);
    assert.equal(s, `TR:${'a'.repeat(300)}. TR:${'b'.repeat(300)}.`);
  });

  it('kota dolunca e-posta önerisiyle ya da e-postalıysa düz kota hatası', async () => {
    const uyari = { responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' }, responseStatus: 429 };
    await assert.rejects(
      new MyMemoryCevirmeni({ fetch: sahteMyMemory(uyari) }).cevir(['a'], { kaynak: 'en', hedef: 'tr' }),
      { anahtar: 'hata.mymemory.kotaEposta' },
    );
    await assert.rejects(
      new MyMemoryCevirmeni({ fetch: sahteMyMemory({ quotaFinished: true, responseStatus: 200 }), eposta: 'a@b.c' })
        .cevir(['a'], { kaynak: 'en', hedef: 'tr' }),
      { anahtar: 'hata.mymemory.kota' },
    );
  });

  it('metin olarak gelen hata durumu ve ağ hatası', async () => {
    const red = { responseData: { translatedText: 'INVALID' }, responseStatus: '403', responseDetails: 'INVALID TARGET' };
    await assert.rejects(
      new MyMemoryCevirmeni({ fetch: sahteMyMemory(red) }).cevir(['a'], { kaynak: 'en', hedef: 'xx' }),
      { anahtar: 'hata.reddetti', parametreler: { ad: 'MyMemory', durum: 403, mesaj: 'INVALID TARGET' } },
    );
    await assert.rejects(
      new MyMemoryCevirmeni({ fetch: sahteMyMemory(new TypeError('Failed to fetch')) }).cevir(['a'], { kaynak: 'en', hedef: 'tr' }),
      { anahtar: 'hata.baglanti' },
    );
  });
});

describe('parcala', () => {
  it('cümle sınırından, yoksa kelime sınırından, o da yoksa sertçe böler', () => {
    assert.deepEqual(parcala('kısa', 10), ['kısa']);
    assert.deepEqual(parcala('Bir iki. Üç dört beş.', 12), ['Bir iki.', 'Üç dört beş.']);
    assert.deepEqual(parcala('aaaa bbbb cccc', 10), ['aaaa bbbb', 'cccc']);
    assert.deepEqual(parcala('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
  });
});

describe('metinCevirmeniSec', () => {
  const myMemory = new MyMemoryCevirmeni({ fetch: sahteMyMemory(tamam) });
  it('yerleşik çevirmen dil çiftini destekliyorsa onu, değilse MyMemory', async () => {
    const chrome = new ChromeCevirmeni(sahteTranslator({ durum: 'downloadable' }));
    assert.equal(await metinCevirmeniSec({ chrome, myMemory, kaynak: 'en', hedef: 'tr' }), chrome);
    const desteksiz = new ChromeCevirmeni(sahteTranslator({ durum: 'unavailable' }));
    assert.equal(await metinCevirmeniSec({ chrome: desteksiz, myMemory, kaynak: 'en', hedef: 'tr' }), myMemory);
    assert.equal(await metinCevirmeniSec({ myMemory, kaynak: 'en', hedef: 'tr' }), myMemory); // Firefox
  });
});
