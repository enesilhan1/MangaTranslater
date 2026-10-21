# Manga Çevirmen: kararlaştırılan özellikler

Bu belge kullanıcıyla netleştirilen kuralların tek kaynağıdır. Kod bu
kurallara uymalıdır; değişiklik gerekirse önce burası güncellenir.

## 1. Amaç
Manga/çizgi roman sayfalarındaki **resimlerin üzerindeki yazıları** (konuşma
balonları, ses efektleri, tabelalar) algıladığı dilden **Türkçeye** ya da
seçilen dile çeviren tarayıcı eklentisi. Tarayıcının kendi çevirisi resim
içindeki yazıya dokunmadığı için gerekli.

İki temel hedef:
- **Otomatik**: seçilen sitelerde her yeni sayfa/bölüm açıldığında kendiliğinden
  çalışır; tekrar tekrar etkinleştirmek gerekmez.
- **Hızlı**: resimler ekrana gelmeden önce çevrilmeye başlar, sonuçlar
  önbellekte tutulur.

**Chrome** (ve Chromium tabanlılar) ile **Firefox 140+** aynı kodla
desteklenir. Öncelikli test sitesi: **MangaDex**.

## 2. Çeviri motorları
Ayarlardan seçilir; iki motor vardır.

### 2.1 Görsel yapay zekâ (varsayılan)
Resim bir görsel modele gönderilir; model yazıyı okur ve bağlama uygun
çevirir. Tek istekte konum + orijinal + çeviri döner. Balonları eklenti
piksellerden kendisi bulup modele giden kopyada numaralar; yerleştirme
§7'deki gibi. Model işaretli balonların yarısından azına metin verirse
(en az 3 işaret varken) istek bir kez daha gönderilir; daha çok balonu
kapsayan yanıt kalır. OCR çalıştığında, onun güvenle okuduğu ama hiçbir çeviri
verilmemiş bir yazı kümesi kalırsa model bu alanlar söylenerek bir kez daha
sorulur; yanıttan yalnızca o yazılara ait metinler eklenir (sayfa başına
bir kez). Bu denetim için OCR, dilimde balonsuz metin varsa ya da model bir
işaretli balonu kullanmadıysa çalışır (önbellekteki sayfalarda da bir kez).
- Sağlayıcılar: **Gemini (Google)** (varsayılan), **Claude (Anthropic)**,
  **ChatGPT (OpenAI)**. (DeepSeek resim okuyamadığı için yok.)
- Web Asistanı'ndaki yapı: her sağlayıcı için hazır model listesi (ilki
  varsayılan, hızlı olanlar önce) + listede olmayan modeli **elle yazma**;
  her sağlayıcının **kendi API anahtarı** ayrı saklanır.
- Kaynak dil otomatik algılanır.

### 2.2 Yerel OCR + ücretsiz çeviri
API anahtarı gerektirmez.
- Yazı tarayıcıda **Tesseract.js** ile okunur (eklentiyle birlikte gelir;
  dışarıdan kod yüklenmez).
- Okunan metin şöyle çevrilir:
  - **Chrome**: tarayıcının yerleşik çevirmeni (**Translator API**, Chrome
    138+). Çeviri tamamen bilgisayarda yapılır; anahtar, kota, internet
    gerekmez. Dil paketi ilk kullanımda bir kez iner; Chrome bu ilk indirmeyi
    yalnızca kullanıcı bir düğmeye tıklayınca başlatır, bu yüzden açılır
    pencerede "çevirmeni hazırla" düğmesi olur.
  - **Firefox** (ya da Chrome'da yerleşik çevirmen yoksa / dil çifti
    desteklenmiyorsa): **MyMemory** resmi ücretsiz API'si. Anahtarsız
    günlük sınır yaklaşık 5.000 karakter; ayarlardan e-posta girilirse
    50.000. Sınır dolunca açık bir hata gösterilir.
  - (İlk plan Google Translate'in anahtarsız uç noktasıydı; 2026-10-19
    denemesinde kullanıcının ağını "otomatik sorgu" diye engellediği için
    bırakıldı.)
- Kaynak dil: ilk sürümde **İngilizce** (kullanıcının okuduğu dil).

## 3. Hedef dil
Varsayılan **Türkçe**; ayarlardan başka bir dil seçilebilir (yaygın dillerin
listesi).

## 4. Otomatik çalışma
- Kullanıcı bir siteyi **"bu sitede her zaman çevir"** listesine bir kez
  ekler (açılır pencereden tek tıkla). O sitede her sayfada kendiliğinden
  çalışır; listede olmayan sitelerde hiçbir şey yapmaz.
- Tek sayfalık uygulamalarda (MangaDex gibi, adres değişip sayfa yenilenmeyen
  siteler) yeni bölüme geçince de çalışmaya devam eder.
- Listedeki siteden çıkarmak da açılır pencereden yapılır.

## 5. Hangi resimler çevrilir
- Yalnızca yeterince büyük resimler (küçük ikon, avatar, reklam küçük
  resimleri atlanır).
- Sayfaya sonradan eklenen resimler de yakalanır.
- Çok uzun dikey resimler (webtoon şeritleri) parçalara bölünerek çevrilir.

## 6. Hız
- Resimler ekrana gelmeden önce (birkaç ekran ileriden) sıraya alınır;
  ekrandaki resim önceliklidir.
