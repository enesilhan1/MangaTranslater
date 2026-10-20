// Çevirilerin sayfada gösterimi (docs/SPEC.md §7): orijinal yazının üstüne
// beyaz kutu konup çeviri içine sığacak puntoyla yazılır. Resmin kendisine
// ve sitenin sayfa yapısına dokunulmaz:
// - Bütün çizimler sayfanın üstündeki tek, sabit konumlu bir katmanda ve
//   kapalı Shadow DOM içinde (sitenin CSS'i bozmasın, site de okuyamasın).
// - Katman tıklamaları geçirir (pointer-events: none): okuyucuda sayfaya
//   tıklayıp ilerlemek bozulmaz. Yalnızca hata işareti tıklanabilir.
// - Her resmin kabı resmin ekrandaki yerine taşınır; balonlar kabın içinde
//   yüzdeyle konumlanır, bu yüzden kaydırma/yakınlaştırmada yalnızca kap
//   güncellenir, balonlar yeniden hesaplanmaz.

import { cevir } from '../dil.js';
import { puntoBul, puntoTavani } from './sigdir.js';

/**
 * @typedef {Object} ResimDurumu
 * @property {string} kimlik
 * @property {'bekliyor'|'cevriliyor'|'tamam'|'hata'} durum
 * @property {import('../yz/cozumle.js').Balon[]} balonlar  Resme oranla; dilimler
 *   geldikçe artar.
 * @property {{anahtar: string, parametreler: object} | null} hata
 */

/** Çeviri sığmazsa kutu merkezinden bir kez bu oranda büyütülür. */
const BUYUTME = 1.3;
/** Yerleşim kayması (üstteki resim yüklenince) kaydırma olmadan da olur. */
const KONUM_DENETIM_MS = 500;

const STIL = `
:host { all: initial; }
.katman { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
.resim { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.balon {
  position: absolute; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
  /* Dolgu em ile: yüzde, balonun değil kabın (resmin) genişliğine göre
     hesaplanıp kutunun çoğunu yiyordu. Köşeler az yuvarlak: çok yuvarlak
     köşe metin kutusunun köşelerindeki orijinal harfleri açıkta bırakıyor. */
  padding: 0.15em 0.3em; overflow: hidden;
  background: #fff; color: #111; border-radius: 0.6em;
  box-shadow: 0 0 3px 4px #fff;
  font-family: "Comic Sans MS", "Comic Neue", "Chalkboard SE", "Segoe UI", system-ui, sans-serif;
  font-weight: 700; line-height: 1.12; text-align: center;
  /* Kelime ortadan bölünmez ("zorlanac / ağı" gibi): sığmıyorsa punto küçülür.
     Yalnızca en küçük puntoda bile tek kelime sığmıyorsa .kirilabilir. */
  overflow-wrap: normal; word-break: normal; hyphens: manual; white-space: normal;
}
.balon.kirilabilir { overflow-wrap: anywhere; }
/* Ses efekti: çizimi kapatmamak için beyaz kutu yerine efektin köşesinde
   küçük, yarı saydam etiket (kullanıcının seçimi). */
.ses-etiketi {
  position: absolute; box-sizing: border-box; max-width: 45%;
  padding: 1px 6px; border-radius: 4px;
  background: rgba(20, 20, 24, .72); color: #fff;
  font: 700 12px/1.25 "Segoe UI", system-ui, sans-serif;
  letter-spacing: .02em; white-space: normal; overflow-wrap: anywhere;
}
.orijinal .balon, .orijinal .ses-etiketi { display: none; }
.rozet {
  position: absolute; top: 8px; right: 8px; width: 24px; height: 24px;
  border-radius: 50%; box-sizing: border-box;
  font: 700 15px/24px system-ui, sans-serif; text-align: center; color: #fff;
}
.rozet.cevriliyor {
  border: 3px solid rgba(255,255,255,.35); border-top-color: #fff;
  background: rgba(0,0,0,.45); animation: don .8s linear infinite;
}
.rozet.hata { background: #d93025; pointer-events: auto; cursor: pointer; }
@keyframes don { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .rozet.cevriliyor { animation: none; } }
`;

