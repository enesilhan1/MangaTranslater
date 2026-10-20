// Sayfadaki resmin baytlarını alır ve gönderilecek dilimlere ayırır
// (docs/SPEC.md §5, §6). İçerik betiğinde çalışır.

import { base64tenBayt, bayttanBase64 } from '../base64.js';
import { dilimleriPlanla, satirSkoru } from '../dilimleme.js';
import { YzHatasi } from '../yz/ortak.js';
import { arkaPlanaGonder } from './mesaj.js';

/** Dilimler bu kalitede JPEG olarak gönderilir (PNG'ye göre çok daha küçük). */
const JPEG_KALITESI = 0.85;
/** Kesim yeri aramak için resmin küçültüldüğü genişlik (hız için). */
const ANALIZ_GENISLIGI = 64;

/**
 * Resmin baytları. blob:/data: ve aynı kökenli adresler doğrudan okunur
 * (MangaDex resimleri blob: adresinde). Başka alan adındaki resimler CORS
 * yüzünden içerik betiğinden çoğunlukla okunamaz; arka plan indirir, o da
 * olmazsa (ör. CDN yalnızca sayfanın Referer'ını kabul ediyorsa) CORS'a
 * izin veren CDN'ler için doğrudan bir kez daha denenir.
 * @param {HTMLImageElement} img
 * @returns {Promise<Blob>}
 */
export async function resimBaytlari(img) {
  const adres = img.currentSrc || img.src;
  const yerel = adres.startsWith('blob:') || adres.startsWith('data:') ||
    new URL(adres, location.href).origin === location.origin;
  if (yerel) return (await fetch(adres)).blob();

  try {
    const { veri, tur } = await arkaPlanaGonder({ tip: 'resimGetir', adres });
    return new Blob([base64tenBayt(veri)], { type: tur });
  } catch (arkaPlanHatasi) {
    try {
      const y = await fetch(adres, { mode: 'cors', credentials: 'omit' });
      if (y.ok) return await y.blob();
    } catch {
      // arka planın hatası bildirilir
    }
    throw arkaPlanHatasi;
  }
}

/**
 * @typedef {{veri: string, tur: string, genislik: number, yukseklik: number,
 *   y0: number, y1: number}} Dilim
 *   Base64 JPEG + gönderilen resmin piksel boyutu + dilimin özgün resimdeki
 *   dikey aralığı (piksel).
 */

/**
 * @param {Blob} blob
 * @returns {Promise<{dilimler: Dilim[], genislik: number, yukseklik: number}>}
 */
export async function dilimlereAyir(blob) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new YzHatasi('hata.resimAlinamadi', { mesaj: 'çözülemedi' });
  }
  const { width: genislik, height: yukseklik } = bitmap;
  try {
    const skorlar = yukseklik > genislik * 2 ? satirSkorlari(bitmap) : null;
    const { olcek, dilimler } = dilimleriPlanla(genislik, yukseklik, skorlar);
    const sonuc = [];
    for (const d of dilimler) {
      const g = Math.round(genislik * olcek);
      const h = Math.max(1, Math.round((d.y1 - d.y0) * olcek));
      const tuval = new OffscreenCanvas(g, h);
      const ctx = tuval.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Saydam PNG'lerde JPEG siyah zemin vermesin.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, g, h);
      ctx.drawImage(bitmap, 0, d.y0, genislik, d.y1 - d.y0, 0, 0, g, h);
      const jpeg = await tuval.convertToBlob({ type: 'image/jpeg', quality: JPEG_KALITESI });
      sonuc.push({ veri: bayttanBase64(await jpeg.arrayBuffer()), tur: 'image/jpeg', genislik: g, yukseklik: h, y0: d.y0, y1: d.y1 });
    }
    return { dilimler: sonuc, genislik, yukseklik };
  } finally {
    bitmap.close();
  }
}

/** Uzun resmi dar bir tuvale çizip her satırın tek düzelik skorunu çıkarır. */
function satirSkorlari(bitmap) {
  const h = Math.max(1, Math.round((bitmap.height * ANALIZ_GENISLIGI) / bitmap.width));
  const tuval = new OffscreenCanvas(ANALIZ_GENISLIGI, h);
  const ctx = tuval.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, ANALIZ_GENISLIGI, h);
  const { data } = ctx.getImageData(0, 0, ANALIZ_GENISLIGI, h);
  const satir = ANALIZ_GENISLIGI * 4;
  return Array.from({ length: h }, (_, y) => satirSkoru(data.subarray(y * satir, (y + 1) * satir)));
}
