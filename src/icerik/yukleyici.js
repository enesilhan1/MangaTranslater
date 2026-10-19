// Tarayıcılar kaydedilen içerik betiklerini ES modülü olarak çalıştırmıyor;
// bu küçük klasik betik asıl modülü (ana.js) eklentinin içinden yükler.
// Modülün dosyaları bu yüzden web_accessible_resources'ta. Açılır pencere
// bir siteyi açınca aynı betiği o sekmeye hemen de enjekte eder.
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  import(api.runtime.getURL('src/icerik/ana.js'))
    .then((m) => m.baslat())
    .catch((e) =>
      console.warn('[Manga Çevirmen] içerik betiği yüklenemedi:', e),
    );
})();
