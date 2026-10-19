# Geliştirme aşamaları

Her aşama birden çok küçük commit'e bölünür; her commit'ten sonra push edilir.

| Aşama | İçerik | Durum |
|---|---|---|
| 0 | Repo, SPEC, manifest/paket iskeleti, test altyapısı | ✅ |
| 1 | Görsel YZ katmanı: Gemini/Claude/ChatGPT istemcileri, çeviri istemi, yanıtın (kutular + çeviriler) ayrıştırılması, testler | ⏳ |
| 2 | Yerel motor: Tesseract.js (Chrome'da offscreen belge, Firefox'ta arka plan sayfası), satırları balonlara gruplama, Google Translate istemcisi, testler | ⏳ |
| 3 | İçerik betiği: resim bulma, resmin baytlarını alma, küçültme/şerit bölme, öncelikli sıra + önceden çevirme, önbellek (IndexedDB) | ⏳ |
| 4 | Görünüm: balonların üstüne çeviri katmanı, yazıyı sığdırma, kısayolla orijinal ↔ çeviri, durum/hata göstergeleri | ⏳ |
| 5 | Açılır pencere: site listesi, motor/sağlayıcı/model/anahtar, hedef dil, arayüz dili, önbelleği temizleme; site listesine göre içerik betiğini kaydetme | ⏳ |
| 6 | Firefox, paketleme, README/kurulum rehberi, MangaDex üzerinde gerçek tarayıcı doğrulaması, sürüm 1.0.0 | ⏳ |
