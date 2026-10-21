# Manga Çevirmen

[![Testler](https://github.com/enesilhan1/MangaTranslator/actions/workflows/test.yml/badge.svg)](https://github.com/enesilhan1/MangaTranslator/actions/workflows/test.yml)

Manga, manhwa ve çizgi roman sayfalarındaki **resimlerin üzerindeki yazıları**
(konuşma balonları, anlatım kutuları, ses efektleri) Türkçeye ya da seçtiğin
dile çeviren tarayıcı eklentisi. Tarayıcının kendi çevirisi resimlerin içindeki
yazıya dokunmaz; bu eklenti tam olarak bunu yapar.

- **Otomatik:** Bir siteyi bir kez "her zaman çevir" listesine eklersin; o
  sitede her yeni bölümde ve sayfada kendiliğinden çalışır.
- **Hızlı:** Ekrandaki sayfa önce çevrilir, ilerideki sayfalar sen okurken
  hazırlanır. Çeviriler önbellekte tutulur; aynı sayfaya dönünce anında gelir.
- **Balonun üstüne yazar:** Kutular resimdeki gerçek balona oturtulur, orijinal
  yazının üstüne beyaz kutu konur ve çeviri orijinal boyutta içine sığdırılır.
  Siyah balonlardaki beyaz yazılar da bulunur; çevirileri koyu zeminle yazılır.
  Ses efektleri çizimi kapatmadan küçük bir etiketle gösterilir.
  <kbd>Alt</kbd>+<kbd>T</kbd> ile orijinali görürsün.
- **Chrome** (ve Edge, Brave gibi Chromium tabanlılar) ve **Firefox 140+**.

## İki çeviri motoru

| | Görsel yapay zekâ (varsayılan) | Yerel (anahtarsız) |
|---|---|---|
| Nasıl çalışır | Eklenti balonları resimden kendisi bulup numaralar; resim seçtiğin yapay zekâya gider, o da yazıları okuyup bağlama uygun çevirir. Balonsuz yazılar (çizim üstü başlıklar) bilgisayarındaki OCR ile yerine oturtulur | Yazı bilgisayarında Tesseract ile okunur, sonra çevrilir |
| Gereken | API anahtarı (Gemini, Claude ya da ChatGPT) | Hiçbir şey |
| Kalite | En iyisi; ses efektlerini, el yazısını, her kaynak dili okur | İyi basılmış İngilizce balonlarda iyi; süslü yazıda ve ses efektlerinde zayıf |
| Çeviri | Yapay zekâ | Chrome'da tarayıcının kendi çevirmeni (cihazda, ücretsiz); Firefox'ta MyMemory (ücretsiz, günlük sınırlı) |
| Ücret | Sağlayıcının fiyatı (Gemini'nin ücretsiz kotası var). Model bir sayfadaki balonların çoğunu ya da OCR'nin okuduğu bir yazıyı atlarsa o sayfa bir kez daha sorulur | Ücretsiz |

**Öneri:** En iyi sonuç için Gemini ile başla: <https://aistudio.google.com/apikey>
adresinden ücretsiz bir anahtar alıp eklentinin penceresine yapıştırman yeterli.

## Kurulum

### Chrome / Edge / Brave
1. Bu depoyu indir: **Code → Download ZIP** (ya da `git clone`) ve klasöre çıkar.
2. Adres çubuğuna `chrome://extensions` yaz.
3. Sağ üstten **Geliştirici modu**nu aç.
4. **Paketlenmemiş öğe yükle**'ye bas ve indirdiğin klasörü seç
   (`manifest.json` dosyasının bulunduğu klasör).
5. Eklenti simgesini araç çubuğuna sabitle (yapboz simgesi → iğne).

### Firefox
1. Depoyu indirip klasöre çıkar.
2. Adres çubuğuna `about:debugging#/runtime/this-firefox` yaz.
3. **Geçici Eklenti Yükle…** → klasördeki `manifest.json`'u seç.
4. Eklentinin penceresinde "sitelere erişim izni yok" uyarısı çıkarsa
   **İzin ver**'e bas (Firefox bu izni kullanıcıya bırakıyor).

Firefox geçici eklentileri tarayıcı kapanınca kaldırır. Kalıcı kurulum için
`npm run paketle` ile oluşan ZIP'in addons.mozilla.org üzerinden imzalanması
gerekir.

## Kullanım
1. Bir manga sitesinde (ör. MangaDex) bir bölüm aç.
2. Eklenti simgesine bas ve **"Bu sitede her zaman çevir"** anahtarını aç.
   Açık sayfa hemen çevrilmeye başlar; o sitedeki bundan sonraki bütün sayfalar
   da kendiliğinden çevrilir.
3. Motoru seç:
   - **Görsel yapay zekâ:** sağlayıcıyı ve modeli seç, API anahtarını yapıştır.
   - **Yerel:** Chrome'da ilk kullanımda **"Çevirmeni hazırla"**ya bas; Chrome
     dil paketini bir kez indirir. Firefox'ta istersen MyMemory için e-postanı
     gir (günlük ücretsiz sınır ~5.000'den ~50.000 karaktere çıkar).
4. Okurken:
   - Çevrilen resmin köşesinde dönen işaret: çeviri sürüyor.
   - Kırmızı **!**: çevrilemedi; üstüne gelince sebebi yazar, tıklayınca tekrar dener.
   - <kbd>Alt</kbd>+<kbd>T</kbd>: orijinal ↔ çeviri (kısayolu
     `chrome://extensions/shortcuts` üzerinden değiştirebilirsin).

Siteyi listeden çıkarmak için aynı anahtarı kapat ya da pencerenin altındaki
listeden **Kaldır**'a bas.

## Güncelleme
1. Klasörde `git pull` (ya da yeni ZIP'i indirip aynı klasöre çıkar).
2. `chrome://extensions` sayfasında eklentinin **yeniden yükle** (↻) düğmesine
   bas; sürüm numarasının değiştiğini gör.
3. Açık manga sekmelerini **F5** ile yenile. Yenilemeden kalan eski çeviriler
   kendiliğinden kaldırılır, ama sayfa yeni sürümle ancak yenilenince çevrilir.

Önceden çevrilmiş sayfalar önbellekten gelir. Yerleştirme kuralları
değiştiyse yeni sürümle hemen doğru yere oturur; model tekrar çağrılmaz.
Baştan çevirtmek istersen pencerenin altındaki **Önbelleği temizle**'ye bas.

## Sorun giderme
Bir sayfa çevrilmediyse ya da çeviri yanlış yere düştüyse:
1. O sekmede <kbd>F12</kbd> → **Console**, süzgece `Manga` yaz.
2. Sayfayı F5 ile yenileyip ilgili sayfaya kaydır. Her resim için şuna benzer
   satırlar çıkar:
   - `r3 dilim 0: 5 işaret, modelden 6 metin (numaralar: 1,2,3,5,-,-)`:
     eklentinin bulduğu balon sayısı, modelin döndürdüğü metin sayısı ve her
     metne verdiği balon numarası (`-`: balonsuz).
   - `model yeniden soruldu` / `atlanan yazı için yeniden soruldu, N metin
     eklendi`: model bir şeyi atladığı için sayfa bir kez daha soruldu.
   - `tamam`, `hata …` ya da `aday değil` (çok küçük/görünmeyen resim).
3. Bu satırların ekran görüntüsünü, sayfanın görüntüsünü ve mümkünse bölümün
   bağlantısıyla sayfa numarasını sorunla birlikte bildir.

## Gizlilik
- Ayarlar ve API anahtarları yalnızca bilgisayarında saklanır.
- Görsel yapay zekâda resimler yalnızca seçtiğin sağlayıcıya gider; balon
  bulma ve OCR bilgisayarında yapılır.
- Yerel motorda resim bilgisayarından çıkmaz; Chrome'un çevirmeni de cihazda
  çalışır. Firefox'ta (ya da Chrome çevirmeni o dili desteklemiyorsa) yalnızca
  okunan metin MyMemory'ye gider.
- Eklenti yalnızca listene eklediğin sitelerde çalışır.
- Ayrıntılı gizlilik politikası: [docs/PRIVACY.md](docs/PRIVACY.md) (Türkçe ve İngilizce).

## Bilinen sınırlar
- Yalnızca `<img>` olarak gösterilen resimler çevrilir; sayfayı `<canvas>`'a
  çizen okuyucular henüz desteklenmiyor.
- Yerel motor yalnızca İngilizce kaynak yazıyı okur; çizimin üstüne yazılmış
  ses efektlerini ve süslü yazıları çoğunlukla okuyamaz.
- Görsel yapay zekâda yazıların yerini model tahmin eder; balonsuz yazılarda
  bu tahmin kayabilir (OCR çoğunu düzeltir). Claude'da yer tahmini Gemini'ye
  göre daha zayıf olabilir; çeviri kalitesi için Haiku yerine Sonnet önerilir.
- Japonca/Korece karakterli ses efektlerinin (ザ, ドン) etiketi modelin
  verdiği yerde durur; bazen yanlış panele düşebilir. Latin harfli efektler
  ("AAAHH!") OCR ile yazısının yanına taşınır.
- Birbirine değen iki balon tek bir çeviriyle gösterilebilir.
- Model iki metne aynı balon numarasını verip yerlerini de karıştırırsa
  yanlış metin balonda kalabilir.
- Balonsuz yazısı olan sayfalarda OCR yüzünden çeviri birkaç saniye
  gecikebilir.
- Kenarı kesik kesik ya da bulanık çizgilerden oluşan balonlar balon olarak
  bulunamayabilir; o zaman yazının yeri OCR'ye kalır. OCR'nin okuyamadığı
  eğik, çerçeveli küçük satırlar örtülmeyebilir.
- Açık renkli tram ya da çizim üstündeki beyaz konturlu yazılar (siyah
  balonda olmayanlar) bulunamayabilir; yerleri modelin tahminine kalır.

## Geliştirme
Derleme adımı yok (düz JavaScript, Manifest V3). Node 22+ gerekir.

```bash
npm test
```

- `npm run paketle`: mağazaya/imzalamaya yüklenecek ZIP (`dist/`).
- Her push ve pull request'te GitHub Actions testleri Node 22 ve 24 ile
  çalıştırır ve paketin üretilebildiğini denetler (`.github/workflows/test.yml`).
- `npm run tesseract`: gömülü Tesseract dosyalarını `node_modules`'tan
  yeniden kopyalar (önce `npm install`).
- `test/onizleme.html`, `test/popup_onizleme.html`, `test/sayfa_deneme.html`:
  depo kökünden bir HTTP sunucusuyla açılan önizleme/deneme sayfaları.

Kararlaştırılan özellikler [docs/SPEC.md](docs/SPEC.md), geliştirme aşamaları
[docs/ASAMALAR.md](docs/ASAMALAR.md). Chrome Web Store yayını için metinler, izin
gerekçeleri ve görseller: [docs/MAGAZA.md](docs/MAGAZA.md).

## Lisans
MIT. Gömülü [Tesseract.js](https://github.com/naptha/tesseract.js) Apache-2.0
lisanslıdır (`vendor/tesseract/`).
