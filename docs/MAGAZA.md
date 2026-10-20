# Chrome Web Store yayını

Mağaza formunun her alanı için kopyalanacak metinler ve adımlar. Görseller
`docs/magaza/` içinde. Yeniden üretmek için `test/magaza_gorseli.html`
sayfasını depo kökünden bir HTTP sunucusuyla açıp 1280x800 (tanıtım kutusu
440x280) ekran görüntüsü al: `?sahne=once-sonra|pencere|tanitim&dil=tr|en`.

## Senin yapacakların (sırayla)
1. <https://chrome.google.com/webstore/devconsole> adresinde Google
   hesabınla geliştirici kaydı yap (tek seferlik 5 ABD doları) ve e-postanı
   doğrula.
2. **Yeni öğe** → `dist/manga-cevirmen-<sürüm>.zip` dosyasını yükle
   (`npm run paketle` ile üretilir; repoya girmez).
3. **Mağaza girişi** sekmesi: aşağıdaki açıklamaları, kategoriyi, dili ve
   görselleri gir. İngilizce'yi de istersen "Dil ekle" ile ayrıca ekle.
4. **Gizlilik** sekmesi: tek amaç, izin gerekçeleri, uzak kod ve veri
   kullanımı cevaplarını aşağıdan gir; gizlilik politikası adresini yapıştır.
5. **Dağıtım** sekmesi: görünürlük (aşağıdaki öneriye bak), bölgeler: tümü.
6. **İncelemeye gönder.** Geniş site erişimi (`<all_urls>`) yüzünden
   inceleme birkaç gün sürebilir; ek açıklama isterlerse aşağıdaki
   gerekçeler yeterli olmalı.

Sonraki sürümlerde: `manifest.json`'da sürümü yükselt, `npm run paketle`,
Geliştirici Konsolu → Paket → **Yeni paket yükle** → incelemeye gönder.

## Mağaza girişi

