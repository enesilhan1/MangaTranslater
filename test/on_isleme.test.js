import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AZAMI_PIKSEL, buyutmeOlcegi } from '../src/yerel/on_isleme.js';

describe('buyutmeOlcegi', () => {
  it('tipik manga sayfasını 2 kat, orta genişliği 1,5 kat büyütür, genişe dokunmaz', () => {
    assert.equal(buyutmeOlcegi(800, 1100), 2);
    assert.equal(buyutmeOlcegi(1400, 600), 1.5);
    assert.equal(buyutmeOlcegi(2000, 1000), 1);
  });

  it('piksel sınırını aşmaz ve hiç küçültmez', () => {
    assert.equal(buyutmeOlcegi(975, 1400), 2); // MangaDex sayfası
    const o = buyutmeOlcegi(1000, 3000); // 2x → 12 MP olurdu
    assert.ok(o > 1 && o < 2);
    assert.ok(1000 * o * 3000 * o <= AZAMI_PIKSEL + 1);
    assert.equal(buyutmeOlcegi(1000, 9000), 1);
  });
});
