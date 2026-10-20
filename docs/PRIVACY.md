# Privacy Policy — Manga Translator (Manga Çevirmen)

_Last updated: 2026-10-21_

Türkçe metin aşağıdadır.

## Summary
Manga Translator has no server of its own. It does not collect, sell or
share any data with the developer. Everything the extension stores stays in
your browser. Images and text leave your computer only to go to the
translation service **you choose**, and only to translate them.

## What the extension handles
- **Images on the pages you enable.** The extension reads the comic images
  on sites you add to the "always translate" list (or the current tab when
  you turn it on).
- **Your settings and API keys.** Stored only in your browser
  (`chrome.storage.local`). They are never sent anywhere except the API key
  itself, which goes only to its own provider with each request.
- **Translation cache.** Translations are stored in your browser
  (IndexedDB) under a fingerprint (SHA-256 hash) of the image, so a page you
  have already read appears instantly. You can clear it from the popup
  ("Clear cache").
- **Optional e-mail address** (local engine only). If you enter it, it is
  sent to MyMemory to raise its free daily limit.

## Where data goes
- **Vision AI engine (default):** the page image (resized, as JPEG) is sent
  directly from your browser to the provider you selected, using your own
  API key:
  - Google Gemini — `generativelanguage.googleapis.com`
  - Anthropic Claude — `api.anthropic.com`
  - OpenAI ChatGPT — `api.openai.com` (sent with `store: false`)

  The provider's own privacy policy and terms apply to that request.
- **Local engine (no key):** the image is read on your computer with the
  bundled Tesseract OCR; it does not leave your computer. The recognized text
  is translated by Chrome's built-in on-device translator. Only when that is
  not available (Firefox, or an unsupported language pair) the recognized
  text is sent to MyMemory (`api.mymemory.translated.net`).
- **Loading images:** to read an image that is hosted on another address,
  the extension may download it again from that same address (the site's own
  image server).

The extension sends nothing else: no analytics, no tracking, no data to the
developer.

## Permissions
- `<all_urls>` (host access): to read images and draw translations on the
  comic sites you choose, which can be any site, and to load those images
  from the sites' image servers. The extension only runs on sites in your
  list (or the tab where you turn it on).
- `scripting`, `activeTab`: to start translating on the current tab when you
  turn it on, without reloading.
- `storage`, `unlimitedStorage`: settings and the translation cache.
- `offscreen`: runs the bundled OCR in an offscreen document (a service
  worker cannot run it).

## Contact
Questions or requests: open an issue at
<https://github.com/enesilhan1/MangaTranslator/issues>.

---

# Gizlilik Politikası — Manga Çevirmen

_Son güncelleme: 2026-10-21_

## Özet
Manga Çevirmen'in kendi sunucusu yoktur. Geliştiriciye hiçbir veri
toplanmaz, satılmaz ya da paylaşılmaz. Eklentinin sakladığı her şey
tarayıcında kalır. Resimler ve metinler bilgisayarından yalnızca **senin
seçtiğin** çeviri hizmetine, yalnızca çevrilmek için gider.

## Eklentinin işlediği veriler
- **Açtığın sayfalardaki resimler.** "Her zaman çevir" listene eklediğin
  sitelerdeki (ya da açtığın sekmedeki) çizgi roman resimleri okunur.
- **Ayarların ve API anahtarların.** Yalnızca tarayıcında saklanır
  (`chrome.storage.local`). Hiçbir yere gönderilmez; API anahtarı yalnızca
  kendi sağlayıcısına, her istekle birlikte gider.
- **Çeviri önbelleği.** Çeviriler resmin parmak iziyle (SHA-256 özeti)
  tarayıcında (IndexedDB) saklanır; okuduğun sayfa tekrar açılınca anında
  gelir. Açılır pencereden ("Önbelleği temizle") silebilirsin.
- **İsteğe bağlı e-posta** (yalnızca yerel motor). Girersen MyMemory'nin
  ücretsiz günlük sınırını artırmak için MyMemory'ye gönderilir.

## Veri nereye gider
- **Görsel yapay zekâ (varsayılan):** sayfa resmi (küçültülmüş, JPEG)
  tarayıcından doğrudan seçtiğin sağlayıcıya, kendi API anahtarınla gider:
  - Google Gemini — `generativelanguage.googleapis.com`
  - Anthropic Claude — `api.anthropic.com`
  - OpenAI ChatGPT — `api.openai.com` (`store: false` ile)

  Bu istek için sağlayıcının kendi gizlilik politikası ve koşulları geçerlidir.
- **Yerel motor (anahtarsız):** resim bilgisayarında, pakete gömülü
  Tesseract OCR ile okunur; bilgisayarından çıkmaz. Okunan metni Chrome'un
  cihazda çalışan yerleşik çevirmeni çevirir. Yalnızca o kullanılamıyorsa
  (Firefox ya da desteklenmeyen dil çifti) okunan metin MyMemory'ye
  (`api.mymemory.translated.net`) gider.
- **Resmin yüklenmesi:** başka bir adreste duran bir resmi okumak için
  eklenti onu aynı adresten (sitenin kendi resim sunucusundan) yeniden
  indirebilir.

Eklenti başka hiçbir şey göndermez: istatistik, izleme ya da geliştiriciye
veri yoktur.

## İzinler
- `<all_urls>` (site erişimi): seçtiğin, herhangi bir alan adında olabilen
  çizgi roman sitelerinde resimleri okumak ve çevirileri çizmek, o resimleri
  sitelerin resim sunucularından yüklemek için. Eklenti yalnızca listendeki
  sitelerde (ya da açtığın sekmede) çalışır.
- `scripting`, `activeTab`: açtığında, sayfayı yenilemeden o sekmede
  çevirmeye başlamak için.
- `storage`, `unlimitedStorage`: ayarlar ve çeviri önbelleği.
- `offscreen`: gömülü OCR'yi ayrı bir belgede çalıştırmak için (service
  worker bunu çalıştıramaz).

## İletişim
Soru ve istekler için:
<https://github.com/enesilhan1/MangaTranslator/issues>
