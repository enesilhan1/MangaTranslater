// İçerik betiğinin ana akışı (docs/SPEC.md §4-§6). "Her zaman çevir"
// listesindeki sitelerde her sayfada kendiliğinden yüklenir
// (icerik/yukleyici.js) ve:
// - sayfadaki ve sonradan eklenen aday resimleri bulur (MutationObserver;
//   tek sayfalık uygulamalarda bölüm değişince de çalışır),
// - her resmi görünürlüğüne göre öncelikle arka plana gönderir: ekrandaki
//   önce, birkaç ekran ilerideki sonra, görünmeyen (önceden yüklenmiş) en
//   son; kaydırdıkça öncelikleri günceller,
// - resmin adresi değişince ya da resim sayfadan kalkınca işini iptal eder,
// - uzun şeritlerin dilim sonuçlarını geldikçe birleştirip görünüme verir.

import { ayarlariTamamla } from '../ayarlar.js';
import { dilimBalonlariniYerlestir } from '../dilimleme.js';
import { kutulariOturt } from '../kutu_oturtma.js';
import { Kuyruk, Oncelik } from '../kuyruk.js';
import { tarayici } from '../tarayici.js';
import { hatayiPaketle } from '../yz/ortak.js';
import { adayMi } from './aday.js';
import { Gorunum } from './gorunum.js';
import { arkaPlanaBildir, arkaPlanaGonder, eklentiKoptuMu } from './mesaj.js';
import { dilimlereAyir, resimBaytlari } from './resim_al.js';

/** Bu kadar ekran yukarı/aşağıdaki resimler "yakın" sayılır. */
const YAKIN_PAYI = '300%';
/**
 * Resim baytlarını alma + dilimleme aynı anda en çok bu kadar resimde: bir
 * bölümün onlarca sayfası birden yüklenince sayfa takılmasın. Sıra yine
 * önceliğe göre (ekrandaki önce).
 */
const ES_ZAMANLI_HAZIRLIK = 2;

class Cevirmen {
  constructor() {
    this.ayarlar = ayarlariTamamla(null);
    this.gorunum = new Gorunum({
      dil: () => this.ayarlar.arayuzDili,
      hedefDil: () => this.ayarlar.hedefDil,
      tekrarDene: (img) => this._tekrarDene(img),
    });
    /** @type {WeakMap<HTMLImageElement, {kimlik: string, adres: string, oncelik: number,
     *   durum: import('./gorunum.js').ResimDurumu}>} */
    this.kayitlar = new WeakMap();
    /** Sayfada takip edilen resimler (kaldırılanları bulmak için). */
    this.takipte = new Set();
    this._sayac = 0;
    this.hazirlik = new Kuyruk({ esZaman: ES_ZAMANLI_HAZIRLIK });
    /** load bekleyen resimler (dinleyici bir kez eklensin). */
    this.yukleniyor = new WeakSet();
    this.gorunur = new Set();
    this.yakin = new Set();

    this.gorunurGozcu = new IntersectionObserver((g) => this._gorunurluk(g, this.gorunur));
    this.yakinGozcu = new IntersectionObserver((g) => this._gorunurluk(g, this.yakin), {
      rootMargin: `${YAKIN_PAYI} 0px`,
    });
    this.degisimGozcu = new MutationObserver((d) => this._degisimler(d));
  }

