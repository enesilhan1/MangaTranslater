import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
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
    // Site erişimi kurulumda istenmez; açılır pencere gerektiğinde ister.
    assert.equal(m.host_permissions, undefined);
    assert.deepEqual(m.optional_host_permissions, SITE_IZNI.origins);
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

  it('simgeler ve açılır pencere dosyaları var', () => {
    const m = oku('manifest.json');
    const dosyalar = [...Object.values(m.icons), ...Object.values(m.action.default_icon), m.action.default_popup];
    assert.equal(Object.keys(m.icons).length, 4);
    for (const d of dosyalar) assert.ok(existsSync(new URL(`../${d}`, import.meta.url)), d);
  });

  it('siteIzniVarMi izin API sonucunu döndürür, API yoksa engel saymaz', async () => {
    const api = (sonuc) => ({ permissions: { contains: async () => sonuc } });
    assert.equal(await siteIzniVarMi(api(false)), false);
    assert.equal(await siteIzniVarMi(api(true)), true);
    assert.equal(await siteIzniVarMi({}), true);
  });
});

describe('yerel OCR için manifest', () => {
  it('eklenti sayfalarında WASM çalışabilir, uzaktan betik yok', () => {
    const csp = oku('manifest.json').content_security_policy.extension_pages;
    assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/);
    assert.doesNotMatch(csp, /https?:|unsafe-inline|'unsafe-eval'/);
  });

  it('Tesseract dosyaları pakette', () => {
    for (const yol of [
      'vendor/tesseract/tesseract.esm.min.js',
      'vendor/tesseract/worker.min.js',
      'vendor/tesseract/cekirdek/tesseract-core-lstm.wasm.js',
      'vendor/tesseract/cekirdek/tesseract-core-simd-lstm.wasm.js',
      'vendor/tesseract/cekirdek/tesseract-core-relaxedsimd-lstm.wasm.js',
      'vendor/tesseract/dil/eng.traineddata.gz',
    ]) {
      assert.ok(existsSync(new URL(`../${yol}`, import.meta.url)), yol);
    }
  });
});

describe('içerik betiği modülleri', () => {
  /** ana.js'ten içe aktarmalarla erişilen bütün dosyalar (depo köküne göre). */
  const erisilenler = (dosya, kume = new Set()) => {
    if (kume.has(dosya)) return kume;
    kume.add(dosya);
    const icerik = readFileSync(new URL(`../${dosya}`, import.meta.url), 'utf8');
    for (const m of icerik.matchAll(/^(?:import|export)[^'"]*from ['"](\.[^'"]+)['"]|^import ['"](\.[^'"]+)['"]/gm)) {
      erisilenler(posix.join(posix.dirname(dosya), m[1] ?? m[2]), kume);
    }
    return kume;
  };

  it('ana.js\'in içe aktardığı her dosya sayfalardan yüklenebilir (web_accessible_resources)', () => {
    const war = oku('manifest.json').web_accessible_resources.flatMap((w) => w.resources);
    const d = erisilenler('src/icerik/ana.js');
    assert.ok(d.size >= 8);
    for (const x of d) assert.ok(war.includes(x), x);
  });

  it('içerik tarafı Tesseract\'ı ya da sağlayıcı kodunu yüklemez', () => {
    const d = [...erisilenler('src/icerik/ana.js')];
    assert.ok(!d.some((x) => x.startsWith('vendor/') || x.startsWith('src/yerel/') || x.includes('/yz/istemciler')), d.join());
  });
});

describe('paket', () => {
  it('manifestin ve sayfaların gösterdiği her dosya paket klasörlerinde', () => {
    const paket = ['manifest.json', '_locales', 'icons', 'popup', 'offscreen', 'src', 'vendor', 'LICENSE'];
    const m = oku('manifest.json');
    const yollar = [
      m.background.service_worker,
      ...Object.values(m.icons),
      m.action.default_popup,
      ...m.web_accessible_resources.flatMap((w) => w.resources),
      'offscreen/yerel.html',
      'src/icerik/yukleyici.js',
    ];
    for (const y of yollar) assert.ok(paket.some((p) => y === p || y.startsWith(`${p}/`)), y);
    const betik = readFileSync(new URL('../scripts/paketle.mjs', import.meta.url), 'utf8');
    for (const p of paket) assert.ok(betik.includes(`'${p}'`), p);
  });
});
