import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { SITE_IZNI, siteIzniVarMi } from '../src/tarayici.js';

const oku = (yol) => JSON.parse(readFileSync(new URL(`../${yol}`, import.meta.url), 'utf8'));

describe('manifest ve Chrome + Firefox uyumu', () => {
  it('iki tarayıcının arka plan biçimini de aynı dosyaya bağlar', () => {
    const m = oku('manifest.json');
    assert.equal(m.manifest_version, 3);
    assert.equal(m.background.service_worker, 'src/arka_plan.js'); // Chrome
    assert.deepEqual(m.background.scripts, ['src/arka_plan.js']); // Firefox
    assert.equal(m.background.type, 'module');
    const g = m.browser_specific_settings.gecko;
    assert.match(g.id, /^[\w.-]+@[\w.-]+$/);
    assert.equal(g.strict_min_version, '140.0');
    // Resimler çeviri motoruna gönderildiği için yalnızca site içeriği.
    assert.deepEqual(g.data_collection_permissions.required, ['websiteContent']);
    assert.deepEqual(m.host_permissions, SITE_IZNI.origins);
  });

  it('manifestteki her __MSG_x__ iki dil dosyasında da var', () => {
    const m = JSON.stringify(oku('manifest.json'));
    const anahtarlar = [...m.matchAll(/__MSG_(\w+)__/g)].map((x) => x[1]);
    assert.ok(anahtarlar.length >= 3);
    for (const dil of ['tr', 'en']) {
      const mesajlar = oku(`_locales/${dil}/messages.json`);
      for (const a of anahtarlar) assert.ok(mesajlar[a]?.message, `${dil}: ${a}`);
    }
  });

  it('siteIzniVarMi izin API sonucunu döndürür, API yoksa engel saymaz', async () => {
    const api = (sonuc) => ({ permissions: { contains: async () => sonuc } });
    assert.equal(await siteIzniVarMi(api(false)), false);
    assert.equal(await siteIzniVarMi(api(true)), true);
    assert.equal(await siteIzniVarMi({}), true);
  });
});
