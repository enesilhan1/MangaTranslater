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

## Sürüm 1.2.0 (2026-10-20): balonlar piksellerden, model numarayla eşler
1.1.0 denemesinde (Claude) oturtma yetmedi: bir çeviri çizimdeki beyaz bir
alana oturup paneli kapattı, "UAH" yanlış balona oturup birleşti, bazı
balonlar çevrilmedi.
- balonlariBul (src/kutu_oturtma.js): kapalı beyaz bölgeler + şekil
  denetimi (doluluk, yazı benzeri delik parçaları, kenar boşluğu, boyut).
  Kullanıcının iki sayfasında gerçek 6 balonun 6'sı, çizim alanı ve enkaz
  parçası elendi.
- Numaralı işaretler (src/isaretler.js) modele giden kopyada; istem/şema
  'bolge'; numaralı metin doğrudan bulunan balona yerleşir.
- Farklı metinler artık birleşmez; numarasız oturtma daha sıkı.
- Henüz: gerçek Claude anahtarıyla uçtan uca deneme kullanıcıda.

## Sürüm 1.2.1 (2026-10-20)
1.2.0 denemesi çok daha iyiydi ama Claude iki farklı balonun metnine aynı
numarayı verdi; iki çeviri tek balonda birleşti, bir balon çevrilmedi.
- İşaret balonun içine, yazıya bitişik (köşede balonun dışında kalıyor,
  komşu balonla karışıyordu).
- Aynı numara iki farklı metne: kutusu balona yakın olan kalır, diğeri en
  uygun boş balona; yalnızca model tek balonu ikiye bölmüşse birleşir.
- Numarasız oturtmada bölge sınırı 10x tahmin (doğru balon "fazla büyük"
  diye reddediliyordu); çizim alanlarını şekil denetimi eliyor.
- Kullanıcının sayfasında: sayfadaki hata durumu iki ayrı doğru balona
  yerleşiyor; kayık 6 numarasız tahminin 6'sı doğru balona.

## Sürüm 1.3.0 (2026-10-20)
1.2.1'de çeviriler doğru ve yerindeydi; kullanıcının tek isteği yazıların
balonlardan taşmamasıydı.
- Bulunan balonun iç kutusu ve şekli (oval/dikdörtgen) sonuca ekleniyor.
- Beyaz zemin balonun şeklinde ve içinde; yazı ovalin içine sığan alana
  (her yandan %14,5 dolgu) sığdırılıyor, kutu büyütülmüyor; orijinal
  yazının üstüne ayrıca sınırında beyaz örtü (düz kesilmiş balonlarda
  kalıntı kalmasın).
- Kullanıcının sayfasıyla yerel önizlemede doğrulandı.

## Sürüm 1.4.0 (2026-10-20)
1.3.0 denemesinde (Claude Haiku 5.5) uzun kuyruklu ve sivri uçlu balonlar
bulunamadı; çevirileri yanlış yere düştü. Bir sayfa hiç çevrilmedi (sebebi
araştırılıyor; o sayfada balon bulma çalışıyor).
- Aşınmış maskeyle gövde kutusu: kuyruk/uçlar şekil ölçümüne girmiyor;
  flood fill asıl beyazda (dar balon bölünmüyor).
- Yeni ayırt ediciler: harf boyu tutarlılığı, tram dokusu.
- Kullanıcının 7 sayfasında yalnızca gerçek balonlar bulunuyor.

## Sürüm 1.4.1 (2026-10-20)
Çevrilmeyen sayfanın köşesinde hiçbir işaret yoktu. Olası sebepler
düzeltildi: "geri" önbelleğinden dönen sayfada yarıda iptal edilen resimler
yeniden deneniyor; boş sonuç önbelleğe yazılmıyor (eski boş kayıtlar yok
sayılıyor); her resmin sonucu konsola yazılıyor (F12 → Console →
"Manga"). Sebep kesinleşmedi; kullanıcıdan konsol çıktısı istenecek.

## Sürüm 1.5.0 (2026-10-20)
Yeni sayfada panel kenarına yapışık birleşik beyaz alandaki iki uzun metin
çevrilmedi (bölge "kenarda yazı" diye eleniyordu, iki metin tek bölgedeydi).
- Kenar boşluğu %1; bölgedeki belirgin ayrı yazı blokları ayrı balon
  (ayrı işaret numarası, kendi kutusunda zemin).
- Kullanıcının 8 sayfasında: yeni sayfa 7/7, bir balonu kaçıran sayfa 6/6,
  eski sayfalar değişmedi; yanlış bulgu yok.

## Sürüm 1.6.0 (2026-10-20)
Balonlar kusursuzdu; balonsuz üç satırlık bir başlıkta modelin kutusu
yalnızca ilk satırı kapsıyordu.
- src/ocr_oturtma.js: model metninin kelimeleri OCR kelimeleriyle eşlenip
  kutu kelimelerin üstüne taşınıyor (uzun kelimelerde güvene bakılmaz).
- Köprüye yalnızca OCR isteği; çevirici bunu yalnızca numarasız, ses
  efekti olmayan metin varsa çağırıyor.
- Kullanıcının sayfasında gerçek Tesseract ile: başlığın üç satırı da
  kapsandı.

## Sürüm 1.6.1 (2026-10-20)
1.6.0 denemesinde başlık sayfası değişmemişti (sonuç eski sürümle
önbelleğe yazılmıştı) ve İtalyanca sayfadaki balonsuz anlatımların ilk/son
satırları açıkta kalıyordu.
- Önbellekten gelen eski sonuçlar da OCR ile bir kez düzeltiliyor.
- Eksik ilk/son satırlar hedefli olarak ekleniyor (eksik kelimeye benzeyen
  satır).
- Gerçek Tesseract ile: İtalyanca sayfada 4/4 anlatım tamamen kapsanıyor,
  taşma yok; başlık sayfasında 3 satır.

## Sürüm 1.7.0 (2026-10-20)
Rusça sayfada: model dar bir balonun metnine numara vermeyip kutusunu
panelin ortasına koydu; dar kutuda uzun Türkçe kelime ortadan kırıldı; tek
lekeli küçük bir alan balon sayıldı. Ayrıca bir çeviri anlamca yanlıştı
("en zayıf" → "en güçlü"): bu modelin (Haiku) hatası, yerleşimle ilgisiz.
- Sahipsiz balon + yersiz metin eşleştirmesi (uzaklık ve harf/parça uyumu
  sınırlı).
- Tek parçalı yazı balon değil.
- Türkçe heceleme (yumuşak tire), yalnızca kelime sığmazsa.
- 9 sayfa yeniden denetlendi: yalnızca gerçek balonlar.

## Sürüm 1.7.1 (2026-10-20)
Sonnet 5.5 ile çeviri kalitesi düzeldi ("en zayıf sınıf"). Dar dikey bir
balonun çevirisi yine yanlış yere düştü: işaret o balonun ilk satırının
üstüne çiziliyordu (çizgiye değen harfler yazı kutusunun dışında
kalıyordu). İşaret yeri artık piksellerden, hiçbir harfe değmeyen beyaz bir
noktadan seçiliyor. Bilinen küçük kusur: bazı sayfalarda çizimde 1-2 yanlış
bulgu işaret alabiliyor (Sonnet onlara metin atamıyor).