export class Gorunum {
  /**
   * @param {{dil?: () => string, hedefDil?: () => string,
   *   tekrarDene?: (img: HTMLImageElement) => void}} [p]
   *   [dil] arayüz dili (hata metinleri), [hedefDil] çevirinin dili (heceleme).
   */
  constructor({ dil = () => 'tr', hedefDil = () => 'tr', tekrarDene = () => {} } = {}) {
    this.dil = dil;
    this.hedefDil = hedefDil;
    this.tekrarDene = tekrarDene;
    /** @type {Map<HTMLImageElement, {kap: HTMLElement, rozet: HTMLElement,
     *   cizilen: number, genislik: number, yukseklik: number}>} */
    this.resimler = new Map();
    this.orijinalGoster = false;
    this._kare = 0;
    this._denetim = 0;
    this.boyutGozcu = new ResizeObserver(() => this._konumla());
    this._kaydirma = () => this._konumla();
  }

  /** Katman ilk çizimde kurulur; çevrilecek resmi olmayan sayfada DOM'a hiç dokunulmaz. */
  _katman() {
    if (this.kok) return this.kok;
    this.ev = document.createElement('manga-cevirmen-katmani');
    const golge = this.ev.attachShadow({ mode: 'closed' });
    const stil = document.createElement('style');
    stil.textContent = STIL;
    this.kok = document.createElement('div');
    this.kok.className = 'katman';
    golge.append(stil, this.kok);
    // En üstte: sitenin en yüksek z-index'li öğesinin de üstünde.
    Object.assign(this.ev.style, { position: 'fixed', inset: '0', zIndex: '2147483646', pointerEvents: 'none' });
    document.documentElement.append(this.ev);
    addEventListener('scroll', this._kaydirma, { capture: true, passive: true });
    addEventListener('resize', this._kaydirma, { passive: true });
    return this.kok;
  }

  /** @param {HTMLImageElement} img @param {ResimDurumu} durum */
  guncelle(img, durum) {
    let r = this.resimler.get(img);
    if (!r) {
      const kap = document.createElement('div');
      kap.className = 'resim';
      const rozet = document.createElement('div');
      rozet.addEventListener('click', () => this.tekrarDene(img));
      kap.append(rozet);
      this._katman().append(kap);
      r = { kap, rozet, cizilen: 0, genislik: 0, yukseklik: 0 };
      this.resimler.set(img, r);
      this.boyutGozcu.observe(img);
      this._denetim ||= setInterval(() => this._konumla(), KONUM_DENETIM_MS);
    }

    // Yeni gelen balonlar (dilimler sırayla geldikçe) eklenir.
    for (const b of durum.balonlar.slice(r.cizilen)) r.kap.insertBefore(this._balon(b), r.rozet);
    const yeniBalon = durum.balonlar.length > r.cizilen;
    r.cizilen = durum.balonlar.length;

    r.rozet.className = `rozet ${durum.durum === 'cevriliyor' ? 'cevriliyor' : durum.durum === 'hata' ? 'hata' : ''}`;
    r.rozet.hidden = durum.durum !== 'cevriliyor' && durum.durum !== 'hata';
    if (durum.durum === 'hata') {
      r.rozet.textContent = '!';
      const dil = this.dil();
      r.rozet.title = `${cevir(dil, 'durum.hata')}: ${cevir(dil, durum.hata.anahtar, durum.hata.parametreler)}\n` +
        `(${cevir(dil, 'durum.tekrarDene')})`;
    } else {
      r.rozet.textContent = '';
      r.rozet.title = durum.durum === 'cevriliyor' ? cevir(this.dil(), 'durum.cevriliyor') : '';
    }

    this._konumla(yeniBalon ? img : null);
  }

  _balon(b) {
    if (b.tur === 'ses') return this._sesEtiketi(b);
    const el = document.createElement('div');
    el.className = 'balon';
    el.lang = this.hedefDil();
    el.textContent = b.ceviri;
    el.title = b.orijinal;
    el.dataset.kutu = JSON.stringify([b.x, b.y, b.g, b.h]);
    el.dataset.harf = String((b.orijinal || b.ceviri).length);
    this._kutuyaKoy(el, b.x, b.y, b.g, b.h);
    return el;
  }

  /** Ses efekti: sığdırılmaz, efektin sol üst köşesine küçük etiket. */
  _sesEtiketi(b) {
    const el = document.createElement('div');
    el.className = 'ses-etiketi';
    el.lang = this.hedefDil();
    el.textContent = b.ceviri;
    el.title = b.orijinal;
    Object.assign(el.style, { left: `${b.x * 100}%`, top: `${b.y * 100}%` });
    return el;
  }

