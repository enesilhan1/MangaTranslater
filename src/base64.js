// Bayt ↔ base64 dönüşümü. Resim verisi mesajlarla taşınırken (Chrome
// mesajları yalnızca JSON taşıyor) ve API isteklerinde base64 kullanılır.

/** Büyük dizilerde String.fromCharCode'un argüman sınırına takılmamak için. */
const PARCA = 0x8000;

/** @param {ArrayBuffer | Uint8Array} veri */
export function bayttanBase64(veri) {
  const b = veri instanceof Uint8Array ? veri : new Uint8Array(veri);
  let ikili = '';
  for (let i = 0; i < b.length; i += PARCA) ikili += String.fromCharCode(...b.subarray(i, i + PARCA));
  return btoa(ikili);
}

/** @returns {Uint8Array} */
export function base64tenBayt(metin) {
  const ikili = atob(metin);
  const b = new Uint8Array(ikili.length);
  for (let i = 0; i < ikili.length; i++) b[i] = ikili.charCodeAt(i);
  return b;
}
