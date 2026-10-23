import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { IZ_KENARI, parmakIzi } from '../src/icerik/canvas.js';

/** IZ_KENARI x IZ_KENARI RGBA; f(x, y) → [r, g, b, a]. */
const resim = (f) => {
  const d = new Uint8ClampedArray(IZ_KENARI * IZ_KENARI * 4);
  for (let y = 0; y < IZ_KENARI; y++) for (let x = 0; x < IZ_KENARI; x++) d.set(f(x, y), (y * IZ_KENARI + x) * 4);
  return d;
};

describe('parmakIzi', () => {
  it('boş (saydam ya da tek renk) canvas için null', () => {
    assert.equal(parmakIzi(resim(() => [0, 0, 0, 0])), null);
    assert.equal(parmakIzi(resim(() => [255, 255, 255, 255])), null);
    assert.equal(parmakIzi(resim(() => [30, 30, 30, 255])), null);
  });

  it('aynı sayfa küçük farkla aynı izi, başka sayfa başka izi verir', () => {
    const sayfa1 = resim((x, y) => ((x >> 2) + (y >> 2)) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]);
    const sayfa1Gurultulu = resim((x, y) => ((x >> 2) + (y >> 2)) % 2 ? [252, 253, 251, 255] : [2, 1, 3, 255]);
    const sayfa2 = resim((x, y) => (x > y ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    const iz = parmakIzi(sayfa1);
    assert.match(iz, /^[0-9a-f]{8}$/);
    assert.equal(parmakIzi(sayfa1Gurultulu), iz);
    assert.notEqual(parmakIzi(sayfa2), iz);
  });
});
