// Açılır pencere (docs/SPEC.md §4, §8): bu sitede her zaman çevir, motor,
// sağlayıcı/model/anahtar, Chrome çevirmeni, MyMemory e-postası, hedef dil,
// arayüz dili, site listesi, önbelleği temizleme. Her değişiklik hemen
// kaydedilir; arka plan ve içerik betikleri storage.onChanged ile alır.

import { AyarDeposu, Motor } from '../src/ayarlar.js';
import { ARAYUZ_DILLERI, cevir } from '../src/dil.js';
import { HEDEF_DILLER } from '../src/diller.js';
import { YUKLEYICI, alanAdi, siteCikar, siteEkle, siteKapsar } from '../src/siteler.js';
import { SITE_IZNI, siteIzniVarMi, tarayici } from '../src/tarayici.js';
import { ChromeCevirmeni } from '../src/yerel/metin_cevirmenleri.js';
import { KAYNAK_DIL } from '../src/yerel/yerel_cevirmen.js';
import { SAGLAYICILAR, anahtarBicimiUygun, saglayiciBul } from '../src/yz/katalog.js';

const ELLE = '__elle__';
const depo = new AyarDeposu(tarayici.storage.local);
const chromeCevirmeni = new ChromeCevirmeni(globalThis.Translator);
const kok = document.getElementById('uygulama');

const durum = {
  /** @type {ReturnType<import('../src/ayarlar.js').ayarlariTamamla>} */
  a: null,
  sekme: null,
  izin: true,
  /** Chrome çevirmeninin hedef dil için durumu ya da 'iniyor'. */
  cevirmen: 'unavailable',
  indirmeOrani: 0,
  cevirmenHatasi: '',
  anahtarGorunur: false,
  /** Listede olmayan model yazılıyor mu (seçimde "Diğer"). */
  elleModel: false,
  bilgi: '',
};

const t = (anahtar, p) => cevir(durum.a.arayuzDili, anahtar, p);

/** Küçük DOM yardımcısı: el('div', {class: 'x', onclick}, ...çocuklar). */
function el(etiket, ozellikler = {}, ...cocuklar) {
  const e = document.createElement(etiket);
  for (const [k, v] of Object.entries(ozellikler)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...cocuklar.flat().filter((c) => c != null && c !== false));
  return e;
}

async function guncelle(degistir) {
  durum.a = await depo.guncelle(degistir);
}

// ---------------------------------------------------------------------------
// Bölümler

function izinBolumu() {
  if (durum.izin) return null;
  return el('p', { class: 'uyari' }, t('ui.izinYok'),
    el('button', {
      class: 'ana',
      onclick: async () => {
        // İzin isteği kullanıcı tıklamasının hemen ardından yapılmalı.
        durum.izin = await tarayici.permissions.request(SITE_IZNI).catch(() => false);
        ciz();
      },
    }, t('ui.izinVer')));
}

function siteBolumu() {
  const ad = durum.sekme ? alanAdi(durum.sekme.url ?? '') : null;
  if (!ad) return el('section', { class: 'kart' }, el('p', { class: 'aciklama' }, t('ui.siteYok')));
  const acik = siteKapsar(durum.a.siteler, ad);
  return el('section', { class: 'kart' },
    el('div', { class: 'anahtar-satir' },
      el('div', {}, el('strong', {}, t('ui.buSite')), el('span', { class: 'site-adi' }, ad)),
      el('label', { class: 'dugme-anahtar' },
        el('input', {
          type: 'checkbox',
          role: 'switch',
          checked: acik,
          'aria-label': t('ui.buSite'),
          onchange: (e) => siteDegistir(ad, e.target.checked),
        }),
        el('span'))),
    acik ? el('p', { class: 'aciklama' }, t('ui.buSiteAciklama', { site: ad })) : null);
}

