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

import { Motor, ayarlariTamamla } from '../ayarlar.js';
import { dilimBalonlariniYerlestir } from '../dilimleme.js';
import { kutulariOturt } from '../kutu_oturtma.js';
import { Kuyruk, Oncelik } from '../kuyruk.js';
import { tarayici } from '../tarayici.js';
import { hatayiPaketle } from '../yz/ortak.js';
import { adayMi } from './aday.js';
import { canvasIzi } from './canvas.js';
import { Gorunum, KATMAN_ETIKETI } from './gorunum.js';
import { arkaPlanaBildir, arkaPlanaGonder, eklentiKoptuMu } from './mesaj.js';
import { dilimlereAyir, resimBaytlari } from './resim_al.js';

/**
 * Konsola tek satırlık iz: bir sayfa neden çevrilmedi sorusuna cevap için
 * (F12 → Console → "Manga" ile süz).
 */
function iz(...parcalar) {
  console.info('[Manga Çevirmen]', ...parcalar.filter((p) => p !== '' && p != null));
}

/** Eklentinin yeniden yüklenip yüklenmediği bu aralıkla denetlenir. */
const SAHIPSIZ_DENETIM_MS = 2000;

/** Bu kadar ekran yukarı/aşağıdaki resimler "yakın" sayılır. */
const YAKIN_PAYI = '300%';
/**
 * Resim baytlarını alma + dilimleme aynı anda en çok bu kadar resimde: bir
 * bölümün onlarca sayfası birden yüklenince sayfa takılmasın. Sıra yine
 * önceliğe göre (ekrandaki önce).
 */
const ES_ZAMANLI_HAZIRLIK = 2;
/**
 * Canvas okuyucularında canvas'lar bu aralıkla denetlenir: canvas'ın adresi
 * olmadığı için yeni sayfanın çizildiği ancak içeriğine (parmak izine)
 * bakılarak anlaşılır.
 */
