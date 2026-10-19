import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sahteAlan } from './yardimci.js';
import { AyarDeposu, Motor, ayarlariTamamla, motorKimligi, seciliModel } from '../src/ayarlar.js';

describe('Ayarlar', () => {
  it('varsayılanlar: görsel YZ, Gemini, Türkçe, boş site listesi', () => {
    const a = ayarlariTamamla(undefined);
    assert.equal(a.motor, Motor.GORSEL);
    assert.equal(a.saglayici, 'gemini');
    assert.equal(a.hedefDil, 'tr');
    assert.deepEqual(a.siteler, []);
  });

  it('bozuk/eksik kayıtları düzeltir', () => {
    const a = ayarlariTamamla({ motor: 'baska', siteler: 'x', hedefDil: 'de' });
    assert.equal(a.motor, Motor.GORSEL);
    assert.deepEqual(a.siteler, []);
    assert.equal(a.hedefDil, 'de');
  });

  it('motor kimliği seçili modele göre; yerel motorda model önemsiz', () => {
    const a = ayarlariTamamla({ saglayici: 'anthropic', modeller: { anthropic: 'claude-haiku-5-5' } });
    assert.equal(seciliModel(a).id, 'claude-haiku-5-5');
    assert.equal(motorKimligi(a), 'gorsel:anthropic:claude-haiku-5-5');
    assert.equal(motorKimligi(ayarlariTamamla({})), 'gorsel:gemini:gemini-3.8-flash');
    assert.equal(motorKimligi({ ...a, motor: Motor.YEREL }), 'yerel');
  });

  it('AyarDeposu aynı anda gelen güncellemeleri sırayla uygular', async () => {
    const alan = sahteAlan();
    const d = new AyarDeposu(alan);
    await Promise.all([
      d.guncelle((a) => ({ ...a, siteler: [...a.siteler, 'mangadex.org'] })),
      d.guncelle((a) => ({ ...a, siteler: [...a.siteler, 'ornek.com'] })),
    ]);
    assert.deepEqual((await d.oku()).siteler, ['mangadex.org', 'ornek.com']);
    assert.deepEqual(alan.veri.ayarlar.siteler, ['mangadex.org', 'ornek.com']);
  });
});
