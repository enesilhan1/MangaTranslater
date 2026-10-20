# Geliştirme aşamaları

Her aşama birden çok küçük commit'e bölünür; her commit'ten sonra push edilir.

| Aşama | İçerik | Durum |
|---|---|---|
| 0 | Repo, SPEC, manifest/paket iskeleti, test altyapısı | ✅ |
| 1 | Görsel YZ katmanı: Gemini/Claude/ChatGPT istemcileri, çeviri istemi, yanıtın (kutular + çeviriler) ayrıştırılması, testler | ✅ |
| 2 | Yerel motor: Tesseract.js (Chrome'da offscreen belge, Firefox'ta arka plan sayfası), kelimeleri balonlara gruplama, Chrome yerleşik çevirmeni + MyMemory istemcileri, testler | ✅ |
| 3 | İçerik betiği: resim bulma, resmin baytlarını alma, küçültme/şerit bölme, öncelikli sıra + önceden çevirme, önbellek (IndexedDB) | ✅ |
| 4 | Görünüm: balonların üstüne çeviri katmanı, yazıyı sığdırma, kısayolla orijinal ↔ çeviri, durum/hata göstergeleri | ✅ |
| 5 | Açılır pencere: site listesi, motor/sağlayıcı/model/anahtar, hedef dil, arayüz dili, önbelleği temizleme; site listesine göre içerik betiğini kaydetme | ✅ |
| 6 | Firefox, paketleme, README/kurulum rehberi, MangaDex üzerinde gerçek tarayıcı doğrulaması, sürüm 1.0.0 | ✅ |

## Notlar
- Hata metinleri (TR/EN) Aşama 4'te src/dil.js'e yazıldı; test, koddaki her
  `hata.*` anahtarının metni olduğunu denetliyor. Açılır pencere metinleri
  de aynı dosyada; test popup.js'teki her ui anahtarını denetliyor.
- Sağlayıcılar yalnızca sahte fetch ile test edildi; gerçek API'lerle
  deneme Aşama 6'da (API anahtarı gerekir).
- Yerel motor Node'da gerçek Tesseract ile üretilmiş bir test sayfasında
  denendi (üç balon doğru, çizgi gürültüsü tamamen ayıklandı, ~1,5 sn).
  Aşama 6'da gerçek Chrome 155'te de doğrulandı (aşağıda).
- Bilinen sınır: çizimin üstüne yazılmış ses efektlerini yerel OCR
  okuyamıyor; görsel YZ modu bunları da çeviriyor.
- Aşama 3'ün tarayıcıya bağlı kısımları (IntersectionObserver/
  MutationObserver akışı, OffscreenCanvas dilimleme, IndexedDB önbellek,
  içerik betiğinin dinamik modül yüklemesi) Node'da test edilemiyor;
  saf mantık (öncelik kuyruğu, dilim planı, aday süzgeci, önbellek,
  mesajlar) test edildi. İçerik betiği kaydı Aşama 5'te yapıldı;
  gerçek sitede deneme Aşama 6'da.
- Şimdilik yalnızca <img> resimleri destekleniyor; resmi <canvas>'a
  çizen okuyucular sonraya.
- Görünüm katmanı test/onizleme.html'de gerçek tarayıcıda denendi (kaydırma
  takibi, yazı sığdırma, Alt+T, hata/çevriliyor işaretleri). Gerçek bir manga
  sitesinde eklenti olarak denenmesi Aşama 5'ten sonra.
- Açılır pencere test/popup_onizleme.html'de (gerçek tarayıcı, sahte eklenti
  API'si) denendi. Bu sırada bulunan: gömülü Chromium'da
  Translator.availability() hiç dönmüyor → 3 sn zaman aşımı eklendi.

## Sürüm 1.0.0 doğrulaması (Aşama 6)
- Gerçek Chrome 155, geçici profil, CDP ile paketlenmemiş yükleme (paketin
  kendisi): deneme sayfasında ve MangaDex'te (blob: resimler, sağ okla sayfa
  değiştirme) yerel motor uçtan uca çalıştı: kendiliğinden yükleme, offscreen
  OCR, Chrome çevirmeni (gerçek tıklamayla hazırlandı), balon üstü çizim,
  önbellek, Alt+T, SPA'da sayfa değişince eski çevirilerin kalkması.
- Firefox: web-ext lint 0 hata (uyarılar: Firefox'un tanımadığı offscreen
  izni ve service_worker alanı — beklenen; Tesseract'taki Function yapıcısı
  yalnızca eski ortam yedeği, çalışmıyor). Gerçek Firefox'ta henüz denenmedi.
- Görsel YZ sağlayıcıları gerçek API anahtarıyla henüz denenmedi.
- MangaDex'te görülen yerel motor zayıflıkları: çeviri grubu künye
  sayfasında süslü yazıdan büyük tek kelimelik kutu çıktı; stilize afiş
  yazısı okunmadı. Hikâye sayfalarında anlatım kutuları ve balonlar doğru.

## Sürüm 1.1.0 (2026-10-20): kullanıcının Claude denemesinden sonra
Sorunlar (MangaDex, görsel YZ + Claude): yazı çok büyük ve kelimeler
ortadan bölünüyordu; kutular balonlara oturmuyor, komşu panele düşüyordu;
ses efekti çevirisi paneli kapatıyordu.
- Yazı sığdırma: kelime içinden kırma kapalı, punto orijinal yazının
  tahmini boyutuyla sınırlı (src/icerik/sigdir.js).
- İstem: metin türü (balon/anlatım/ses), sıkı yazı kutusu, resmin piksel
  boyutu.
- Kutu oturtma (src/kutu_oturtma.js): modelin kutusu ipucu; flood fill ile
  balonun içi, içindeki "delikler" ile yazı bulunup kutu oraya taşınıyor.
  Kullanıcının gönderdiği sayfada denendi: kaydırılmış 6 kutunun 6'sı doğru
  balona oturdu, 15 ms.
- Ses efektleri küçük etiket.
- Henüz: gerçek Claude anahtarıyla uçtan uca deneme kullanıcıda.
