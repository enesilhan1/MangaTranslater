import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AyarDeposu } from '../src/ayarlar.js';
import { base64tenBayt, bayttanBase64 } from '../src/base64.js';
import { Cevirici } from '../src/cevirici.js';
import { Kuyruk } from '../src/kuyruk.js';
import { Onbellek, kayitAnahtari, ozetCikar } from '../src/onbellek.js';
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

describe('Cevirici: balonsuz metinlerde OCR', () => {
  function kur(modelBalonlari, { ocrHata = false } = {}) {
    const ocrCagri = [];
    const c = new Cevirici({
      ayarDeposu: new AyarDeposu(sahteAlan({ ayarlar: { anahtarlar: { gemini: 'k' } } })),
      onbellek: bellekOnbellek(),
      kuyruk: new Kuyruk(),
      gorselOlustur: () => ({ cevir: async () => ({ balonlar: modelBalonlari }) }),
      yerelOlustur: () => ({
        kelimeleriOku: async (r) => {
          ocrCagri.push(r);
          if (ocrHata) throw new Error('OCR yok');
          return { genislik: 100, yukseklik: 100, kelimeler: [{ metin: 'HELLO', guven: 90, kutu: { x0: 60, y0: 60, x1: 90, y1: 70 } }] };
        },
      }),
    });
    return { c, ocrCagri };
  }
  const numarali = { x: 0.1, y: 0.1, g: 0.1, h: 0.1, tur: 'balon', bolge: 1, orijinal: 'HI', ceviri: 'Selam' };
  const balonsuz = { x: 0.5, y: 0.5, g: 0.1, h: 0.05, tur: 'anlatim', bolge: 0, orijinal: 'HELLO', ceviri: 'Merhaba' };

  it('yalnızca numaralı metinler varsa OCR çalışmaz', async () => {
    const t = kur([numarali]);
    await t.c.dilimCevir({ id: 'a', oncelik: 1, resim: RESIM });
    assert.equal(t.ocrCagri.length, 0);
  });

  it('önbellekteki eski (OCR öncesi) sonuç bir kez düzeltilip önbelleğe yazılır', async () => {
    const t1 = kur([balonsuz]);
    // Önbelleğe eski sürüm kaydı koy: model sonucu olduğu gibi.
    const ozet = await ozetCikar(RESIM.veri);
    await t1.c.onbellek.koy(kayitAnahtari(ozet, 'gorsel:gemini:gemini-3.8-flash', 'tr'), [balonsuz]);
    const s1 = await t1.c.dilimCevir({ id: 'a', oncelik: 1, resim: RESIM });
    assert.equal(s1.onbellekten, true);
    assert.equal(s1.balonlar[0].ocrOturdu, true);
    const s2 = await t1.c.dilimCevir({ id: 'b', oncelik: 1, resim: RESIM });
    assert.equal(s2.balonlar[0].ocrOturdu, true);
    assert.equal(t1.ocrCagri.length, 1, 'ikinci gelişte OCR tekrar çalışmamalı');
  });

  it('eski OCR kurallarıyla denenmiş (ocrDenendi: true) kayıt bir kez daha denenir', async () => {
    const t = kur([balonsuz]);
    const ozet = await ozetCikar(RESIM.veri);
    await t.c.onbellek.koy(kayitAnahtari(ozet, 'gorsel:gemini:gemini-3.8-flash', 'tr'), [{ ...balonsuz, ocrDenendi: true }]);
    const s = await t.c.dilimCevir({ id: 'a', oncelik: 1, resim: RESIM });
    assert.equal(s.balonlar[0].ocrOturdu, true);
    await t.c.dilimCevir({ id: 'b', oncelik: 1, resim: RESIM });
    assert.equal(t.ocrCagri.length, 1);
  });

  it('balonsuz metin OCR kelimesine oturur; OCR hatasında modelin kutusu kalır', async () => {
    const t = kur([numarali, balonsuz]);
    const s = await t.c.dilimCevir({ id: 'a', oncelik: 1, resim: RESIM });
    assert.equal(t.ocrCagri.length, 1);
    assert.equal(s.balonlar[1].ocrOturdu, true);
    assert.ok(s.balonlar[1].x > 0.55);
    const h = kur([balonsuz], { ocrHata: true });
    const s2 = await h.c.dilimCevir({ id: 'b', oncelik: 1, resim: RESIM });
    assert.deepEqual(s2.balonlar, [balonsuz]);
  });
});

