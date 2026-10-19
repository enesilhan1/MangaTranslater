// Arka plan (Chrome'da service worker, Firefox'ta arka plan sayfası).
// Çeviri istekleri, önbellek ve site listesi sonraki aşamalarda buraya
// bağlanacak (docs/ASAMALAR.md).

import { tarayici } from './tarayici.js';

tarayici.runtime.onInstalled.addListener(() => {});