async function siteDegistir(ad, acik) {
  await guncelle((a) => ({ ...a, siteler: acik ? siteEkle(a.siteler, ad) : siteCikar(a.siteler, ad) }));
  const id = durum.sekme.id;
  if (acik) {
    // Kayıt bir sonraki sayfa yüklemesinden itibaren geçerli; açık sayfa
    // yenilemeden çevrilsin diye betik bu sekmeye hemen de enjekte edilir.
    tarayici.scripting.executeScript({ target: { tabId: id }, files: [YUKLEYICI] }).catch(() => {});
  } else {
    tarayici.tabs.sendMessage(id, { tip: 'kapat' }).catch(() => {});
  }
  ciz();
}

function motorBolumu() {
  const secenek = (deger, baslik, aciklama) =>
    el('label', { class: 'motor' },
      el('input', {
        type: 'radio',
        name: 'motor',
        value: deger,
        checked: durum.a.motor === deger,
        onchange: async () => {
          await guncelle((a) => ({ ...a, motor: deger }));
          await cevirmenDurumunuOku();
          ciz();
        },
      }),
      el('strong', {}, baslik),
      el('small', {}, aciklama));
  return el('section', {},
    el('h2', {}, t('ui.motor')),
    el('div', { class: 'motorlar', role: 'radiogroup' },
      secenek(Motor.GORSEL, t('ui.motor.gorsel'), t('ui.motor.gorselAciklama')),
      secenek(Motor.YEREL, t('ui.motor.yerel'), t('ui.motor.yerelAciklama'))),
    durum.a.motor === Motor.GORSEL ? gorselAyarlari() : yerelAyarlari());
}

function gorselAyarlari() {
  const a = durum.a;
  const s = saglayiciBul(a.saglayici);
  const kayitliModel = (a.modeller[s.id] ?? '').trim();
  const listede = !kayitliModel || s.modeller.some((m) => m.id === kayitliModel);
  const elle = durum.elleModel || !listede;
  const anahtar = a.anahtarlar[s.id] ?? '';
  const bicimUyarisi = anahtar.trim() && !anahtarBicimiUygun(s.id, anahtar);

  return el('div', { class: 'kart', style: 'display:grid;gap:8px' },
    el('label', { class: 'alan' }, t('ui.saglayici'),
      el('select', {
        onchange: async (e) => {
          durum.elleModel = false;
          await guncelle((x) => ({ ...x, saglayici: e.target.value }));
          ciz();
        },
      }, SAGLAYICILAR.map((x) => el('option', { value: x.id, selected: x.id === s.id }, x.ad)))),
    el('label', { class: 'alan' }, t('ui.model'),
      el('select', {
        onchange: async (e) => {
          const v = e.target.value;
          durum.elleModel = v === ELLE;
          if (v !== ELLE) await guncelle((x) => ({ ...x, modeller: { ...x.modeller, [s.id]: v } }));
          ciz();
        },
      },
      s.modeller.map((m) =>
        el('option', { value: m.id, selected: !elle && (kayitliModel || s.modeller[0].id) === m.id },
          `${m.ad} — ${m.aciklama[a.arayuzDili] ?? m.aciklama.tr}`)),
      el('option', { value: ELLE, selected: elle }, t('ui.modelElle')))),
    elle
      ? el('label', { class: 'alan' }, t('ui.modelAdi'),
        el('input', {
          type: 'text',
          value: listede ? '' : kayitliModel,
          spellcheck: 'false',
          placeholder: s.modeller[0].id,
          onchange: (e) => guncelle((x) => ({ ...x, modeller: { ...x.modeller, [s.id]: e.target.value.trim() } })),
        }))
      : null,
    el('label', { class: 'alan' },
      el('span', {}, t('ui.anahtar'), ' · ', el('a', { href: s.anahtarSayfasi, target: '_blank', rel: 'noreferrer' }, t('ui.anahtarAl'))),
      el('div', { class: 'yan-yana' },
        el('input', {
          type: durum.anahtarGorunur ? 'text' : 'password',
          value: anahtar,
          spellcheck: 'false',
          autocomplete: 'off',
          placeholder: s.anahtarOneki ? `${s.anahtarOneki}…` : '',
          // Yazarken kaydedilir ama yeniden çizilmez (imleç kaybolmasın).
          oninput: (e) => guncelle((x) => ({ ...x, anahtarlar: { ...x.anahtarlar, [s.id]: e.target.value.trim() } })),
          onchange: () => ciz(),
        }),
        el('button', {
          type: 'button',
          onclick: () => {
            durum.anahtarGorunur = !durum.anahtarGorunur;
            ciz();
          },
        }, durum.anahtarGorunur ? t('ui.anahtarGizle') : t('ui.anahtarGoster')))),
    bicimUyarisi ? el('p', { class: 'aciklama hata' }, t('ui.anahtarBicim', { ad: s.kisaAd })) : null);
}

