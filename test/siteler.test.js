import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BETIK_KIMLIGI,
  YUKLEYICI,
  alanAdi,
  betikKaydiniEsitle,
  desenler,
  siteCikar,
  siteEkle,
  siteKapsar,
} from '../src/siteler.js';

describe('Site listesi', () => {
  it('alan adı: www. atılır, küçük harf; http(s) dışı null', () => {
    assert.equal(alanAdi('https://WWW.MangaDex.org/chapter/1'), 'mangadex.org');
    assert.equal(alanAdi('http://ornek.com:8080/x'), 'ornek.com');
    for (const a of ['chrome://extensions', 'about:blank', 'file:///C:/a.html', 'moz-extension://x/p.html', 'bozuk']) {
      assert.equal(alanAdi(a), null, a);
    }
  });

  it('alan adı alt alan adlarını kapsar, benzer adları kapsamaz', () => {
    const s = ['mangadex.org'];
    assert.equal(siteKapsar(s, 'mangadex.org'), true);
    assert.equal(siteKapsar(s, 'cdn.mangadex.org'), true);
    assert.equal(siteKapsar(s, 'notmangadex.org'), false);
    assert.equal(siteKapsar(s, null), false);
  });

  it('ekle: sıralı, yinelenmesiz, kapsanan eklenmez', () => {
    assert.deepEqual(siteEkle(['b.com'], 'a.com'), ['a.com', 'b.com']);
    assert.deepEqual(siteEkle(['a.com'], 'a.com'), ['a.com']);
    assert.deepEqual(siteEkle(['a.com'], 'cdn.a.com'), ['a.com']);
  });

  it('çıkar: alt alan adında kapatınca kapsayan kayıt da çıkar', () => {
    assert.deepEqual(siteCikar(['a.com', 'b.com'], 'reader.a.com'), ['b.com']);
    assert.deepEqual(siteCikar(['a.com'], 'b.com'), ['a.com']);
  });

  it('desenler alan adı ve alt alan adları için', () => {
    assert.deepEqual(desenler(['a.com']), ['*://a.com/*', '*://*.a.com/*']);
  });
});

describe('betikKaydiniEsitle', () => {
  function sahteScripting(kayitli = []) {
    const s = {
      kayitlar: [...kayitli],
      cagrilar: [],
      getRegisteredContentScripts: async ({ ids }) => s.kayitlar.filter((k) => ids.includes(k.id)),
      unregisterContentScripts: async ({ ids }) => {
        s.cagrilar.push('sil');
        s.kayitlar = s.kayitlar.filter((k) => !ids.includes(k.id));
      },
      registerContentScripts: async (l) => {
        s.cagrilar.push('kaydet');
        s.kayitlar.push(...l);
      },
    };
    return s;
  }

  it('eski kaydı silip listedeki sitelere yeniden kaydeder', async () => {
    const s = sahteScripting([{ id: BETIK_KIMLIGI, matches: ['*://eski.com/*'] }]);
    await betikKaydiniEsitle(s, ['mangadex.org']);
    assert.deepEqual(s.cagrilar, ['sil', 'kaydet']);
    assert.equal(s.kayitlar.length, 1);
    assert.deepEqual(s.kayitlar[0].matches, ['*://mangadex.org/*', '*://*.mangadex.org/*']);
    assert.deepEqual(s.kayitlar[0].js, [YUKLEYICI]);
  });

  it('liste boşsa kayıt kalmaz; kayıt yoksa silmeye çalışmaz', async () => {
    const s = sahteScripting([{ id: BETIK_KIMLIGI }]);
    await betikKaydiniEsitle(s, []);
    assert.equal(s.kayitlar.length, 0);
    const bos = sahteScripting();
    await betikKaydiniEsitle(bos, []);
    assert.deepEqual(bos.cagrilar, []);
  });
});