  async baslat() {
    await this._ayarlariOku();
    this.degisimGozcu.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset'],
    });
    document.querySelectorAll('img').forEach((img) => this._incele(img));
    // Sayfadan çıkılırken (sekme kapanmadan başka sayfaya geçiş) işler boşa çevrilmesin.
    this._sayfadanCikis = () => arkaPlanaBildir({ tip: 'iptal' });
    addEventListener('pagehide', this._sayfadanCikis);
  }

  async _ayarlariOku() {
    try {
      this.ayarlar = ayarlariTamamla((await tarayici.storage.local.get('ayarlar')).ayarlar);
    } catch {
      // varsayılanlarla devam
    }
  }

  /** Hata işaretine tıklandı: resmi baştan çevir. */
  _tekrarDene(img) {
    const kayit = this.kayitlar.get(img);
    if (kayit) this._birak(img, kayit);
    this._incele(img);
  }

  _degisimler(degisimler) {
    if (eklentiKoptuMu()) return this.durdur();
    for (const d of degisimler) {
      if (d.type === 'attributes') {
        if (d.target instanceof HTMLImageElement) this._incele(d.target);
        continue;
      }
      for (const n of d.addedNodes) {
        if (n instanceof HTMLImageElement) this._incele(n);
        else if (n instanceof Element) n.querySelectorAll('img').forEach((img) => this._incele(img));
      }
      if (d.removedNodes.length) this._kaldirilanlariTemizle();
    }
  }

  /** Resim aday mı, yeni mi, adresi değişti mi? Gerekirse çeviriyi başlatır. */
  _incele(img) {
    if (!img.complete || !img.naturalWidth) {
      if (this.yukleniyor.has(img)) return;
      this.yukleniyor.add(img);
      img.addEventListener(
        'load',
        () => {
          this.yukleniyor.delete(img);
          this._incele(img);
        },
        { once: true },
      );
      return;
    }
    const adres = img.currentSrc || img.src;
    const eski = this.kayitlar.get(img);
    if (eski?.adres === adres) return;

    const kutu = img.getBoundingClientRect();
    const aday = adayMi({
      dogalGenislik: img.naturalWidth,
      dogalYukseklik: img.naturalHeight,
      gorunenGenislik: kutu.width,
      gorunuyorMu: kutu.width > 0 && kutu.height > 0,
    });
    if (eski) this._birak(img, eski);
    if (!aday) return;

    const kayit = {
      kimlik: `r${++this._sayac}`,
      adres,
      oncelik: this._oncelikHesapla(img, kutu),
      durum: { kimlik: '', durum: 'bekliyor', balonlar: [], hata: null },
    };
    kayit.durum.kimlik = kayit.kimlik;
    this.kayitlar.set(img, kayit);
    this.takipte.add(img);
    this.gorunurGozcu.observe(img);
    this.yakinGozcu.observe(img);
    this._cevir(img, kayit);
  }

  _oncelikHesapla(img, kutu = img.getBoundingClientRect()) {
    if (this.gorunur.has(img)) return Oncelik.GORUNUR;
    if (this.yakin.has(img)) return Oncelik.YAKIN;
    // Gözcüler henüz bildirmediyse ilk konumdan tahmin et.
    if (!kutu.height) return Oncelik.GIZLI;
    if (kutu.bottom > 0 && kutu.top < innerHeight) return Oncelik.GORUNUR;
    if (kutu.bottom > -3 * innerHeight && kutu.top < 4 * innerHeight) return Oncelik.YAKIN;
    return Oncelik.GIZLI;
  }

  _gorunurluk(girdiler, kume) {
    for (const g of girdiler) {
      if (g.isIntersecting) kume.add(g.target);
      else kume.delete(g.target);
      const kayit = this.kayitlar.get(g.target);
      if (!kayit) continue;
      const yeni = this._oncelikHesapla(g.target);
      if (yeni !== kayit.oncelik) {
        kayit.oncelik = yeni;
        this.hazirlik.oncelikDegistir(kayit.kimlik, yeni);
        arkaPlanaBildir({ tip: 'oncelik', resimKimligi: kayit.kimlik, oncelik: yeni });
      }
    }
  }

  async _cevir(img, kayit) {
    const durum = kayit.durum;
    const guncelle = (degisiklik) => {
      if (this.kayitlar.get(img) !== kayit) return; // bu arada adres değişti
      Object.assign(durum, degisiklik);
      this.gorunum.guncelle(img, durum);
    };
    guncelle({ durum: 'cevriliyor' });
    try {
      const { dilimler, yukseklik } = await this.hazirlik.ekle(kayit.kimlik, kayit.oncelik, async () =>
        dilimlereAyir(await resimBaytlari(img)),
      );
      // Dilimler aynı anda kuyruğa girer; her biri geldikçe gösterilir.
      await Promise.all(
        dilimler.map(async (d, i) => {
          const { balonlar } = await arkaPlanaGonder({
            tip: 'cevir',
            resimKimligi: kayit.kimlik,
            dilim: i,
            oncelik: kayit.oncelik,
            resim: { veri: d.veri, tur: d.tur, genislik: d.genislik, yukseklik: d.yukseklik },
          });
          // Modelin kutuları resimdeki balonlara oturtulur (önbellekteki sonuç da).
          const oturmus = kutulariOturt(d.gri, balonlar);
          guncelle({ balonlar: [...durum.balonlar, ...dilimBalonlariniYerlestir(d, yukseklik, oturmus)] });
        }),
      );
      guncelle({ durum: 'tamam' });
    } catch (e) {
      const hata = hatayiPaketle(e);
      // İptal edilen (adres değişen/kalkan) resim için hata gösterilmez.
      if (hata.anahtar !== 'hata.durduruldu') guncelle({ durum: 'hata', hata });
    }
  }

  /** Resmin işini iptal eder ve görünümünü kaldırır. */
  _birak(img, kayit) {
    arkaPlanaBildir({ tip: 'iptal', resimKimligi: kayit.kimlik });
    this.hazirlik.iptal(kayit.kimlik);
    this.kayitlar.delete(img);
    this.takipte.delete(img);
    this.gorunurGozcu.unobserve(img);
    this.yakinGozcu.unobserve(img);
    this.gorunur.delete(img);
    this.yakin.delete(img);
    this.gorunum.kaldir(img);
  }

  _kaldirilanlariTemizle() {
    for (const img of this.takipte) {
      if (!img.isConnected) this._birak(img, this.kayitlar.get(img));
    }
  }

  /** Eklenti yeniden yüklendiyse bu (artık sahipsiz) betik sessizce durur. */
  durdur() {
    this.degisimGozcu.disconnect();
    this.gorunurGozcu.disconnect();
    this.yakinGozcu.disconnect();
    removeEventListener('pagehide', this._sayfadanCikis);
  }

  /** Site listeden çıkarıldı: işleri iptal et, çevirileri sayfadan kaldır. */
  kapat() {
    this.durdur();
    arkaPlanaBildir({ tip: 'iptal' });
    for (const img of [...this.takipte]) this._birak(img, this.kayitlar.get(img));
    this.gorunum.yokEt();
  }
}