function yerelAyarlari() {
  const parcalar = [];
  if (chromeCevirmeni.varMi && durum.a.hedefDil !== KAYNAK_DIL) {
    const d = durum.cevirmen;
    let icerik;
    if (d === 'denetleniyor') icerik = el('p', { class: 'aciklama' }, t('ui.cevirmen.denetleniyor'));
    else if (d === 'available') icerik = el('p', { class: 'aciklama' }, t('ui.cevirmen.hazir'));
    else if (d === 'unavailable') icerik = el('p', { class: 'aciklama' }, t('ui.cevirmen.yok'));
    else if (d === 'iniyor') {
      icerik = el('p', { class: 'aciklama' }, t('ui.cevirmen.iniyor', { oran: Math.round(durum.indirmeOrani * 100) }));
    } else {
      // downloadable / downloading
      icerik = el('div', { style: 'display:grid;gap:6px' },
        el('p', { class: 'aciklama' }, t('ui.cevirmen.indirAciklama')),
        el('button', { class: 'ana', onclick: cevirmeniHazirla }, t('ui.cevirmen.indir')));
    }
    parcalar.push(el('div', {}, el('h2', {}, t('ui.cevirmen')), icerik,
      durum.cevirmenHatasi ? el('p', { class: 'aciklama hata' }, t('ui.cevirmen.hata', { mesaj: durum.cevirmenHatasi })) : null));
  }
  // MyMemory: Firefox'ta her zaman, Chrome'da çevirmen bu dili desteklemiyorsa.
  if (!chromeCevirmeni.varMi || durum.cevirmen === 'unavailable') {
    parcalar.push(el('label', { class: 'alan' }, t('ui.eposta'),
      el('input', {
        type: 'email',
        value: durum.a.eposta,
        autocomplete: 'email',
        onchange: (e) => guncelle((x) => ({ ...x, eposta: e.target.value.trim() })),
      }),
      el('span', { class: 'aciklama' }, t('ui.epostaAciklama'))));
  }
  return parcalar.length ? el('div', { class: 'kart', style: 'display:grid;gap:8px' }, parcalar) : null;
}

async function cevirmeniHazirla() {
  durum.cevirmen = 'iniyor';
  durum.indirmeOrani = 0;
  durum.cevirmenHatasi = '';
  ciz();
  try {
    // Kullanıcı tıklamasının hemen ardından: Chrome ilk indirmeyi ancak böyle başlatır.
    await chromeCevirmeni.hazirla(KAYNAK_DIL, durum.a.hedefDil, (oran) => {
      durum.indirmeOrani = oran;
      ciz();
    });
  } catch (e) {
    durum.cevirmenHatasi = String(e?.message ?? e);
  }
  // İndirme bitti: "iniyor" işareti kalkmalı ki gerçek durum (hazır vb.) okunsun.
  durum.cevirmen = 'downloadable';
  await cevirmenDurumunuOku();
  ciz();
}