describe('Cevirici: şüpheli numara', () => {
  function kur(model) {
    const ocrCagri = [];
    const c = new Cevirici({
      ayarDeposu: new AyarDeposu(sahteAlan({ ayarlar: { anahtarlar: { gemini: 'k' } } })),
      onbellek: bellekOnbellek(),
      kuyruk: new Kuyruk(),
      gorselOlustur: () => ({ cevir: async () => ({ balonlar: model }) }),
      yerelOlustur: () => ({
        kelimeleriOku: async (r) => (ocrCagri.push(r), {
          genislik: 100, yukseklik: 100,
          kelimeler: [{ metin: 'FORSE', guven: 90, kutu: { x0: 60, y0: 60, x1: 75, y1: 64 } }, { metin: 'MORTO', guven: 90, kutu: { x0: 60, y0: 66, x1: 75, y1: 70 } }],
        }),
      }),
    });
    return { c, ocrCagri };
  }
  // Kedinin gözü: 4 parçalı işaretli alan; 24 harflik metin ona sığmaz.
  const resim = { ...RESIM, bolgeler: [{ no: 1, kutu: [0, 0, 100, 100], parca: 30 }, { no: 2, kutu: [450, 300, 500, 380], parca: 4 }] };
  const metin = (orijinal, bolge) => ({ x: 0.3, y: 0.45, g: 0.08, h: 0.05, tur: 'balon', bolge, orijinal, ceviri: 'x' });

  it('sığmayacağı alanın numarasını alan metin OCR ile asıl yazısına taşınır, numarası düşer', async () => {
    const t = kur([metin('FORSE PENSAVANO FOSSI MORTO', 2)]);
    const s = await t.c.dilimCevir({ id: 'a', oncelik: 1, resim });
    assert.equal(t.ocrCagri.length, 1);
    assert.equal(s.balonlar[0].ocrOturdu, true);
    assert.equal(s.balonlar[0].bolge, 0);
    assert.ok(s.balonlar[0].x > 0.55);
  });

  it('OCR bulamazsa numarasıyla kalır; sığan numaralı metin OCR beklemez', async () => {
    const t = kur([metin('NIENTE DI SIMILE QUI DENTRO', 2)]);
    const s = await t.c.dilimCevir({ id: 'a', oncelik: 1, resim });
    assert.equal(s.balonlar[0].bolge, 2);
    assert.notEqual(s.balonlar[0].ocrOturdu, true);
    const u = kur([metin('FORSE PENSAVANO FOSSI MORTO', 1)]);
    await u.c.dilimCevir({ id: 'a', oncelik: 1, resim });
    assert.equal(u.ocrCagri.length, 0);
  });
});

describe('Cevirici: model balonların çoğunu atladı', () => {
  const bolgeler = (n) => Array.from({ length: n }, (_, i) => ({ no: i + 1, kutu: [0, 0, 10, 10] }));
  const kayit = (bolge) => ({ x: 0.1, y: 0.1, g: 0.1, h: 0.1, tur: 'balon', bolge, orijinal: 'A', ceviri: 'B' + bolge });
  function kur(yanitlar) {
    const cagri = [];
    const c = new Cevirici({
      ayarDeposu: new AyarDeposu(sahteAlan({ ayarlar: { anahtarlar: { gemini: 'k' } } })),
      onbellek: bellekOnbellek(),
      kuyruk: new Kuyruk(),
      gorselOlustur: () => ({ cevir: async () => ({ balonlar: yanitlar[Math.min(cagri.push(1), yanitlar.length) - 1] }) }),
    });
    return { c, cagri };
  }

  it('7 işaretten 1 metin: bir kez daha sorulur, daha çok kapsayan yanıt kalır, önbellekten tekrar sorulmaz', async () => {
    const t = kur([[kayit(1)], [1, 2, 3, 4, 5, 6, 7].map(kayit)]);
    const resim = { ...RESIM, bolgeler: bolgeler(7) };
    const s = await t.c.dilimCevir({ id: 'a', oncelik: 1, resim });
    assert.equal(t.cagri.length, 2);
    assert.equal(s.balonlar.length, 7);
    assert.equal(s.tani.yenidenSoruldu, true);
    await t.c.dilimCevir({ id: 'b', oncelik: 1, resim });
    assert.equal(t.cagri.length, 2);
  });

  it('ikinci yanıt da eksikse kaydedilir ve bir daha sorulmaz; az işaretli dilimde yeniden sorulmaz', async () => {
    const t = kur([[kayit(1)]]);
    const resim = { ...RESIM, bolgeler: bolgeler(7) };
    await t.c.dilimCevir({ id: 'a', oncelik: 1, resim });
    await t.c.dilimCevir({ id: 'b', oncelik: 1, resim });
    assert.equal(t.cagri.length, 2);
    const az = kur([[kayit(1)]]);
    await az.c.dilimCevir({ id: 'a', oncelik: 1, resim: { ...RESIM, bolgeler: bolgeler(2) } });
    assert.equal(az.cagri.length, 1);
  });

  it('kurala önceki sürümden kalan eksik önbellek kaydı bir kez daha sorulur', async () => {
    const t = kur([[1, 2, 3, 4, 5].map(kayit)]);
    const resim = { ...RESIM, bolgeler: bolgeler(5) };
    const ozet = await ozetCikar(RESIM.veri);
    await t.c.onbellek.koy(kayitAnahtari(ozet, 'gorsel:gemini:gemini-3.8-flash', 'tr'), [kayit(1)]);
    const s = await t.c.dilimCevir({ id: 'a', oncelik: 1, resim });
    assert.equal(t.cagri.length, 1);
    assert.equal(s.balonlar.length, 5);
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
