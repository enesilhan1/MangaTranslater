import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AyarDeposu } from '../src/ayarlar.js';
import { base64tenBayt, bayttanBase64 } from '../src/base64.js';
import { Cevirici } from '../src/cevirici.js';
import { Kuyruk } from '../src/kuyruk.js';
import { Onbellek } from '../src/onbellek.js';
import { sahteAlan } from './yardimci.js';

function bellekOnbellek() {
  const m = new Map();
  return new Onbellek({
    al: async (a) => m.get(a),
    koy: async (k) => void m.set(k.anahtar, k),
    say: async () => m.size,
    enEskileriSil: async () => {},
    temizle: async () => m.clear(),
  });
}

const RESIM = { veri: 'QUJD', tur: 'image/jpeg' };
const BALON = { x: 0.1, y: 0.1, g: 0.2, h: 0.1, orijinal: 'Hi', ceviri: 'Selam' };

function kur(ayarlar, { gorselCagri = [], yerelCagri = [] } = {}) {
  const ayarDeposu = new AyarDeposu(sahteAlan({ ayarlar }));
  const kuyruk = new Kuyruk();
  const c = new Cevirici({
    ayarDeposu,
    onbellek: bellekOnbellek(),
    kuyruk,
    gorselOlustur: (p) => ({
      cevir: async (i) => (gorselCagri.push({ ...p, ...i }), { balonlar: [BALON], kullanim: {} }),
    }),
    yerelOlustur: (p) => ({
      cevir: async (i) => (yerelCagri.push({ ...p, ...i }), { balonlar: [{ ...BALON, ceviri: 'yerel' }] }),
    }),
  });
  return { c, ayarDeposu, kuyruk, gorselCagri, yerelCagri };
}

describe('Cevirici', () => {
  it('görsel motor seçili modelle ve anahtarla çalışır, ikinci kez önbellekten gelir', async () => {
    const t = kur({ saglayici: 'anthropic', anahtarlar: { anthropic: ' sk-ant-x ' }, hedefDil: 'de' });
    const s1 = await t.c.dilimCevir({ id: '1:a#0', oncelik: 3, resim: RESIM });
    assert.deepEqual(s1, { balonlar: [BALON], onbellekten: false });
    assert.equal(t.gorselCagri[0].model.id, 'claude-sonnet-5-5');
    assert.equal(t.gorselCagri[0].apiAnahtari, 'sk-ant-x');
    assert.equal(t.gorselCagri[0].hedefDil, 'de');
    assert.equal(t.kuyruk.esZaman, 3);

    const s2 = await t.c.dilimCevir({ id: '2:b#0', oncelik: 3, resim: RESIM });
    assert.equal(s2.onbellekten, true);
    assert.equal(t.gorselCagri.length, 1);
  });

  it('hedef dil ya da model değişince önbellek kullanılmaz', async () => {
    const t = kur({ anahtarlar: { gemini: 'k' } });
    await t.c.dilimCevir({ id: 'a', oncelik: 1, resim: RESIM });
    await t.ayarDeposu.guncelle((a) => ({ ...a, hedefDil: 'en' }));
    await t.c.dilimCevir({ id: 'b', oncelik: 1, resim: RESIM });
    await t.ayarDeposu.guncelle((a) => ({ ...a, modeller: { gemini: 'gemini-4-argon' } }));
    await t.c.dilimCevir({ id: 'c', oncelik: 1, resim: RESIM });
    assert.equal(t.gorselCagri.length, 3);
  });

  it('anahtar yoksa sağlayıcı adıyla anahtarYok hatası, istek gitmez', async () => {
    const t = kur({ saglayici: 'openai' });
    await assert.rejects(t.c.dilimCevir({ id: 'a', oncelik: 1, resim: RESIM }), {
      anahtar: 'hata.anahtarYok',
      parametreler: { ad: 'ChatGPT' },
    });
    assert.equal(t.gorselCagri.length, 0);
  });

  it('yerel motor tek işçiyle; köprü e-posta değişmedikçe yeniden kurulmaz', async () => {
    const t = kur({ motor: 'yerel', eposta: 'a@b.c' });
    const s = await t.c.dilimCevir({ id: 'a', oncelik: 1, resim: RESIM });
    assert.equal(s.balonlar[0].ceviri, 'yerel');
    assert.equal(t.kuyruk.esZaman, 1);
    const ilk = t.c._yerel.kopru;
    await t.c.dilimCevir({ id: 'b', oncelik: 1, resim: { ...RESIM, veri: 'QUJE' } });
    assert.equal(t.c._yerel.kopru, ilk);
    await t.ayarDeposu.guncelle((a) => ({ ...a, eposta: 'x@y.z' }));
    await t.c.dilimCevir({ id: 'c', oncelik: 1, resim: { ...RESIM, veri: 'QUJF' } });
    assert.notEqual(t.c._yerel.kopru, ilk);
    assert.equal(t.yerelCagri.at(-1).eposta, 'x@y.z');
  });
});

describe('Cevirici: boş sonuç', () => {
  it('yazısız sonuç önbelleğe yazılmaz; eski boş kayıt yok sayılır, model yeniden sorulur', async () => {
    const cagri = [];
    const onbellek = bellekOnbellek();
    const c = new Cevirici({
      ayarDeposu: new AyarDeposu(sahteAlan({ ayarlar: { anahtarlar: { gemini: 'k' } } })),
      onbellek,
      kuyruk: new Kuyruk(),
      gorselOlustur: () => ({ cevir: async () => (cagri.push(1), { balonlar: [] }) }),
    });
    await c.dilimCevir({ id: 'a', oncelik: 1, resim: RESIM });
    await c.dilimCevir({ id: 'b', oncelik: 1, resim: RESIM });
    assert.equal(cagri.length, 2, 'boş sonuç önbellekten gelmemeli');
  });
});

describe('base64', () => {
  it('büyük bayt dizisini gidiş-dönüş bozmadan çevirir', () => {
    const b = new Uint8Array(100_000).map((_, i) => (i * 7) % 256);
    const geri = base64tenBayt(bayttanBase64(b.buffer));
    assert.deepEqual(geri, b);
    assert.equal(bayttanBase64(new Uint8Array([65, 66, 67])), 'QUJD');
  });
});
