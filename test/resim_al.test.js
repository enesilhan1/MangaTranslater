import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { griBoyutu } from '../src/icerik/resim_al.js';

describe('gri kopya boyutu', () => {
  it('dikey sayfada ~500 px, iki sayfalık geniş resimde daha geniş; büyütülmez', () => {
    assert.equal(griBoyutu(1000, 1420), 500);
    assert.ok(griBoyutu(2000, 1400) > 700);
    assert.equal(griBoyutu(300, 200), 300);
  });
});

describe('resimBaytlari', () => {
  it('iptal edilmiş blob: adresli resim öğeden tuvale çizilerek okunur', async (t) => {
    // MANGA Plus: resim çözülüp blob: ile gösteriliyor, sonra adres iptal ediliyor.
    const { resimBaytlari } = await import('../src/icerik/resim_al.js');
    const eski = { fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap, OffscreenCanvas: globalThis.OffscreenCanvas, location: globalThis.location };
    t.after(() => Object.assign(globalThis, eski));
    const cizilen = [];
    Object.assign(globalThis, {
      location: { href: 'https://mangaplus.shueisha.co.jp/viewer/1' },
      fetch: async () => { throw new TypeError('Failed to fetch'); },
      createImageBitmap: async (img) => ({ width: img.naturalWidth, height: img.naturalHeight, close() {} }),
      OffscreenCanvas: class {
        constructor(w, h) { this.w = w; this.h = h; }
        getContext() { return { drawImage: (b) => cizilen.push(b) }; }
        async convertToBlob({ type }) { return new Blob([new Uint8Array(this.w * this.h)], { type }); }
      },
    });
    const img = { src: 'blob:https://mangaplus.shueisha.co.jp/abc', currentSrc: '', naturalWidth: 4, naturalHeight: 3 };
    const b = await resimBaytlari(img);
    assert.equal(b.type, 'image/png');
    assert.equal(b.size, 12);
    assert.equal(cizilen.length, 1);
    // Tuval de okunamıyorsa (başka kökenli) asıl hata iletilir.
    globalThis.createImageBitmap = async () => { throw new Error('tainted'); };
    await assert.rejects(resimBaytlari(img), /Failed to fetch/);
  });
});
