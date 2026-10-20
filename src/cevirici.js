// Arka plandaki çeviri akışı: bir resim dilimi için önce önbelleğe bakar,
// yoksa ayarlardaki motoru (görsel YZ ya da yerel) öncelikli kuyruk
// üzerinden çalıştırır ve sonucu önbelleğe yazar.

import { Motor, motorKimligi, seciliModel } from './ayarlar.js';
import { OCR_SURUMU, ocrGerekirMi, ocrIleOturt } from './ocr_oturtma.js';
import { kayitAnahtari, ozetCikar } from './onbellek.js';
import { yerelCevirmenKopru } from './yerel/kopru.js';
import { istemciOlustur } from './yz/istemciler.js';
import { saglayiciBul } from './yz/katalog.js';
import { YzHatasi } from './yz/ortak.js';

/** Aynı anda en çok kaç istek: görsel YZ'de birkaç, yerel OCR'de tek işçi. */
export const ES_ZAMAN = Object.freeze({ [Motor.GORSEL]: 3, [Motor.YEREL]: 1 });

export class Cevirici {
  /**
   * @param {{
   *   ayarDeposu: import('./ayarlar.js').AyarDeposu,
   *   onbellek: import('./onbellek.js').Onbellek,
   *   kuyruk: import('./kuyruk.js').Kuyruk,
   *   gorselOlustur?: typeof istemciOlustur,
   *   yerelOlustur?: typeof yerelCevirmenKopru,
   * }} p  Son ikisi testlerde sahtesiyle değiştirilir.
   */
  constructor({ ayarDeposu, onbellek, kuyruk, gorselOlustur = istemciOlustur, yerelOlustur = yerelCevirmenKopru }) {
    this.ayarDeposu = ayarDeposu;
    this.onbellek = onbellek;
    this.kuyruk = kuyruk;
    this.gorselOlustur = gorselOlustur;
    this.yerelOlustur = yerelOlustur;
    /** Yerel köprü offscreen belgedeki motoru tutar; e-posta değişmedikçe aynısı. */
    this._yerel = null;
  }

  /**
   * Görsel YZ'nin balonsuz metinleri (çizim üstü başlık/anlatım) OCR ile
   * harflerin yerine oturtulur. OCR yalnızca henüz denenmemiş böyle bir
   * metin varsa çalışır; denenenler ocrDenendi (OCR_SURUMU) işaretlenir ki
   * önbellekten her gelişte tekrar çalışmasın; eşleme kuralları gelişince
   * sürüm artar ve eski kayıtlar bir kez daha denenir. OCR hata verirse
   * işaret konmaz (sonra yeniden denenir) ve modelin kutusu kalır; çeviri
   * kaybolmaz.
   * @returns {Promise<{balonlar: object[], degisti: boolean}>}
   */
  async ocrIleDuzelt(a, balonlar, resim) {
    const gerekli = (b) => ocrGerekirMi(b) && !b.ocrOturdu && Number(b.ocrDenendi ?? 0) < OCR_SURUMU;
    if (a.motor !== Motor.GORSEL || !balonlar.some(gerekli)) return { balonlar, degisti: false };
    let ocr;
    try {
      ocr = await this.ocrKopru().kelimeleriOku(resim);
    } catch {
      return { balonlar, degisti: false };
    }
    const adaylar = balonlar.filter(gerekli);
    // İşaretli alanlar (numaralı balonlar) sayfa genelindeki aramaya girmez.
    const isaretli = (resim.bolgeler ?? []).map(({ kutu: [y0, x0, y1, x1] }) => ({ x0: x0 / 1000, y0: y0 / 1000, x1: x1 / 1000, y1: y1 / 1000 }));
    const sonuc = ocrIleOturt(adaylar, ocr, { isaretli });
    const yeni = new Map(adaylar.map((b, i) => [b, { ...sonuc[i], ocrDenendi: OCR_SURUMU }]));
    return { balonlar: balonlar.map((b) => yeni.get(b) ?? b), degisti: true };
  }

  /** Yalnızca OCR için köprü (görsel YZ'de balonsuz metinler); ilk gerektiğinde kurulur. */
  ocrKopru() {
    this._ocr ??= this.yerelOlustur({ eposta: '' });
    return this._ocr;
  }

  /** Ayarlara göre cevir({resim, hedefDil, sinyal}) sunan motor. */
  motor(a) {
    if (a.motor === Motor.YEREL) {
      if (this._yerel?.eposta !== a.eposta) {
        this._yerel = { eposta: a.eposta, kopru: this.yerelOlustur({ eposta: a.eposta }) };
      }
      return this._yerel.kopru;
    }
    const model = seciliModel(a);
    const apiAnahtari = (a.anahtarlar[model.saglayici] ?? '').trim();
    if (!apiAnahtari) throw new YzHatasi('hata.anahtarYok', { ad: saglayiciBul(model.saglayici).kisaAd });
    return this.gorselOlustur({ model, apiAnahtari });
  }

  /**
   * @param {{id: string, oncelik: number, resim: import('./yz/gorsel.js').Resim}} p
   *   [id] kuyruk kimliği ("<sekme>:<resim>#<dilim>").
   * @returns {Promise<{balonlar: object[], onbellekten: boolean}>}
   */
  async dilimCevir({ id, oncelik, resim }) {
    const a = await this.ayarDeposu.oku();
    const anahtar = kayitAnahtari(await ozetCikar(resim.veri), motorKimligi(a), a.hedefDil);
    const kayitli = await this.onbellek.al(anahtar);
    // Eski sürümlerin yazdığı boş kayıt da yok sayılır (bkz. aşağıdaki kural).
    if (kayitli?.length) {
      // OCR düzeltmesinden önceki sürümlerin kaydı: bir kez düzeltilip
      // önbellek güncellenir (yoksa o sayfa eski kutularla kalıyordu).
      const { balonlar, degisti } = await this.ocrIleDuzelt(a, kayitli, resim);
      if (degisti) await this.onbellek.koy(anahtar, balonlar).catch(() => {});
      return { balonlar, onbellekten: true };
    }

    const motor = this.motor(a);
    this.kuyruk.esZaman = ES_ZAMAN[a.motor];
    const ham = await this.kuyruk.ekle(id, oncelik, (sinyal) =>
      motor.cevir({ resim, hedefDil: a.hedefDil, sinyal }),
    );
    const { balonlar } = await this.ocrIleDuzelt(a, ham.balonlar, resim);
    // Önbelleğe yazılamasa da çeviri gösterilsin. Boş sonuç yazılmaz: model
    // bir kez yanılıp "yazı yok" derse sayfa sonsuza kadar boş kalmasın.
    if (balonlar.length) await this.onbellek.koy(anahtar, balonlar).catch(() => {});
    return { balonlar, onbellekten: false };
  }
}
