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
 */

const TURLER = ['balon', 'anlatim', 'ses'];
/** Elle yazılan modeller İngilizce ad verebilir. */
const TUR_ESLERI = { bubble: 'balon', speech: 'balon', narration: 'anlatim', caption: 'anlatim', sign: 'anlatim', sfx: 'ses', sound: 'ses' };

/**
 * @param {string} metin  Modelin yanıt metni.
 * @param {string} saglayiciAdi  Hata mesajı için.
 * @returns {Balon[]}
 */
export function balonlariCoz(metin, saglayiciAdi) {
  const j = jsonBul(metin);
  const liste = Array.isArray(j) ? j : j?.balonlar;
  if (!Array.isArray(liste)) throw new YzHatasi('hata.bozukYanit', { ad: saglayiciAdi });

  const adaylar = liste
    .map((b) => ({
      // Gemini'nin yerleşik adı box_2d de kabul edilir.
      kutu: Array.isArray(b?.kutu ?? b?.box_2d) ? (b.kutu ?? b.box_2d).map(Number) : [],
      tur: turAl(b?.tur),
      orijinal: metinAl(b?.orijinal),
      ceviri: metinAl(b?.ceviri),
    }))
    .filter((b) => b.kutu.length === 4 && b.kutu.every(Number.isFinite) && (b.ceviri || b.orijinal));

  // Bütün değerler 1'i geçmiyorsa model 0-1 ölçeği kullanmış demektir.
  const olcek = adaylar.every((b) => b.kutu.every((v) => v <= 1)) ? 1 : 1000;

  const balonlar = [];
  for (const b of adaylar) {
    const [y1, x1, y2, x2] = b.kutu.map((v) => sinirla(v / olcek));
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const g = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (g < 0.005 || h < 0.003) continue; // görünmeyecek kadar küçük
    balonlar.push({ x, y, g, h, tur: b.tur, orijinal: b.orijinal, ceviri: b.ceviri || b.orijinal });
  }
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
