import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mesajIsle, resimGetir } from '../src/mesajlar.js';
import { YzHatasi } from '../src/yz/ortak.js';

function ortamKur({ dilimCevir } = {}) {
  const kayit = { cevir: [], oncelik: [], iptal: [] };
  const ortam = {
    cevirici: { dilimCevir: dilimCevir ?? (async (p) => (kayit.cevir.push(p), { balonlar: [], onbellekten: false })) },
    kuyruk: {
      onEkOncelik: (o, n) => kayit.oncelik.push([o, n]),
      onEkIptal: (o) => kayit.iptal.push(o),
    },
  };
  return { ortam, kayit };
}
const SEKME = { tab: { id: 7 } };

describe('mesajIsle', () => {
  it('cevir: kuyruk kimliği sekme:resim#dilim, sonuç {sonuc} içinde', async () => {
    const { ortam, kayit } = ortamKur();
    const y = await mesajIsle({ tip: 'cevir', resimKimligi: 'r3', dilim: 1, oncelik: 2, resim: { veri: 'x' } }, SEKME, ortam);
    assert.deepEqual(y, { sonuc: { balonlar: [], onbellekten: false } });
    assert.deepEqual(kayit.cevir[0], { id: '7:r3#1', oncelik: 2, resim: { veri: 'x' } });
  });

  it('hata {hata: {anahtar, parametreler}} olarak paketlenir', async () => {
    const { ortam } = ortamKur({ dilimCevir: async () => { throw new YzHatasi('hata.anahtarYok', { ad: 'Gemini' }); } });
    assert.deepEqual(await mesajIsle({ tip: 'cevir', resimKimligi: 'r', dilim: 0 }, SEKME, ortam), {
      hata: { anahtar: 'hata.anahtarYok', parametreler: { ad: 'Gemini' } },
    });
    const { ortam: o2 } = ortamKur({ dilimCevir: async () => { throw new Error('patladı'); } });
    assert.deepEqual((await mesajIsle({ tip: 'cevir' }, SEKME, o2)).hata, {
      anahtar: 'hata.beklenmeyen',
      parametreler: { mesaj: 'patladı' },
    });
  });

  it('oncelik ve iptal resmin bütün dilimlerine, iptal kimliksizse sekmeye uygulanır', async () => {
    const { ortam, kayit } = ortamKur();
    await mesajIsle({ tip: 'oncelik', resimKimligi: 'r1', oncelik: 3 }, SEKME, ortam);
    await mesajIsle({ tip: 'iptal', resimKimligi: 'r1' }, SEKME, ortam);
    await mesajIsle({ tip: 'iptal' }, SEKME, ortam);
    assert.deepEqual(kayit.oncelik, [['7:r1#', 3]]);
    assert.deepEqual(kayit.iptal, ['7:r1#', '7:']);
  });

  it('sekmesiz gönderen (açılır pencere, offscreen) ve bilinmeyen tip bizim değil', () => {
    const { ortam } = ortamKur();
    assert.equal(mesajIsle({ tip: 'cevir' }, {}, ortam), null);
    assert.equal(mesajIsle({ tip: 'baska' }, SEKME, ortam), null);
    assert.equal(mesajIsle({ hedef: 'offscreen-yerel' }, SEKME, ortam), null);
  });
});

const yanit = (durum, tur, baytlar = [1, 2, 3]) => ({
  ok: durum === 200,
  status: durum,
  headers: new Headers(tur ? { 'content-type': tur } : {}),
  arrayBuffer: async () => new Uint8Array(baytlar).buffer,
});

describe('resimGetir', () => {
  it('resmi çerezleriyle indirip base64 ve türüyle döndürür', async () => {
    let secenek;
    const s = await resimGetir('https://cdn.ornek/1.jpg', async (_, o) => ((secenek = o), yanit(200, 'image/jpeg; q=1', [65, 66, 67])));
    assert.deepEqual(s, { veri: 'QUJD', tur: 'image/jpeg' });
    assert.equal(secenek.credentials, 'include');
  });

  it('http(s) dışı adres, HTTP hatası, resim olmayan içerik reddedilir', async () => {
    const f = async () => yanit(200, 'image/png');
    await assert.rejects(resimGetir('file:///C:/gizli.png', f), { anahtar: 'hata.resimAlinamadi' });
    await assert.rejects(resimGetir('bozuk', f), { anahtar: 'hata.resimAlinamadi' });
    await assert.rejects(resimGetir('https://a/b', async () => yanit(403, 'text/html')), {
      parametreler: { mesaj: 'HTTP 403' },
    });
    await assert.rejects(resimGetir('https://a/b', async () => yanit(200, 'text/html')), {
      parametreler: { mesaj: 'text/html' },
    });
  });
});