/** Bu sayfadaki çalışan örnek (yoksa null: site kapalı ya da henüz başlamadı). */
let etkin = null;

/**
 * Yükleyicinin (icerik/yukleyici.js) çağırdığı giriş noktası. ES modülü
 * sayfada yalnızca bir kez çalıştığı için başlatma bu fonksiyonla yapılır:
 * site kapatılıp aynı sayfada yeniden açılınca yükleyici tekrar çağırır.
 * Zaten çalışıyorsa (ör. hem kayıtlı betik hem anında enjeksiyon) ikinci
 * çağrı bir şey yapmaz.
 */
export function baslat() {
  if (etkin) return;
  etkin = new Cevirmen();
  etkin.baslat();
}

// Dinleyiciler modül düzeyinde bir kez kurulur ve o anki örneğe iletir.
tarayici.runtime.onMessage.addListener((m) => {
  if (!etkin) return;
  // Alt+T (arka plandaki commands kısayolu) → orijinal ↔ çeviri.
  if (m?.tip === 'gecis') etkin.gorunum.gecis();
  // Açılır pencerede "bu sitede çevir" kapatıldı.
  if (m?.tip === 'kapat') {
    etkin.kapat();
    etkin = null;
  }
});
tarayici.storage.onChanged.addListener((d, alan) => {
  if (etkin && alan === 'local' && d.ayarlar) etkin.ayarlar = ayarlariTamamla(d.ayarlar.newValue);
});