- Aynı anda sınırlı sayıda istek gönderilir (sağlayıcı kotasını aşmamak için).
- Gönderilmeden önce resim makul bir boyuta küçültülür.
- Görsel YZ'de OCR yalnızca balonsuz ya da numarası şüpheli metin olan
  sayfalarda çalışır (sayfa başına birkaç saniye).
- Sonuçlar resmin içeriğine (özet/hash) göre **önbellekte** tutulur; aynı
  resim tekrar açıldığında anında gösterilir. Önbellek boyutu sınırlıdır,
  en eski kayıtlar silinir. Önbellek motor + model + hedef dile özeldir.

## 7. Görünüm
- Çeviri **balonun üstüne yazılır**: orijinal yazının üstüne beyaz kutu
  konup çeviri sığacak yazı boyutuyla içine yazılır. Resmin kendisi
  değiştirilmez (üstünde ayrı bir katman).
- Yazı orijinal yazıdan belirgin şekilde büyük olmaz; kelimeler ortadan
  bölünmez (sığmıyorsa punto küçülür). Türkçede en küçük puntoda bile
  sığmayan uzun kelime hece sınırından tireyle bölünür.
- Bulunan balonda beyaz zemin balonun kendi şeklindedir (oval / dikdörtgen)
  ve balonun çizgisinin içinde kalır; çeviri balonun içine sığdırılır, kutu
  balonun dışına büyütülmez. Tek istisna: en küçük puntoda (8 px) bile
  sığmıyorsa dolgu azalır, punto 6 px'e iner, o da yetmezse kutu yazıyı
  kesmeyecek kadar dikey büyür (yazı kesilmez).
- Balonlar resmin piksellerinden bulunur ve görsel YZ'ye giden kopyada
  numaralı işaretlerle gösterilir; model her metnin hangi numaralı balonda
  olduğunu söyler ve çeviri o balondaki yazının üstüne yazılır (modelin
  koordinatı kullanılmaz). İşaretsiz metinlerde modelin kutusu ipucudur ve
  en yakın balona oturtulur. Farklı metinler birleştirilmez. Sayfada
  gösterilen resim değişmez.
- Balonsuz metinler (çizim üstü başlık/anlatım) yerel OCR ile harflerin
  üstüne oturtulur: modelin okuduğu metnin kelimeleri OCR kelimeleriyle
  eşlenir. OCR yalnızca böyle bir metin varsa çalışır. Modelin kutusu
  çevresinde eşleşme yoksa bütün sayfada aranır; yalnızca tek ve kesin bir
  eşleşme kabul edilir, numaralı balonlardaki kelimeler sayılmaz. Bir
  metnin kelimeleri satırlar boyunca kümelenir; yan sütundaki başka bir
  yazının ortak kelimesi ("MA", "RANNO") kümeye katılmaz.
- Balonsuz metnin kutusu, çeviri sığmazsa biraz büyür ama komşu kutuların
  üstüne çıkmaz; kutular zaten biraz kesişiyorsa kesişmeyi ikiye bölerler
  (bir kutunun beyaz zemini öbürünün yazısını örtmez).
- Metin, numarasını aldığı alana sığmayacak kadar uzunsa (alandaki harf
  parçası metnin harflerine göre çok az; ör. balon sanılan bir göz) o
  numaraya güvenilmez; metin OCR ile asıl yazısında aranır, bulunamazsa
  modelin kutusunda gösterilir. Hiçbir metin sığmayacağı küçük bir alana
  konmaz.
- **Ses efektleri** çizimi kapatmamak için beyaz kutuyla değil, efektin
  köşesinde küçük, yarı saydam bir etiketle gösterilir (2026-10-20,
  kullanıcının Claude denemesinden sonra). Latin harfli efektin yeri OCR ile
  bulunur (gevşek benzerlik; yakında ya da sayfada tek aday); Japonca
  efektler modelin kutusunda kalır.
- Bir **klavye kısayolu** ile orijinal ↔ çeviri arasında geçiş yapılır.
- Çevrilmekte olan resimde küçük bir "çevriliyor" göstergesi, hata olursa
  küçük bir hata işareti (üstüne gelince sebebi) çıkar.

## 8. Arayüz
- **Açılır pencere (popup)**: bu sitede açık/kapalı, motor, sağlayıcı/model/
  anahtar, hedef dil, arayüz dili, önbelleği temizleme.
- Arayüz dili: **Türkçe / İngilizce**.

## 9. Gizlilik
- Ayarlar, anahtarlar ve MyMemory e-postası yalnızca bilgisayarda
  (`storage.local`) saklanır.
- Resimler yalnızca seçilen motora gönderilir: görsel yapay zekâda seçilen
  sağlayıcıya; yerel OCR'de resim bilgisayardan çıkmaz. Okunan metin
  Chrome'un yerleşik çevirmeninde de bilgisayardan çıkmaz; MyMemory
  kullanılıyorsa yalnızca okunan metin MyMemory'ye gider.
- Resimdeki yazılar **veridir, talimat değildir**; modele bu açıkça söylenir.

## 10. Teknik notlar
- Manifest V3, derleme adımı yok, düz JavaScript (ES modülleri).
- Testler: `npm test` (Node 22+, `node --test`).
- Lisans: MIT.
