// Arayüz metinleri (Türkçe / İngilizce, docs/SPEC.md §8). Açılır pencere ve
// içerik betiği (sayfadaki hata göstergeleri) kullanır. Parametreler metinde
// {ad} biçiminde yazılır.

export const ARAYUZ_DILLERI = ['tr', 'en'];
export const VARSAYILAN_ARAYUZ_DILI = 'tr';

export const METINLER = {
  tr: {
    'hata.zamanAsimi': '{ad} çok uzun süre yanıt vermedi. Sayfayı yenileyip tekrar dene.',
    'hata.baglanti': 'İnternet bağlantısı yok ya da sunucuya ulaşılamıyor ({ad}).',
    'hata.bozukYanit': '{ad} anlaşılamayan bir yanıt gönderdi. Sayfayı yenileyip tekrar dene.',
    'hata.anahtar': '{ad} API anahtarı geçersiz. Eklentinin penceresinden kontrol et.',
    'hata.anahtarYok': '{ad} API anahtarı girilmemiş. Eklentinin penceresinden ekle ya da yerel motoru seç.',
    'hata.izin': 'Bu API anahtarının bu modeli kullanma izni yok ({ad}).',
    'hata.model': 'Model bulunamadı. Eklentinin penceresinden model adını kontrol et. {mesaj}',
    'hata.kota': 'Çok fazla istek gönderildi ya da {ad} kullanım kotan doldu. Biraz bekleyip tekrar dene.',
    'hata.kota.gemini':
      'Gemini kullanım kotan doldu (ücretsiz kotada dakikalık ve günlük sınır var). Biraz sonra tekrar dene ya da aistudio.google.com üzerinden faturalandırmayı aç.',
    'hata.yogun': '{ad} şu an çok yoğun. Birkaç dakika sonra tekrar dene.',
    'hata.reddetti': '{ad} isteği reddetti ({durum}). {mesaj}',
    'hata.bakiye.anthropic':
      'Anthropic hesabının bakiyesi yetersiz. console.anthropic.com → Billing bölümünden kredi yükle.',
    'hata.bakiye.openai':
      'OpenAI hesabında kullanılabilir kredi yok. platform.openai.com → Billing bölümünden kredi yükle.',
    'hata.ret': '{ad} bu sayfayı çevirmeyi reddetti.',
    'hata.uzunluk': 'Sayfada çok fazla yazı var, {ad} yanıtı yarıda kesildi.',
    'hata.durduruldu': 'Durduruldu.',
    'hata.beklenmeyen': 'Beklenmeyen bir hata oluştu: {mesaj}',
    'hata.resimAlinamadi': 'Resim alınamadı ({mesaj}).',
    'hata.eklentiYenilendi': 'Eklenti güncellendi; çevirmek için sayfayı yenile.',
    'hata.cevirmen.hazirla':
      "Chrome'un çevirmeni bu dil için henüz hazır değil. Eklentinin penceresinden “Çevirmeni hazırla” düğmesine bas.",
    'hata.cevirmen.chrome': "Chrome'un çevirmeni çalışmadı: {mesaj}",
    'hata.mymemory.kota': 'MyMemory günlük çeviri sınırı doldu. Yarın tekrar dene ya da görsel yapay zekâ motorunu seç.',
    'hata.mymemory.kotaEposta':
      'MyMemory günlük çeviri sınırı (~5.000 karakter) doldu. Eklentinin penceresine e-postanı girersen sınır ~50.000 karaktere çıkar.',

    'durum.cevriliyor': 'Çevriliyor…',
    'durum.hata': 'Çevrilemedi',
    'durum.tekrarDene': 'Tekrar dene',
    'ui.baslik': 'Manga Çevirmen',
    'ui.buSite': 'Bu sitede her zaman çevir',
    'ui.buSiteAciklama': 'Açıkken {site} içindeki her sayfada kendiliğinden çevrilir.',
    'ui.siteYok': 'Bu sayfada çeviri açılamaz (yalnızca web siteleri).',
    'ui.izinYok': 'Eklentinin sitelere erişim izni yok; resimler alınamaz.',
    'ui.izinVer': 'İzin ver',
    'ui.motor': 'Çeviri motoru',
    'ui.motor.gorsel': 'Görsel yapay zekâ',
    'ui.motor.gorselAciklama': 'En iyi sonuç, ses efektlerini de çevirir. API anahtarı gerekir.',
    'ui.motor.yerel': 'Yerel (anahtarsız)',
    'ui.motor.yerelAciklama': 'Ücretsiz; yazı bilgisayarında okunur. Yalnızca İngilizce kaynak, ses efektlerinde zayıf.',
    'ui.saglayici': 'Sağlayıcı',
    'ui.model': 'Model',
    'ui.modelElle': 'Diğer (elle yaz)…',
    'ui.modelAdi': 'Model adı',
    'ui.anahtar': 'API anahtarı',
    'ui.anahtarAl': 'Anahtar al',
    'ui.anahtarGoster': 'Göster',
    'ui.anahtarGizle': 'Gizle',
    'ui.anahtarBicim': 'Bu, bir {ad} anahtarına benzemiyor.',
    'ui.cevirmen': 'Chrome çevirmeni',
    'ui.cevirmen.hazir': 'Hazır: çeviri bilgisayarında yapılır.',
    'ui.cevirmen.indir': 'Çevirmeni hazırla',
    'ui.cevirmen.indirAciklama': 'Bu dil için Chrome bir kez dil paketi indirecek.',
    'ui.cevirmen.iniyor': 'İndiriliyor… %{oran}',
    'ui.cevirmen.yok': 'Chrome çevirmeni bu dili desteklemiyor; MyMemory kullanılacak.',
    'ui.cevirmen.hata': 'Hazırlanamadı: {mesaj}',
    'ui.eposta': 'MyMemory e-postası (isteğe bağlı)',
    'ui.epostaAciklama': 'Girersen günlük ücretsiz sınır ~5.000 yerine ~50.000 karakter olur.',
    'ui.hedefDil': 'Çevrilecek dil',
    'ui.arayuzDili': 'Arayüz dili',
    'ui.siteler': 'Her zaman çevrilen siteler',
    'ui.siteListesiBos': 'Henüz site yok. Bir manga sitesini açıp yukarıdaki anahtarı aç.',
    'ui.kaldir': 'Kaldır',
    'ui.onbellek': 'Önbelleği temizle',
    'ui.onbellekTemizlendi': 'Önbellek temizlendi.',
    'ui.kisayol': 'Alt+T: orijinal ↔ çeviri',
  },
  en: {
    'hata.zamanAsimi': '{ad} took too long to respond. Reload the page and try again.',
    'hata.baglanti': 'No internet connection or the server cannot be reached ({ad}).',
    'hata.bozukYanit': '{ad} sent a response that could not be read. Reload the page and try again.',
    'hata.anahtar': 'The {ad} API key is invalid. Check it in the extension window.',
    'hata.anahtarYok': 'No {ad} API key entered. Add one in the extension window or choose the local engine.',
    'hata.izin': 'This API key is not allowed to use this model ({ad}).',
    'hata.model': 'Model not found. Check the model name in the extension window. {mesaj}',
    'hata.kota': 'Too many requests, or your {ad} usage quota is used up. Wait a bit and try again.',
    'hata.kota.gemini':
      'Your Gemini quota is used up (the free tier has per-minute and daily limits). Try again later or enable billing at aistudio.google.com.',
    'hata.yogun': '{ad} is very busy right now. Try again in a few minutes.',
    'hata.reddetti': '{ad} rejected the request ({durum}). {mesaj}',
    'hata.bakiye.anthropic': 'Your Anthropic credit balance is too low. Add credits at console.anthropic.com → Billing.',
    'hata.bakiye.openai': 'Your OpenAI account has no available credit. Add credits at platform.openai.com → Billing.',
    'hata.ret': '{ad} declined to translate this page.',
    'hata.uzunluk': 'There is too much text on this page; the {ad} response was cut off.',
    'hata.durduruldu': 'Stopped.',
    'hata.beklenmeyen': 'An unexpected error occurred: {mesaj}',
    'hata.resimAlinamadi': 'Could not get the image ({mesaj}).',
    'hata.eklentiYenilendi': 'The extension was updated; reload the page to translate.',
    'hata.cevirmen.hazirla':
      "Chrome's translator is not ready for this language yet. Press “Prepare translator” in the extension window.",
    'hata.cevirmen.chrome': "Chrome's translator failed: {mesaj}",
    'hata.mymemory.kota': "MyMemory's daily translation limit is used up. Try again tomorrow or choose the AI engine.",
    'hata.mymemory.kotaEposta':
      "MyMemory's daily limit (~5,000 characters) is used up. Enter your e-mail in the extension window to raise it to ~50,000.",

    'durum.cevriliyor': 'Translating…',
    'durum.hata': 'Could not translate',
    'durum.tekrarDene': 'Try again',
    'ui.baslik': 'Manga Translator',
    'ui.buSite': 'Always translate on this site',
    'ui.buSiteAciklama': 'While on, every page on {site} is translated automatically.',
    'ui.siteYok': 'Translation cannot be turned on for this page (websites only).',
    'ui.izinYok': 'The extension has no access to websites, so it cannot read images.',
    'ui.izinVer': 'Allow',
    'ui.motor': 'Translation engine',
    'ui.motor.gorsel': 'Vision AI',
    'ui.motor.gorselAciklama': 'Best results, also translates sound effects. Needs an API key.',
    'ui.motor.yerel': 'Local (no key)',
    'ui.motor.yerelAciklama': 'Free; text is read on your computer. English source only, weak on sound effects.',
    'ui.saglayici': 'Provider',
    'ui.model': 'Model',
    'ui.modelElle': 'Other (type it)…',
    'ui.modelAdi': 'Model name',
    'ui.anahtar': 'API key',
    'ui.anahtarAl': 'Get a key',
    'ui.anahtarGoster': 'Show',
    'ui.anahtarGizle': 'Hide',
    'ui.anahtarBicim': 'This does not look like a {ad} key.',
    'ui.cevirmen': 'Chrome translator',
    'ui.cevirmen.hazir': 'Ready: translation runs on your computer.',
    'ui.cevirmen.indir': 'Prepare translator',
    'ui.cevirmen.indirAciklama': 'Chrome will download a language pack once for this language.',
    'ui.cevirmen.iniyor': 'Downloading… {oran}%',
    'ui.cevirmen.yok': "Chrome's translator does not support this language; MyMemory will be used.",
    'ui.cevirmen.hata': 'Could not prepare: {mesaj}',
    'ui.eposta': 'MyMemory e-mail (optional)',
    'ui.epostaAciklama': 'With an e-mail the free daily limit rises from ~5,000 to ~50,000 characters.',
    'ui.hedefDil': 'Translate into',
    'ui.arayuzDili': 'Interface language',
    'ui.siteler': 'Always-translated sites',
    'ui.siteListesiBos': 'No sites yet. Open a manga site and turn on the switch above.',
    'ui.kaldir': 'Remove',
    'ui.onbellek': 'Clear cache',
    'ui.onbellekTemizlendi': 'Cache cleared.',
    'ui.kisayol': 'Alt+T: original ↔ translation',
  },
};

/** Metni seçili dilde döndürür; bilinmeyen dil Türkçe, bilinmeyen anahtar kendisi. */
export function cevir(dil, anahtar, parametreler = {}) {
  const tablo = METINLER[dil] ?? METINLER[VARSAYILAN_ARAYUZ_DILI];
  const sablon = tablo[anahtar] ?? METINLER[VARSAYILAN_ARAYUZ_DILI][anahtar] ?? anahtar;
  return sablon
    .replace(/\{(\w+)\}/g, (_, p) => (parametreler[p] == null ? '' : String(parametreler[p])))
    .replace(/\s+/g, ' ')
    .trim();
}
