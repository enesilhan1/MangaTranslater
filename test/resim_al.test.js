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
