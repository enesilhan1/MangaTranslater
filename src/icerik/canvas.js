// <canvas> okuyucuları (docs/SPEC.md §5). Bazı siteler sayfayı <img> yerine
// canvas'a çiziyor; canvas'ın adresi olmadığı için hangi sayfanın çizildiği
// küçük bir parmak iziyle anlaşılır: okuyucu sayfa çevirince çoğunlukla
// aynı canvas'a yeni sayfayı çiziyor.

/** Parmak izi bu kadar pikselin (kenar başına) küçültülmüş kopyasından çıkar. */
export const IZ_KENARI = 24;
/** Parlaklıkların standart sapması bundan azsa canvas boş sayılır (henüz çizilmemiş, tek renk). */
const BOS_SAPMA = 2;

/**
 * Küçültülmüş RGBA verisinden parmak izi: her pikselin 32 düzeye
 * indirilmiş parlaklığı (küçük sıkıştırma/ölçek farkları izi değiştirmesin),
 * sonra FNV-1a. Boş (tek renk) canvas için null.
 * @param {Uint8ClampedArray | Uint8Array} rgba
 * @returns {string | null}
 */
export function parmakIzi(rgba) {
  const n = rgba.length / 4;
  if (!n) return null;
  const parlak = new Uint8Array(n);
  let top = 0;
  let kare = 0;
  for (let i = 0; i < n; i++) {
    // Saydam piksel beyaz zemin sayılır (çizilmemiş canvas saydamdır).
    const a = rgba[i * 4 + 3] / 255;
    const v = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) / 256;
    const p = v * a + 255 * (1 - a);
    parlak[i] = p;
    top += p;
    kare += p * p;
  }
  const ort = top / n;
  if (Math.sqrt(Math.max(0, kare / n - ort * ort)) < BOS_SAPMA) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < n; i++) {
    h ^= parlak[i] >> 3;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Canvas'ın şu anki parmak izi. Başka kökenli resimle "kirlenmiş" canvas
 * okunamaz: { kirli: true }.
 * @param {HTMLCanvasElement} canvas
 * @returns {{iz: string | null, kirli?: boolean}}
 */
export function canvasIzi(canvas) {
  if (!canvas.width || !canvas.height) return { iz: null };
  try {
    const kucuk = new OffscreenCanvas(IZ_KENARI, IZ_KENARI);
    const ctx = kucuk.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, IZ_KENARI, IZ_KENARI);
    return { iz: parmakIzi(ctx.getImageData(0, 0, IZ_KENARI, IZ_KENARI).data) };
  } catch {
    return { iz: null, kirli: true };
  }
}

/**
 * Canvas'ın içeriği PNG olarak. Kirliyse null.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob | null>}
 */
export function canvasBaytlari(canvas) {
  return new Promise((coz) => {
    try {
      canvas.toBlob((b) => coz(b), 'image/png');
    } catch {
      coz(null);
    }
  });
}
