// Arka plandaki çeviri akışı: bir resim dilimi için önce önbelleğe bakar,
// yoksa ayarlardaki motoru (görsel YZ ya da yerel) öncelikli kuyruk
// üzerinden çalıştırır ve sonucu önbelleğe yazar.

import { Motor, motorKimligi, seciliModel } from './ayarlar.js';
import { metinSigmaz } from './kutu_oturtma.js';
import { OCR_SURUMU, atlananaUyar, atlananYazilar, latinSesMi, ocrGerekirMi, ocrIleOturt } from './ocr_oturtma.js';
import { kayitAnahtari, ozetCikar } from './onbellek.js';
import { yerelCevirmenKopru } from './yerel/kopru.js';
import { istemciOlustur } from './yz/istemciler.js';
import { saglayiciBul } from './yz/katalog.js';
import { YzHatasi } from './yz/ortak.js';

/**
 * İşaretli balonların bu oranından azına metin döndüyse model sayfanın
 * çoğunu atlamış sayılır ve bir kez daha sorulur (kullanıcının sayfasında 7
 * işaretli balondan yalnızca 1'inin metni gelmişti).
 */
const EN_AZ_KAPSAMA = 0.5;
/** Bu kadar işaretten az olan dilimde yeniden sorulmaz (az sayıda balonda oran yanıltıcı). */
const KAPSAMA_ICIN_EN_AZ_ISARET = 3;