const CANVAS_DENETIM_MS = 1000;

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
    /** Canvas → son görülen adresi (parmak izi); oturmuş sayılmak için iki kez aynı görülmeli. */
    this.canvasAdaylari = new WeakMap();

    this.gorunurGozcu = new IntersectionObserver((g) => this._gorunurluk(g, this.gorunur));
    this.yakinGozcu = new IntersectionObserver((g) => this._gorunurluk(g, this.yakin), {
      rootMargin: `${YAKIN_PAYI} 0px`,
    });
    this.degisimGozcu = new MutationObserver((d) => this._degisimler(d));
  }

  async baslat() {
    // Eski bir sürümün sahipsiz betiğinden kalan katmanlar (o sürüm kendini
    // temizlemiyordu). Bu modülde ikinci başlatma olmadığı için (baslat())
    // sayfadaki her katman başkasınındır.
    document.querySelectorAll(KATMAN_ETIKETI).forEach((e) => e.remove());
    // Sayfa hiç değişmese de (sabit okuyucu) sahipsiz kalış fark edilsin.
    this._sahipsizDenetimi = setInterval(() => eklentiKoptuMu() && this.sahipsizKal(), SAHIPSIZ_DENETIM_MS);
    await this._ayarlariOku();
    this.degisimGozcu.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'width', 'height'],
    });
    document.querySelectorAll('img, canvas').forEach((img) => this._incele(img));
    this._canvasDenetimi = setInterval(() => this._canvaslariDenetle(), CANVAS_DENETIM_MS);
    // Sayfadan çıkılırken (sekme kapanmadan başka sayfaya geçiş) işler boşa çevrilmesin.
    this._sayfadanCikis = () => arkaPlanaBildir({ tip: 'iptal' });
    addEventListener('pagehide', this._sayfadanCikis);
    // Sayfa tarayıcının "geri" önbelleğinden dönünce yarıda kalanlar baştan.
    this._sayfayaDonus = (e) => {
      if (!e.persisted) return;
      for (const img of [...this.takipte]) if (this.kayitlar.get(img)?.durdu) this._tekrarDene(img);
    };
    addEventListener('pageshow', this._sayfayaDonus);
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
    if (eklentiKoptuMu()) return this.sahipsizKal();
    for (const d of degisimler) {
      if (d.type === 'attributes') {
        if (d.target instanceof HTMLImageElement || d.target instanceof HTMLCanvasElement) this._incele(d.target);
        continue;
      }
      for (const n of d.addedNodes) {
        if (n instanceof HTMLImageElement || n instanceof HTMLCanvasElement) this._incele(n);
        else if (n instanceof Element) n.querySelectorAll('img, canvas').forEach((img) => this._incele(img));
      }
      if (d.removedNodes.length) this._kaldirilanlariTemizle();
    }
  }

  /**
   * Sayfadaki canvas'lar: yeni çizilen sayfa (parmak izi değişti) yeniden
   * çevrilir. Canvas yoksa iş yok.
   */
  _canvaslariDenetle() {
    if (eklentiKoptuMu()) return this.sahipsizKal();
    for (const c of document.getElementsByTagName('canvas')) this._incele(c);
  }

  /**
   * Canvas aday mı, içeriği değişti mi? Okuyucu çizerken (ara kareler)
   * çevrilmesin diye parmak izi iki denetim üst üste aynı kalınca adres
   * sayılır. Boş canvas atlanır.
   */
  _inceleCanvas(c) {
    const kutu = c.getBoundingClientRect();
    if (!adayMi({ dogalGenislik: c.width, dogalYukseklik: c.height, gorunenGenislik: kutu.width, gorunuyorMu: kutu.width > 0 && kutu.height > 0 })) return null;
    const { iz, kirli } = canvasIzi(c);
    const adres = kirli ? 'canvas:kirli' : iz && `canvas:${c.width}x${c.height}:${iz}`;
    const onceki = this.canvasAdaylari.get(c);
    this.canvasAdaylari.set(c, adres);
    // Yeni sayfa çiziliyor: eski sayfanın çevirisi hemen kalksın.
    const kayitli = this.kayitlar.get(c);
    if (adres && kayitli && kayitli.adres !== adres) this._birak(c, kayitli);
    if (!adres || adres !== onceki) return null; // boş ya da henüz oturmadı
    return { adres, kutu };
  }

  /** Resim aday mı, yeni mi, adresi değişti mi? Gerekirse çeviriyi başlatır. */
  _incele(img) {
    if (img instanceof HTMLCanvasElement) return this._kaydet(img, this._inceleCanvas(img));
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
    if (this.kayitlar.get(img)?.adres === adres) return;
    const kutu = img.getBoundingClientRect();
    this._kaydet(img, { adres, kutu });
  }

  /** Yeni ya da adresi değişen aday resmi (ya da canvas'ı) kaydeder ve çevirmeye başlar. */
  _kaydet(img, bulgu) {
    if (!bulgu) return;
    const { adres, kutu } = bulgu;
    const eski = this.kayitlar.get(img);
    if (eski?.adres === adres) return;
    if (img instanceof HTMLCanvasElement) {
      if (eski) this._birak(img, eski);
      return this._yeniKayit(img, adres, kutu);
    }
    const aday = adayMi({
      dogalGenislik: img.naturalWidth,
      dogalYukseklik: img.naturalHeight,
      gorunenGenislik: kutu.width,
      gorunuyorMu: kutu.width > 0 && kutu.height > 0,
    });
    if (eski) this._birak(img, eski);
    if (!aday) {
      // Yalnızca sayfa olabilecek boyuttakiler (ikonlar konsolu doldurmasın).
      if (img.naturalWidth >= 300 && img.naturalHeight >= 300) {
        iz('-', 'aday değil', `${img.naturalWidth}x${img.naturalHeight}, görünen ${Math.round(kutu.width)} px`);
      }
      return;
    }
    this._yeniKayit(img, adres, kutu);
  }

  _yeniKayit(img, adres, kutu) {
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
      // İptal edilip yarıda kalan resim ekrana/yakına gelince baştan çevrilir.
      if (kayit.durdu && g.isIntersecting) {
        this._tekrarDene(g.target);
        continue;
      }
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
    let onbellekten = 0;
    try {
      const { dilimler, yukseklik } = await this.hazirlik.ekle(kayit.kimlik, kayit.oncelik, async () =>
        // Görsel YZ'de balonlar numaralanır; model metni numarayla balona bağlar.
        dilimlereAyir(await resimBaytlari(img), { isaretle: this.ayarlar.motor === Motor.GORSEL }),
      );
      // Dilimler aynı anda kuyruğa girer; her biri geldikçe gösterilir.
      await Promise.all(
        dilimler.map(async (d, i) => {
          const { balonlar, onbellekten: ob, tani } = await arkaPlanaGonder({
            tip: 'cevir',
            resimKimligi: kayit.kimlik,
            dilim: i,
            oncelik: kayit.oncelik,
            resim: { veri: d.veri, tur: d.tur, genislik: d.genislik, yukseklik: d.yukseklik, bolgeler: d.bolgeler },
          });
          if (ob) onbellekten++;
          // Boş kalan balonun sebebi konsoldan anlaşılsın: model metni hiç mi
          // döndürmedi, yoksa hangi numarayı verdi.
          iz(kayit.kimlik, `dilim ${i}:`, `${d.bulunanlar?.length ?? 0} işaret,`,
            `modelden ${balonlar.length} metin`, `(numaralar: ${balonlar.map((b) => b.bolge || '-').join(',')})`,
            tani?.atlanan ? `${tani.atlanan} kayıt kullanılamadı` : '', tani?.yenidenSoruldu ? 'model yeniden soruldu' : '',
            tani?.eksikEklenen != null ? `atlanan yazı için yeniden soruldu, ${tani.eksikEklenen} metin eklendi` : '');
          // Numaralı metinler bulunan balonlara, numarasızlar en yakın balona
          // oturtulur (önbellekteki sonuç da: numaralar aynı resimde aynı).
          const oturmus = kutulariOturt(d.gri, balonlar, d.bulunanlar);
          guncelle({ balonlar: [...durum.balonlar, ...dilimBalonlariniYerlestir(d, yukseklik, oturmus)] });
        }),
      );
      guncelle({ durum: 'tamam' });
    } catch (e) {
      const hata = hatayiPaketle(e);
      if (hata.anahtar !== 'hata.durduruldu') {
        guncelle({ durum: 'hata', hata });
        iz(kayit.kimlik, 'hata', hata.anahtar, hata.parametreler);
        return;
      }
      // İptal: resim sayfadan kalktıysa ya da adresi değiştiyse yapılacak bir
      // şey yok. Hâlâ duruyorsa (ör. sayfa "geri" önbelleğinden döndü, iptal
      // pagehide'da gitti) "durdu" işaretlenir; görünür olunca ya da sayfa
      // geri gelince baştan çevrilir. Önceden bu resimler hiç işaretsiz,
      // çevrilmemiş kalıyordu.
      if (this.kayitlar.get(img) === kayit && img.isConnected) {
        kayit.durdu = true;
        guncelle({ durum: 'bekliyor' });
        iz(kayit.kimlik, 'durdu (görünür olunca yeniden denenecek)');
      }
      return;
    }
    iz(kayit.kimlik, 'tamam', `${durum.balonlar.length} metin`, onbellekten ? `(${onbellekten} dilim önbellekten)` : '');
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

  /**
   * Eklenti yeniden yüklendi/güncellendi: bu betik artık sahipsiz. Durur ve
   * çevirilerini de kaldırır. Önceden yalnızca duruyordu; eski sürümün
   * çevirileri ekranda kalıyor, yeni betik (açılır pencereden ya da
   * yenilemeden) ikinci bir katman açınca iki sürümün sonuçları üst üste
   * biniyordu (kullanıcının sayfasında iki manga-cevirmen-katmani vardı).
   */
  sahipsizKal() {
    this.durdur();
    clearInterval(this._sahipsizDenetimi);
    this.gorunum.yokEt();
  }

  durdur() {
    clearInterval(this._sahipsizDenetimi);
    clearInterval(this._canvasDenetimi);
    this.degisimGozcu.disconnect();
    this.gorunurGozcu.disconnect();
    this.yakinGozcu.disconnect();
    removeEventListener('pagehide', this._sayfadanCikis);
    removeEventListener('pageshow', this._sayfayaDonus);
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
