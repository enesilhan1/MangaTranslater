# Geliştirme aşamaları

Her aşama birden çok küçük commit'e bölünür; her commit'ten sonra push edilir.

| Aşama | İçerik | Durum |
|---|---|---|
| 0 | Repo, SPEC, manifest/paket iskeleti, test altyapısı | ✅ |
| 1 | Görsel YZ katmanı: Gemini/Claude/ChatGPT istemcileri, çeviri istemi, yanıtın (kutular + çeviriler) ayrıştırılması, testler | ✅ |
| 2 | Yerel motor: Tesseract.js (Chrome'da offscreen belge, Firefox'ta arka plan sayfası), kelimeleri balonlara gruplama, Chrome yerleşik çevirmeni + MyMemory istemcileri, testler | ⏳ |
| 3 | İçerik betiği: resim bulma, resmin baytlarını alma, küçültme/şerit bölme, öncelikli sıra + önceden çevirme, önbellek (IndexedDB) | ⏳ |
| 4 | Görünüm: balonların üstüne çeviri katmanı, yazıyı sığdırma, kısayolla orijinal ↔ çeviri, durum/hata göstergeleri | ⏳ |
| 5 | Açılır pencere: site listesi, motor/sağlayıcı/model/anahtar, hedef dil, arayüz dili, önbelleği temizleme; site listesine göre içerik betiğini kaydetme | ⏳ |
| 6 | Firefox, paketleme, README/kurulum rehberi, MangaDex üzerinde gerçek tarayıcı doğrulaması, sürüm 1.0.0 | ⏳ |

## Notlar
- Aşama 1'deki hata anahtarlarının (`hata.ret`, `hata.uzunluk`,
  `hata.kota.gemini`, `hata.bakiye.*` ve http_istegi.js'tekiler) iki dilde
  metinleri Aşama 5'te arayüz diliyle birlikte yazılacak.
- Sağlayıcılar yalnızca sahte fetch ile test edildi; gerçek API'lerle
  deneme Aşama 6'da (API anahtarı gerekir).