**Ad** (manifest'ten otomatik): Manga Çevirmen / Manga Translator

**Özet** (manifest'ten otomatik, ≤132 karakter):
- TR: Manga sayfalarındaki resimlerin üzerindeki yazıları seçtiğin dile çevirir; seçtiğin sitelerde kendiliğinden çalışır.
- EN: Translates the text on manga page images into your language; runs automatically on the sites you choose.

**Kategori:** Araçlar (Tools)

**Ayrıntılı açıklama — Türkçe:**

```
Manga, manhwa ve çizgi roman sayfalarındaki resimlerin üzerindeki yazıları (konuşma balonları, anlatım kutuları, ses efektleri) Türkçeye ya da seçtiğin dile çevirir. Tarayıcının kendi çevirisi resimlerin içindeki yazıya dokunmaz; bu eklenti tam olarak bunu yapar.

• Otomatik: Bir siteyi bir kez "her zaman çevir" listesine eklersin; o sitede her yeni bölüm ve sayfa kendiliğinden çevrilir.
• Hızlı: Ekrandaki sayfa önce çevrilir, ilerideki sayfalar sen okurken hazırlanır. Çeviriler önbellekte tutulur; aynı sayfaya dönünce anında gelir.
• Balonun üstüne yazar: Eklenti balonları resimden kendisi bulur, orijinal yazıyı beyazla örter ve çeviriyi balonun şekline sığdırır. Ses efektleri çizimi kapatmadan küçük bir etiketle gösterilir. Alt+T ile orijinali görürsün.

İki çeviri motoru:
• Görsel yapay zekâ (önerilen): Gemini, Claude ya da ChatGPT. Kendi API anahtarını kullanırsın (Gemini'nin ücretsiz kotası var). El yazısını, ses efektlerini ve her kaynak dili okur.
• Yerel (anahtarsız, ücretsiz): Yazı bilgisayarında okunur ve Chrome'un cihazda çalışan çevirmeniyle çevrilir. İyi basılmış İngilizce balonlarda iyi sonuç verir.

Gizlilik: Eklentinin kendi sunucusu yoktur ve hiçbir veri toplamaz. Ayarların ve API anahtarların yalnızca tarayıcında kalır. Resimler yalnızca seçtiğin yapay zekâ sağlayıcısına gider; yerel motorda bilgisayarından çıkmaz.

Açık kaynak (MIT): https://github.com/enesilhan1/MangaTranslator
```

**Ayrıntılı açıklama — English:**

```
Translates the text inside manga, manhwa and comic images (speech bubbles, captions, sound effects) into your language. The browser's own translation never touches text inside images; this extension does exactly that.

• Automatic: add a site to your "always translate" list once; every new chapter and page there is translated by itself.
• Fast: the page on screen goes first, upcoming pages are prepared while you read. Translations are cached, so a page you return to appears instantly.
• Drawn over the bubble: the extension finds the bubbles in the image itself, covers the original text and fits the translation into the bubble's shape. Sound effects get a small label that keeps the art visible. Press Alt+T to see the original.

Two engines:
• Vision AI (recommended): Gemini, Claude or ChatGPT with your own API key (Gemini has a free tier). Reads handwriting, sound effects and any source language.
• Local (no key, free): text is read on your computer and translated by Chrome's on-device translator. Works well on clearly printed English bubbles.

Privacy: the extension has no server and collects no data. Your settings and API keys stay in your browser. Images go only to the AI provider you choose; with the local engine they never leave your computer.

Open source (MIT): https://github.com/enesilhan1/MangaTranslator
```

**Görseller:**
- Ekran görüntüleri (1280x800): `docs/magaza/1-once-sonra.png`,
  `docs/magaza/2-pencere.png` (İngilizce giriş için `-en` sürümleri).
- Küçük tanıtım kutusu (440x280): `docs/magaza/tanitim-440x280.png`
  (`-en` sürümü İngilizce).
- Simge: paketteki `icons/ikon128.png` kullanılır.

**Ana sayfa adresi:** <https://github.com/enesilhan1/MangaTranslator>
**Destek adresi:** <https://github.com/enesilhan1/MangaTranslator/issues>

## Gizlilik sekmesi

**Tek amaç açıklaması:**

```
Translates the text inside comic and manga images on the web pages the user chooses, and draws the translation over the original text.
```

**İzin gerekçeleri:**

| İzin | Gerekçe (forma İngilizce yaz) |
|---|---|
| Site erişimi `<all_urls>` | `Comic and manga sites can be on any domain; the user picks them. The extension needs to read the comic images on those pages, draw the translation on top, and load the images from the sites' image servers (often a different domain). It only runs on sites the user added to its list, or on the current tab when the user turns it on.` |
| `scripting` | `Registers the content script only for the sites the user added, and injects it into the current tab when the user turns translation on, so the page does not need a reload.` |
| `activeTab` | `Lets the popup start translating on the tab the user is looking at when they turn it on.` |
| `storage` | `Stores the user's settings, site list and API keys locally.` |
| `unlimitedStorage` | `Caches translations per image locally (IndexedDB) so pages the user has already read appear instantly instead of being sent to the AI provider again.` |
| `offscreen` | `Runs the bundled Tesseract OCR (WebAssembly in a Web Worker) in an offscreen document, because the service worker cannot create workers.` |

**Uzak kod kullanıyor musunuz?** Hayır (No). Bütün kod pakette; Tesseract
dosyaları da pakete gömülü.

**Veri kullanımı** (işaretlenecekler):
- ☑ **Web sitesi içeriği** (Website content): sayfadaki resimler, çeviri
  için kullanıcının seçtiği yapay zekâ sağlayıcısına gönderilir.
- ☑ **Kişisel bilgi** (Personally identifiable information): yalnızca
  kullanıcı yerel motor için isteğe bağlı e-posta girerse, MyMemory'ye
  gönderilir.
- Diğer bütün türler: işaretleme.

Üç beyan kutusunun üçü de işaretlenir:
- Veriler üçüncü taraflara satılmıyor (onaylanan kullanım dışında).
- Veriler eklentinin tek amacıyla ilgisiz işlerde kullanılmıyor.
- Veriler kredi değerliliği ya da borç verme için kullanılmıyor.

**Gizlilik politikası adresi:**
<https://github.com/enesilhan1/MangaTranslator/blob/main/docs/PRIVACY.md>

**İnceleyici için test notu** (istenirse):

```
The main engine needs the user's own AI API key. To test without a key: open the popup, choose "Local (no key)", click "Prepare translator", turn on "Always translate on this site", then open any page with an English comic image. A sample page is in the repository: test/sayfa_deneme.html (open it from a local HTTP server).
```

## Görünürlük önerisi
- **Liste dışı (Unlisted):** yalnızca bağlantıyı verdiğin kişiler kurar;
  arama sonuçlarında görünmez. Otomatik güncelleme yine çalışır. Başlangıç
  için önerilen.
- **Herkese açık (Public):** mağaza aramasında görünür. İstersen sonra
  bu ayarı değiştirmek yeterli; yeniden yüklemek gerekmez.
