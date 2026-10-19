// Çevrilebilecek hedef diller (docs/SPEC.md §3). `ingilizce` modele giden
// istemde kullanılır; `ad` arayüzde gösterilir. `kod` MyMemory'nin kabul ettiği
// ISO/RFC 3066 kodu; Chrome yerleşik çevirmeni için farklı olanlar
// metin_cevirmenleri.js'te eşlenir (zh-CN → zh).

export const HEDEF_DILLER = [
  { kod: 'tr', ingilizce: 'Turkish', ad: { tr: 'Türkçe', en: 'Turkish' } },
  { kod: 'en', ingilizce: 'English', ad: { tr: 'İngilizce', en: 'English' } },
  { kod: 'az', ingilizce: 'Azerbaijani', ad: { tr: 'Azerbaycan Türkçesi', en: 'Azerbaijani' } },
  { kod: 'de', ingilizce: 'German', ad: { tr: 'Almanca', en: 'German' } },
  { kod: 'fr', ingilizce: 'French', ad: { tr: 'Fransızca', en: 'French' } },
  { kod: 'es', ingilizce: 'Spanish', ad: { tr: 'İspanyolca', en: 'Spanish' } },
  { kod: 'it', ingilizce: 'Italian', ad: { tr: 'İtalyanca', en: 'Italian' } },
  { kod: 'pt', ingilizce: 'Portuguese', ad: { tr: 'Portekizce', en: 'Portuguese' } },
  { kod: 'nl', ingilizce: 'Dutch', ad: { tr: 'Felemenkçe', en: 'Dutch' } },
  { kod: 'pl', ingilizce: 'Polish', ad: { tr: 'Lehçe', en: 'Polish' } },
  { kod: 'ru', ingilizce: 'Russian', ad: { tr: 'Rusça', en: 'Russian' } },
  { kod: 'uk', ingilizce: 'Ukrainian', ad: { tr: 'Ukraynaca', en: 'Ukrainian' } },
  { kod: 'ar', ingilizce: 'Arabic', ad: { tr: 'Arapça', en: 'Arabic' } },
  { kod: 'fa', ingilizce: 'Persian', ad: { tr: 'Farsça', en: 'Persian' } },
  { kod: 'id', ingilizce: 'Indonesian', ad: { tr: 'Endonezce', en: 'Indonesian' } },
  { kod: 'vi', ingilizce: 'Vietnamese', ad: { tr: 'Vietnamca', en: 'Vietnamese' } },
  { kod: 'ja', ingilizce: 'Japanese', ad: { tr: 'Japonca', en: 'Japanese' } },
  { kod: 'ko', ingilizce: 'Korean', ad: { tr: 'Korece', en: 'Korean' } },
  { kod: 'zh-CN', ingilizce: 'Simplified Chinese', ad: { tr: 'Çince (Basitleştirilmiş)', en: 'Chinese (Simplified)' } },
];

export const VARSAYILAN_HEDEF_DIL = 'tr';

/** Koda göre dil; bilinmiyorsa Türkçe. */
export function dilBul(kod) {
  return HEDEF_DILLER.find((d) => d.kod === kod) ?? HEDEF_DILLER[0];
}