  _kutuyaKoy(el, x, y, g, h) {
    Object.assign(el.style, { left: `${x * 100}%`, top: `${y * 100}%`, width: `${g * 100}%`, height: `${h * 100}%` });
  }

  /** Resim sayfadan kalktı ya da yeniden çevrilecek. */
  kaldir(img) {
    const r = this.resimler.get(img);
    if (!r) return;
    r.kap.remove();
    this.resimler.delete(img);
    this.boyutGozcu.unobserve(img);
    if (!this.resimler.size && this._denetim) {
      clearInterval(this._denetim);
      this._denetim = 0;
    }
  }

  /** Katmanı ve bütün dinleyicileri tamamen kaldırır (site kapatıldı). */
  yokEt() {
    for (const img of [...this.resimler.keys()]) this.kaldir(img);
    this.boyutGozcu.disconnect();
    if (this._kare) cancelAnimationFrame(this._kare);
    this._kare = 0;
    removeEventListener('scroll', this._kaydirma, { capture: true });
    removeEventListener('resize', this._kaydirma);
    this.ev?.remove();
    this.ev = null;
    this.kok = null;
  }

  /** Kısayol: orijinal ↔ çeviri. */
  gecis() {
    this.orijinalGoster = !this.orijinalGoster;
    this.kok?.classList.toggle('orijinal', this.orijinalGoster);
  }

  /**
   * Kapları resimlerin ekrandaki yerine taşır (bir sonraki karede, toplu).
   * Boyutu değişen ya da yeni balon gelen resimde yazılar yeniden sığdırılır.
   */
  _konumla(zorla = null) {
    if (zorla) this._yenidenSigdir = (this._yenidenSigdir ?? new Set()).add(zorla);
    if (this._kare) return;
    this._kare = requestAnimationFrame(() => {
      this._kare = 0;
      const zorlananlar = this._yenidenSigdir ?? new Set();
      this._yenidenSigdir = null;
      for (const [img, r] of this.resimler) {
        const k = img.getBoundingClientRect();
        const gorunur = k.width > 0 && k.height > 0 && img.isConnected && (img.checkVisibility?.() ?? true);
        r.kap.hidden = !gorunur;
        if (!gorunur) continue;
        r.kap.style.transform = `translate(${k.left}px, ${k.top}px)`;
        const boyutDegisti = Math.abs(k.width - r.genislik) > 1 || Math.abs(k.height - r.yukseklik) > 1;
        if (boyutDegisti) {
          r.kap.style.width = `${k.width}px`;
          r.kap.style.height = `${k.height}px`;
          r.genislik = k.width;
          r.yukseklik = k.height;
        }
        if (boyutDegisti || zorlananlar.has(img)) this._sigdir(r);
      }
    });
  }

  /** Kaptaki her balonun yazısını kutusuna sığdırır. */
  _sigdir(r) {
    for (const el of r.kap.querySelectorAll('.balon')) {
      const [x, y, g, h] = JSON.parse(el.dataset.kutu);
      const harf = Number(el.dataset.harf);
      el.classList.remove('kirilabilir');
      this._kutuyaKoy(el, x, y, g, h);
      const sigarMi = (p) => {
        el.style.fontSize = `${p}px`;
        return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
      };
      let p = puntoBul(sigarMi, undefined, puntoTavani(g * r.genislik, h * r.yukseklik, harf));
      if (!sigarMi(p)) {
        // Çeviri orijinalden uzun: kutuyu merkezinden büyüt (resmin içinde kalarak).
        const yg = Math.min(1, g * BUYUTME);
        const yh = Math.min(1, h * BUYUTME);
        const yx = Math.min(Math.max(0, x - (yg - g) / 2), 1 - yg);
        const yy = Math.min(Math.max(0, y - (yh - h) / 2), 1 - yh);
        this._kutuyaKoy(el, yx, yy, yg, yh);
        p = puntoBul(sigarMi, undefined, puntoTavani(yg * r.genislik, yh * r.yukseklik, harf));
      }
      // Son çare: tek bir kelime en küçük puntoda bile genişliğe sığmıyor.
      if (!sigarMi(p)) el.classList.add('kirilabilir');
      el.style.fontSize = `${p}px`;
    }
  }
}
