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
Resim bir görsel modele gönderilir; model balonları bulur, yazıyı okur ve
bağlama uygun çevirir. Tek istekte konum + orijinal + çeviri döner.
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
- Sonuçlar resmin içeriğine (özet/hash) göre **önbellekte** tutulur; aynı
  resim tekrar açıldığında anında gösterilir. Önbellek boyutu sınırlıdır,
  en eski kayıtlar silinir. Önbellek motor + model + hedef dile özeldir.

## 7. Görünüm
- Çeviri **balonun üstüne yazılır**: orijinal yazının üstüne beyaz kutu
  konup çeviri sığacak yazı boyutuyla içine yazılır. Resmin kendisi
  değiştirilmez (üstünde ayrı bir katman).
- Yazı orijinal yazıdan belirgin şekilde büyük olmaz; kelimeler ortadan
  bölünmez (sığmıyorsa punto küçülür).
- Modelin verdiği kutu yalnızca ipucudur; kutu, resimdeki gerçek balonun
  içindeki yazıya oturtulur (balonun dışına, komşu panele taşmaz). Aynı
  balona düşen yinelenen kayıtlar birleştirilir.
- **Ses efektleri** çizimi kapatmamak için beyaz kutuyla değil, efektin
  köşesinde küçük, yarı saydam bir etiketle gösterilir (2026-10-20,
  kullanıcının Claude denemesinden sonra).
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
