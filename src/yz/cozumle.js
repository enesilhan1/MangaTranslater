// Görsel modelin yanıt metnini balon listesine çevirir. Yapılandırılmış
// çıktı açıkken yanıt şemaya uyar; yine de elle yazılan modeller ya da
// eski modeller kod bloğu içinde, fazladan açıklamayla veya 0-1 ölçeğinde
// kutularla yanıt verebildiği için hoşgörülü okunur.

import { YzHatasi } from './ortak.js';

/**
 * @typedef {Object} Balon
 * @property {number} x  Sol kenar, resim genişliğine oranla (0-1).
 * @property {number} y  Üst kenar, resim yüksekliğine oranla (0-1).
 * @property {number} g  Genişlik (0-1).
 * @property {number} h  Yükseklik (0-1).
 * @property {string} orijinal
 * @property {string} ceviri
 * @property {'balon'|'anlatim'|'ses'} tur  Ses efektleri çizimi kapatmadan etiketle gösterilir.
 * @property {number} bolge  Modelin söylediği işaret numarası (0: işaretsiz).
 * @property {boolean} [kutusuz]  Model geçerli kutu vermedi; yalnızca numarasıyla
 *   bir balona oturabilir, oturamazsa gösterilmez.
 */

const TURLER = ['balon', 'anlatim', 'ses'];
/** Elle yazılan modeller İngilizce ad verebilir. */
const TUR_ESLERI = { bubble: 'balon', speech: 'balon', narration: 'anlatim', caption: 'anlatim', sign: 'anlatim', sfx: 'ses', sound: 'ses' };

/**
 * @param {string} metin  Modelin yanıt metni.
 * @param {string} saglayiciAdi  Hata mesajı için.
 * @param {{ham?: number, atlanan?: number}} [istatistik]  Doldurulur: modelin
 *   döndürdüğü kayıt sayısı ve kullanılamayıp atılanlar (konsol izi için).
 * @returns {Balon[]}
 */
export function balonlariCoz(metin, saglayiciAdi, istatistik = {}) {
  const j = jsonBul(metin);
  const liste = Array.isArray(j) ? j : j?.balonlar;
  if (!Array.isArray(liste)) throw new YzHatasi('hata.bozukYanit', { ad: saglayiciAdi });

  const adaylar = liste
    .map((b) => ({
      // Gemini'nin yerleşik adı box_2d de kabul edilir.
      kutu: Array.isArray(b?.kutu ?? b?.box_2d) ? (b.kutu ?? b.box_2d).map(Number) : [],
      tur: turAl(b?.tur),
      bolge: Number.isInteger(Number(b?.bolge)) && Number(b?.bolge) > 0 ? Number(b.bolge) : 0,
      orijinal: metinAl(b?.orijinal),
      ceviri: metinAl(b?.ceviri),
    }))
    .filter((b) => b.ceviri || b.orijinal);
  istatistik.ham = liste.length;
  const kutuluMu = (b) => b.kutu.length === 4 && b.kutu.every(Number.isFinite);

  // Bütün değerler 1'i geçmiyorsa model 0-1 ölçeği kullanmış demektir.
  const olcek = adaylar.filter(kutuluMu).every((b) => b.kutu.every((v) => v <= 1)) ? 1 : 1000;

  const balonlar = [];
  for (const b of adaylar) {
    const metinler = { tur: b.tur, bolge: b.bolge, orijinal: b.orijinal, ceviri: b.ceviri || b.orijinal };
    const [y1, x1, y2, x2] = kutuluMu(b) ? b.kutu.map((v) => sinirla(v / olcek)) : [0, 0, 0, 0];
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const g = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (g < 0.005 || h < 0.003) {
      // Görünmeyecek kadar küçük ya da bozuk kutu. Numaralıysa kutuya gerek
      // yok (yeri bulunan balondan gelir); numarasızsa gösterilecek yer yok.
      if (b.bolge) balonlar.push({ x: 0, y: 0, g: 0, h: 0, ...metinler, kutusuz: true });
      continue;
    }
    balonlar.push({ x, y, g, h, ...metinler });
  }
  istatistik.atlanan = istatistik.ham - balonlar.length;
  return balonlar;
}

/** Metindeki JSON'u bulur: önce olduğu gibi, sonra ilk { / [ ile son } / ] arası. */
function jsonBul(metin) {
  const m = String(metin ?? '').trim();
  try {
    return JSON.parse(m);
  } catch {
    // aşağıda aranır
  }
  for (const [ac, kapa] of [['{', '}'], ['[', ']']]) {
    const bas = m.indexOf(ac);
    const son = m.lastIndexOf(kapa);
    if (bas !== -1 && son > bas) {
      try {
        return JSON.parse(m.slice(bas, son + 1));
      } catch {
        // sıradaki biçim denenir
      }
    }
  }
  return null;
}

function turAl(v) {
  const t = String(v ?? '').toLowerCase().trim();
  return TURLER.includes(t) ? t : TUR_ESLERI[t] ?? 'balon';
}

function metinAl(v) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
}

function sinirla(v) {
  return Math.min(1, Math.max(0, v));
}