/**
 * Chrome çevirmeninin durumunu okuyup yeniden çizer. availability() yavaş
 * olabildiği için (bkz. DURUM_ZAMAN_ASIMI_MS) çağıranlar beklemeden önce
 * çizer; bu arada "denetleniyor" gösterilir.
 */
async function cevirmenDurumunuOku() {
  if (durum.cevirmen === 'iniyor') return;
  if (durum.a.motor !== Motor.YEREL || !chromeCevirmeni.varMi) {
    durum.cevirmen = 'unavailable';
    return;
  }
  durum.cevirmen = 'denetleniyor';
  ciz();
  const sonuc = await chromeCevirmeni.durum(KAYNAK_DIL, durum.a.hedefDil);
  if (durum.cevirmen === 'denetleniyor') durum.cevirmen = sonuc;
}

function dilBolumu() {
  const a = durum.a;
  return el('section', { class: 'iki-sutun' },
    el('label', { class: 'alan' }, t('ui.hedefDil'),
      el('select', {
        onchange: async (e) => {
          await guncelle((x) => ({ ...x, hedefDil: e.target.value }));
          await cevirmenDurumunuOku();
          ciz();
        },
      }, HEDEF_DILLER.map((d) => el('option', { value: d.kod, selected: d.kod === a.hedefDil }, d.ad[a.arayuzDili] ?? d.ad.tr)))),
    el('label', { class: 'alan' }, t('ui.arayuzDili'),
      el('select', {
        onchange: async (e) => {
          await guncelle((x) => ({ ...x, arayuzDili: e.target.value }));
          ciz();
        },
      }, ARAYUZ_DILLERI.map((d) => el('option', { value: d, selected: d === a.arayuzDili }, d === 'tr' ? 'Türkçe' : 'English')))));
}

function siteListesi() {
  const s = durum.a.siteler;
  return el('section', {},
    el('h2', {}, t('ui.siteler')),
    s.length
      ? el('ul', { class: 'siteler' }, s.map((ad) =>
        el('li', {}, el('span', {}, ad),
          el('button', {
            onclick: async () => {
              await guncelle((x) => ({ ...x, siteler: siteCikar(x.siteler, ad) }));
              const sekmeAdi = alanAdi(durum.sekme?.url ?? '');
              if (sekmeAdi && siteKapsar([ad], sekmeAdi)) tarayici.tabs.sendMessage(durum.sekme.id, { tip: 'kapat' }).catch(() => {});
              ciz();
            },
          }, t('ui.kaldir')))))
      : el('p', { class: 'aciklama' }, t('ui.siteListesiBos')));
}

function altBilgi() {
  return el('footer', {},
    el('span', {}, el('kbd', {}, 'Alt+T'), ' ', t('ui.kisayol').replace(/^Alt\+T:\s*/, '')),
    el('span', {},
      durum.bilgi ? el('span', { role: 'status' }, durum.bilgi, ' ') : null,
      el('button', {
        onclick: async () => {
          await tarayici.runtime.sendMessage({ tip: 'onbellekTemizle' }).catch(() => {});
          durum.bilgi = t('ui.onbellekTemizlendi');
          ciz();
        },
      }, t('ui.onbellek'))));
}

function ciz() {
  document.documentElement.lang = durum.a.arayuzDili;
  const bolumler = [
    el('h1', {}, cevir(durum.a.arayuzDili, 'ui.baslik')),
    izinBolumu(),
    siteBolumu(),
    motorBolumu(),
    dilBolumu(),
    siteListesi(),
    altBilgi(),
  ];
  // Gösterilmeyen bölümler null; replaceChildren onları "null" yazısı yapardı.
  kok.replaceChildren(...bolumler.filter(Boolean));
}

async function baslat() {
  durum.a = await depo.oku();
  [durum.sekme] = await tarayici.tabs.query({ active: true, currentWindow: true });
  durum.izin = await siteIzniVarMi();
  ciz();
  await cevirmenDurumunuOku();
  ciz();
}

baslat();
