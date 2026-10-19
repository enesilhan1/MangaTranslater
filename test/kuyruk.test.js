import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Kuyruk, Oncelik } from '../src/kuyruk.js';

/** Elle bitirilen iş: başladığında [baslayan]'a adını yazar. */
function elleIs(ad, baslayan) {
  let bitir;
  const is = (sinyal) => {
    baslayan.push(ad);
    is.sinyal = sinyal;
    return new Promise((coz) => (bitir = coz));
  };
  is.bitir = (deger = ad) => bitir(deger);
  return is;
}
const bekle = () => new Promise((r) => setImmediate(r));

describe('Kuyruk', () => {
  it('aynı anda en çok esZaman iş; yüksek öncelik önce, eşitse ilk gelen', async () => {
    const baslayan = [];
    const k = new Kuyruk({ esZaman: 1 });
    const isler = Object.fromEntries(['a', 'b', 'c', 'd'].map((ad) => [ad, elleIs(ad, baslayan)]));
    const pa = k.ekle('a', Oncelik.GIZLI, isler.a);
    k.ekle('b', Oncelik.GIZLI, isler.b);
    k.ekle('c', Oncelik.YAKIN, isler.c);
    k.ekle('d', Oncelik.GORUNUR, isler.d);
    await bekle();
    assert.deepEqual(baslayan, ['a']); // a hemen başladı, diğerleri bekliyor
    isler.a.bitir();
    assert.equal(await pa, 'a');
    await bekle();
    isler.d.bitir();
    await bekle();
    isler.c.bitir();
    await bekle();
    assert.deepEqual(baslayan, ['a', 'd', 'c', 'b']);
  });

  it('bekleyenin önceliği sonradan yükseltilebilir', async () => {
    const baslayan = [];
    const k = new Kuyruk({ esZaman: 1 });
    const a = elleIs('a', baslayan);
    k.ekle('a', Oncelik.GORUNUR, a);
    k.ekle('b', Oncelik.YAKIN, elleIs('b', baslayan));
    k.ekle('c', Oncelik.GIZLI, elleIs('c', baslayan));
    k.onEkOncelik('c', Oncelik.GORUNUR); // okuyucu c'ye kaydırdı (tüm dilimleri)
    await bekle();
    a.bitir();
    await bekle();
    assert.deepEqual(baslayan, ['a', 'c']);
  });

  it('oncelikDegistir tek işin önceliğini değiştirir', async () => {
    const baslayan = [];
    const k = new Kuyruk({ esZaman: 1 });
    const a = elleIs('a', baslayan);
    k.ekle('a', Oncelik.GORUNUR, a);
    k.ekle('b', Oncelik.YAKIN, elleIs('b', baslayan));
    k.ekle('c', Oncelik.GIZLI, elleIs('c', baslayan));
    k.oncelikDegistir('c', Oncelik.GORUNUR);
    await bekle();
    a.bitir();
    await bekle();
    assert.deepEqual(baslayan, ['a', 'c']);
  });

  it('iptal: bekleyen durduruldu hatasıyla düşer, çalışanın sinyali tetiklenir', async () => {
    const baslayan = [];
    const k = new Kuyruk({ esZaman: 1 });
    const a = elleIs('a', baslayan);
    k.ekle('a', 1, a);
    const pb = k.ekle('b', 1, elleIs('b', baslayan));
    await bekle();
    k.iptal('b');
    await assert.rejects(pb, { anahtar: 'hata.durduruldu' });
    k.iptal('a');
    assert.equal(a.sinyal.aborted, true);
  });

  it('onEkIptal bir sekmenin bütün işlerini durdurur; aynı kimlik yenisiyle değişir', async () => {
    const baslayan = [];
    const k = new Kuyruk({ esZaman: 1 });
    const calisan = elleIs('7:x', baslayan);
    k.ekle('7:x', 1, calisan);
    const p7 = k.ekle('7:y', 1, elleIs('7:y', baslayan));
    const p8 = k.ekle('8:y', 1, elleIs('8:y', baslayan));
    await bekle();
    k.onEkIptal('7:');
    await assert.rejects(p7);
    assert.equal(calisan.sinyal.aborted, true);

    k.ekle('8:y', 1, elleIs('eski', baslayan));
    await assert.rejects(p8, { anahtar: 'hata.durduruldu' }); // aynı kimlik: eskisi düştü
    calisan.bitir();
    await bekle();
    assert.equal(baslayan.at(-1), 'eski');
    assert.equal(k.bosMu, false);
  });

  it('esZaman artırılınca bekleyenler hemen başlar; hatalı iş kuyruğu tıkamaz', async () => {
    const baslayan = [];
    const k = new Kuyruk({ esZaman: 1 });
    const pHata = k.ekle('h', 3, async () => {
      baslayan.push('h');
      throw new Error('bozuk');
    });
    k.ekle('a', 1, elleIs('a', baslayan));
    k.ekle('b', 1, elleIs('b', baslayan));
    await assert.rejects(pHata, /bozuk/);
    await bekle();
    assert.deepEqual(baslayan, ['h', 'a']);
    k.esZaman = 3;
    await bekle();
    assert.deepEqual(baslayan, ['h', 'a', 'b']);
  });
});
