import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cizilmeli } from '../src/icerik/gorunum.js';

describe('cizilmeli', () => {
  it('yalnızca noktalama olan ve orijinaliyle aynı çeviri çizilmez; harfli ya da değişen çeviri çizilir', () => {
    assert.equal(cizilmeli({ orijinal: '...', ceviri: '...' }), false);
    assert.equal(cizilmeli({ orijinal: '?!', ceviri: ' ?! ' }), false);
    assert.equal(cizilmeli({ orijinal: 'DA.', ceviri: 'Evet.' }), true);
    assert.equal(cizilmeli({ orijinal: 'HM!', ceviri: 'HM!' }), true); // harfli: ses/ünlem yine çizilir
    assert.equal(cizilmeli({ orijinal: '...', ceviri: '…' }), true); // model başka biçimde yazdıysa
    assert.equal(cizilmeli({ orijinal: '2', ceviri: '2' }), true);
  });
});