/** Sonuçta metin verilmiş farklı işaret numarası sayısı. */
function kapsananIsaret(balonlar) {
  return new Set(balonlar.map((b) => b.bolge).filter((n) => n > 0)).size;
}

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
   * @returns {Promise<{balonlar: object[], degisti: boolean, ocr?: object, isaretli?: object[]}>}
   *   [ocr] OCR çalıştıysa sonucu (atlanan yazıları bulmak için).
   */
  async ocrIleDuzelt(a, balonlar, resim) {
    // Numarası şüpheli metin: işaretli alan ona sığmayacak kadar küçük
    // (kullanıcının sayfasında kedinin gözü 4 parça, metin 24 harf). Model
    // numarayı da kutuyu da yanlış verdiyse içerik betiği metni yalnızca
    // modelin kutusuna koyabiliyordu; OCR asıl yazıyı bulur.
    const bolgeler = resim.bolgeler ?? [];
    const supheli = (b) => b.bolge > 0 && b.tur !== 'ses' && metinSigmaz(b.orijinal, bolgeler[b.bolge - 1]?.parca);
    const gerekli = (b) => (ocrGerekirMi(b) || supheli(b) || latinSesMi(b)) && !b.ocrOturdu && Number(b.ocrDenendi ?? 0) < OCR_SURUMU;
    // Atlanan yazı denetimi de OCR ister: balonsuz metni olan (OCR'nin bu
    // sayfada işe yaradığı) ve henüz denetlenmemiş dilimde OCR yeniden
    // çalışır. Önceden yalnızca yerleştirilecek metin varken çalışıyordu;
    // balonsuz metinleri önceki sürümlerde zaten OCR ile oturmuş önbellek
    // kayıtlarında denetim hiç yapılmıyordu (kullanıcının sayfası).
    const eksikDenetimi = a.motor === Motor.GORSEL && !balonlar.some((b) => b.eksikDenendi) && balonlar.some((b) => !b.bolge && b.tur !== 'ses');
    if (a.motor !== Motor.GORSEL || (!balonlar.some(gerekli) && !eksikDenetimi)) return { balonlar, degisti: false };
    let ocr;
    try {
      ocr = await this.ocrKopru().kelimeleriOku(resim);
    } catch {
      return { balonlar, degisti: false };
    }
    const adaylar = balonlar.filter(gerekli);
    // İşaretli alanlar (numaralı balonlar) sayfa genelindeki aramaya girmez.
    const isaretli = (resim.bolgeler ?? []).map(({ kutu: [y0, x0, y1, x1] }) => ({ x0: x0 / 1000, y0: y0 / 1000, x1: x1 / 1000, y1: y1 / 1000 }));
    if (!adaylar.length) return { balonlar, degisti: false, ocr, isaretli };
    // Şüpheli numaralı metin numarasız gibi aranır; OCR bulursa numarası
    // düşer, bulamazsa numarasıyla kalır (içerik betiği yine denetler).
    const sonuc = ocrIleOturt(adaylar.map((b) => (supheli(b) ? { ...b, bolge: 0 } : b)), ocr, { isaretli });
    const yeni = new Map(adaylar.map((b, i) => {
      const s = supheli(b) && !sonuc[i].ocrOturdu ? b : sonuc[i];
      return [b, { ...s, ocrDenendi: OCR_SURUMU }];
    }));
    return { balonlar: balonlar.map((b) => yeni.get(b) ?? b), degisti: true, ocr, isaretli };
  }

  /**
   * Modelin atladığı yazılar (OCR'nin okuyup hiçbir çevirinin örtmediği
   * kümeler) varsa model bir kez daha, o alanlar söylenerek sorulur;
   * yanıttan yalnızca o yazılara karşılık gelen metinler alınıp OCR ile
   * yerine konur. Dilim başına bir kez (eksikDenendi). OCR'nin zaten
   * çalıştığı sayfalarda yapılır; ek OCR maliyeti yok.
   * Atlanan yazı bulunmasa da kayıtlar eksikDenendi işaretlenir (önbelleğe
   * yazılınca OCR bu denetim için bir daha çalışmasın).
   * @returns {Promise<{balonlar: object[], eklenen: number, soruldu: boolean} | null>}
   *   null: denetim yapılmadı ya da ikinci istek hata verdi.
   */
  async eksikleriTamamla(a, balonlar, resim, { ocr, isaretli }, id, oncelik) {
    if (a.motor !== Motor.GORSEL || !ocr || balonlar.some((b) => b.eksikDenendi)) return null;
    const atlananlar = atlananYazilar(balonlar, ocr, { isaretli });
    const isaretle = (liste) => liste.map((b) => ({ ...b, eksikDenendi: true }));
    if (!atlananlar.length) return { balonlar: isaretle(balonlar), eklenen: 0, soruldu: false };
    const motor = this.motor(a);
    let ek;
    try {
      ek = await this.kuyruk.ekle(id, oncelik, (sinyal) =>
        motor.cevir({ resim: { ...resim, eksikler: atlananlar.map((x) => x.kutu) }, hedefDil: a.hedefDil, sinyal }),
      );
    } catch (e) {
      if (e?.anahtar === 'hata.durduruldu') throw e;
      return null; // ilk sonuç kalır; işaret konmadığı için sonra yeniden denenir
    }
    const varOlan = new Set(balonlar.map((b) => String(b.orijinal).toUpperCase()));
    const yeniler = ek.balonlar.filter((b) => !varOlan.has(String(b.orijinal).toUpperCase()) &&
      atlananlar.some((x) => atlananaUyar(x, b.orijinal)));
    const oturmus = ocrIleOturt(yeniler.map((b) => ({ ...b, bolge: 0 })), ocr, { isaretli })
      .map((b) => ({ ...b, ocrDenendi: OCR_SURUMU }));
    return { balonlar: isaretle([...balonlar, ...oturmus]), eklenen: oturmus.length, soruldu: true };
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
    const isaretSayisi = resim.bolgeler?.length ?? 0;
    const eksikMi = (liste) =>
      a.motor === Motor.GORSEL && isaretSayisi >= KAPSAMA_ICIN_EN_AZ_ISARET &&
      kapsananIsaret(liste) < EN_AZ_KAPSAMA * isaretSayisi;
    // Eski sürümlerin yazdığı boş kayıt da yok sayılır (bkz. aşağıdaki kural).
    // Balonların çoğunu atlamış eski bir kayıt da (yeniden sorma kuralından
    // önce yazılmış) bir kez daha sorulur.
    if (kayitli?.length && !(eksikMi(kayitli) && !kayitli.some((b) => b.kapsamaDenendi))) {
      // OCR düzeltmesinden önceki sürümlerin kaydı: bir kez düzeltilip
      // önbellek güncellenir (yoksa o sayfa eski kutularla kalıyordu).
      const duzeltme = await this.ocrIleDuzelt(a, kayitli, resim);
      const tamam = duzeltme.ocr ? await this.eksikleriTamamla(a, duzeltme.balonlar, resim, duzeltme, id, oncelik) : null;
      const balonlar = tamam?.balonlar ?? duzeltme.balonlar;
      if (duzeltme.degisti || tamam) await this.onbellek.koy(anahtar, balonlar).catch(() => {});
      return { balonlar, onbellekten: true, ...(tamam?.soruldu ? { tani: { eksikEklenen: tamam.eklenen } } : {}) };
    }

    const motor = this.motor(a);
    this.kuyruk.esZaman = ES_ZAMAN[a.motor];
    const ham = await this.kuyruk.ekle(id, oncelik, async (sinyal) => {
      const ilk = await motor.cevir({ resim, hedefDil: a.hedefDil, sinyal });
      if (!eksikMi(ilk.balonlar)) return ilk;
      // Model işaretli balonların çoğunu atladı: bir kez daha sorulur, daha
      // çok balonu kapsayan yanıt kalır. İkinci deneme hata verirse ilki.
      const ikinci = await motor.cevir({ resim, hedefDil: a.hedefDil, sinyal }).catch((e) => {
        if (sinyal?.aborted) throw e;
        return null;
      });
      const secilen = ikinci && kapsananIsaret(ikinci.balonlar) > kapsananIsaret(ilk.balonlar) ? ikinci : ilk;
      return { ...secilen, yenidenSoruldu: true };
    });
    const duzeltme = await this.ocrIleDuzelt(a, ham.balonlar, resim);
    const tamam = duzeltme.ocr ? await this.eksikleriTamamla(a, duzeltme.balonlar, resim, duzeltme, id, oncelik) : null;
    const duzelmis = tamam?.balonlar ?? duzeltme.balonlar;
    // Yeniden sorulduysa (yine eksik olsa da) bir daha sorulmasın.
    const balonlar = ham.yenidenSoruldu ? duzelmis.map((b) => ({ ...b, kapsamaDenendi: true })) : duzelmis;
    // Önbelleğe yazılamasa da çeviri gösterilsin. Boş sonuç yazılmaz: model
    // bir kez yanılıp "yazı yok" derse sayfa sonsuza kadar boş kalmasın.
    if (balonlar.length) await this.onbellek.koy(anahtar, balonlar).catch(() => {});
    // Konsol izi için: modelin döndürdüğü/atılan kayıt sayısı, yeniden soruldu mu.
    const tani = { ...(ham.istatistik ?? {}), ...(ham.yenidenSoruldu ? { yenidenSoruldu: true } : {}), ...(tamam?.soruldu ? { eksikEklenen: tamam.eklenen } : {}) };
    return { balonlar, onbellekten: false, ...(Object.keys(tani).length ? { tani } : {}) };
  }
}
