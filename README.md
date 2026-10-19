# Manga Çevirmen

Manga, manhwa ve çizgi roman sayfalarındaki **resimlerin üzerindeki yazıları**
(konuşma balonları, anlatım kutuları, ses efektleri) Türkçeye ya da seçtiğin
dile çeviren tarayıcı eklentisi. Tarayıcının kendi çevirisi resimlerin içindeki
yazıya dokunmaz; bu eklenti tam olarak bunu yapar.

- **Otomatik:** Bir siteyi bir kez "her zaman çevir" listesine eklersin; o
  sitede her yeni bölümde ve sayfada kendiliğinden çalışır.
- **Hızlı:** Ekrandaki sayfa önce çevrilir, ilerideki sayfalar sen okurken
  hazırlanır. Çeviriler önbellekte tutulur; aynı sayfaya dönünce anında gelir.
- **Balonun üstüne yazar:** Orijinal yazının üstüne beyaz kutu konur ve çeviri
  içine sığdırılır. <kbd>Alt</kbd>+<kbd>T</kbd> ile orijinali görürsün.
- **Chrome** (ve Edge, Brave gibi Chromium tabanlılar) ve **Firefox 140+**.

## İki çeviri motoru

| | Görsel yapay zekâ (varsayılan) | Yerel (anahtarsız) |
|---|---|---|
| Nasıl çalışır | Resim seçtiğin yapay zekâya gider; balonları bulur, okur ve bağlama uygun çevirir | Yazı bilgisayarında Tesseract ile okunur, sonra çevrilir |
| Gereken | API anahtarı (Gemini, Claude ya da ChatGPT) | Hiçbir şey |
| Kalite | En iyisi; ses efektlerini, el yazısını, her kaynak dili okur | İyi basılmış İngilizce balonlarda iyi; süslü yazıda ve ses efektlerinde zayıf |
| Çeviri | Yapay zekâ | Chrome'da tarayıcının kendi çevirmeni (cihazda, ücretsiz); Firefox'ta MyMemory (ücretsiz, günlük sınırlı) |
| Ücret | Sağlayıcının fiyatı (Gemini'nin ücretsiz kotası var) | Ücretsiz |

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
   - Çevirinin üstüne gelince orijinal metin görünür.

Siteyi listeden çıkarmak için aynı anahtarı kapat ya da pencerenin altındaki
listeden **Kaldır**'a bas.

## Gizlilik
- Ayarlar ve API anahtarları yalnızca bilgisayarında saklanır.
- Görsel yapay zekâda resimler yalnızca seçtiğin sağlayıcıya gider.
- Yerel motorda resim bilgisayarından çıkmaz; Chrome'un çevirmeni de cihazda
  çalışır. Firefox'ta (ya da Chrome çevirmeni o dili desteklemiyorsa) yalnızca
  okunan metin MyMemory'ye gider.
- Eklenti yalnızca listene eklediğin sitelerde çalışır.

## Bilinen sınırlar
- Yalnızca `<img>` olarak gösterilen resimler çevrilir; sayfayı `<canvas>`'a
  çizen okuyucular henüz desteklenmiyor.
- Yerel motor yalnızca İngilizce kaynak yazıyı okur; çizimin üstüne yazılmış
  ses efektlerini ve süslü yazıları çoğunlukla okuyamaz.

## Geliştirme
Derleme adımı yok (düz JavaScript, Manifest V3). Node 22+ gerekir.

```bash
npm test
```

- `npm run paketle`: mağazaya/imzalamaya yüklenecek ZIP (`dist/`).
- `npm run tesseract`: gömülü Tesseract dosyalarını `node_modules`'tan
  yeniden kopyalar (önce `npm install`).
- `test/onizleme.html`, `test/popup_onizleme.html`, `test/sayfa_deneme.html`:
  depo kökünden bir HTTP sunucusuyla açılan önizleme/deneme sayfaları.

Kararlaştırılan özellikler [docs/SPEC.md](docs/SPEC.md), geliştirme aşamaları
[docs/ASAMALAR.md](docs/ASAMALAR.md).

## Lisans
MIT. Gömülü [Tesseract.js](https://github.com/naptha/tesseract.js) Apache-2.0
lisanslıdır (`vendor/tesseract/`).
