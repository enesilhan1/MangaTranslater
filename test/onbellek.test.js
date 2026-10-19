import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Onbellek, kayitAnahtari, ozetCikar } from '../src/onbellek.js';

/** idbArkaUcu ile aynı arayüzde bellek içi arka uç. */
function bellekArkaUcu() {
  const m = new Map();
  return {
    m,
    al: async (a) => m.get(a),
    koy: async (k) => void m.set(k.anahtar, structuredClone(k)),
    say: async () => m.size,
    enEskileriSil: async (adet) => {
      [...m.values()].sort((a, b) => a.zaman - b.zaman).slice(0, adet).forEach((k) => m.delete(k.anahtar));
    },
    temizle: async () => m.clear(),
  };
}

describe('Önbellek', () => {
  it('özet içerik belirleyici; anahtar özet + motor + hedef dil', async () => {
    const a = await ozetCikar('QUJD');
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.equal(a, await ozetCikar('QUJD'));
    assert.notEqual(a, await ozetCikar('QUJE'));
    assert.equal(kayitAnahtari('x', 'yerel', 'tr'), 'x|yerel|tr');
  });

  it('koyulanı geri verir, olmayanda null', async () => {
    const o = new Onbellek(bellekArkaUcu());
    await o.koy('k', [{ ceviri: 'Selam' }]);
    assert.deepEqual(await o.al('k'), [{ ceviri: 'Selam' }]);
    assert.equal(await o.al('yok'), null);
    await o.temizle();
    assert.equal(await o.al('k'), null);
  });

  it('sınır aşılınca en uzun süredir kullanılmayanları %10 payla siler', async () => {
    let saat = 0;
    const arka = bellekArkaUcu();
    const o = new Onbellek(arka, { azami: 10, simdi: () => ++saat });
    for (let i = 0; i < 10; i++) await o.koy(`k${i}`, []);
    await o.al('k0'); // k0 yeni kullanıldı, silinmemeli
    await new Promise((r) => setImmediate(r));
    await o.koy('k10', []);
    // 11 kayıt > 10 → 11 - 9 = 2 en eski silinir: k1, k2.
    assert.equal(arka.m.size, 9);
    assert.ok(arka.m.has('k0'));
    assert.ok(!arka.m.has('k1') && !arka.m.has('k2'));
    assert.ok(arka.m.has('k10'));
  });
});
