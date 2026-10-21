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

## Sürüm 1.7.2 (2026-10-20)
v1.7.1'den sonra kullanıcının iki sayfasında iki sorun görüldü.

- Rusça sayfa: dar balonun çevirisi hâlâ yandaki anlatım kutusuna
  ekleniyordu. Sebebi işaret değilmiş. Model o metne anlatım kutusunun
  numarasını verip kutusunu onun kenarına koymuş, "model balonu bölmüş"
  kuralı da metni oraya eklemiş. Artık böyle bir metin önce yakındaki
  çevirisiz balona gidiyor.
- İtalyanca sayfa: 10 işaretin 6'sı çizimin üstündeydi; alttaki iki
  gerçek balon çevrilmedi. Seyrek delikli beyaz alanlar (giysi, tram)
  artık balon sayılmıyor. Ölçüt: yazı kutusundaki delik yoğunluğu. Gerçek
  balonlarda ≥0,11, yanlış bulgularda ≤0,064 (11 sayfada).

Konsolda artık her dilim için "N işaret, modelden M metin (numaralar …)"
yazıyor. Bir balon boş kalırsa modelin mi atladığı buradan görülür.

## Sürüm 1.7.3 (2026-10-20)
Kullanıcının İtalyanca sayfasında büyük bir balon ("CIÒ SIGNIFICA...")
İtalyanca kaldı; çevirisi balonun altındaki kızın üstüne küçük bir kutuda
çıktı. Balonun alt ucu açık ve kızın beyaz saçıyla tek alan.

- Model metni numarasız döndürmüş, OCR kelime kümesi de çizime taşmış.
  OCR kutusu çevirisiz bir balona değiyorsa metin artık o balona
  yerleşiyor.
- Saçtaki 1-3 piksellik lekeler balonun yazı kutusunu yüze kadar
  uzatıyordu. Metnin yanındaki leke blokları artık yazı sayılmıyor.

## Sürüm 1.7.4 (2026-10-20)
Kullanıcının sayfasında iki çeviri katmanı vardı. Eklenti yeniden
yüklenince eski içerik betiği duruyor ama katmanını bırakıyordu; yeni
betik de ikinci bir katman açıyordu. Eski sürümün yerleştirmeleri ekranda
kaldığı için bazı düzeltmeler hiç görünmemiş olabilir. Artık sahipsiz
kalan betik çevirilerini kaldırıyor, yeni betik de eski katmanları
siliyor. Gerçek Chrome'da denendi.

## Sürüm 1.7.5 (2026-10-20)
Kullanıcının iki sayfalık geniş bir resminde birbirine değen iki balonun
numaraları aynı yere, soldaki metnin üstüne üst üste çiziliyordu. Model
sağdaki metne doğru numarayı veremedi; çevirisi yarım örtüldü. Artık
ortak alandaki her numara kendi metnine öbür metinlerden belirgin yakın
ve öbür numaralara değmiyor. Gri analiz kopyası da genişliğe göre değil
alana göre boyutlanıyor; geniş resimlerde balonlar daha ayrıntılı
görülüyor.

## Sürüm 1.7.6 (2026-10-20)
Kullanıcının sayfasında model "È ALICE!" yazısının kutusunu üstteki
balonun "...ALICE?!" satırına koydu. Çeviri o balonun üstüne bindi, asıl
yazı çevrilmeden kaldı. Balonsuz bir metnin kelimeleri modelin kutusu
çevresinde bulunamazsa artık bütün sayfada aranıyor. Taşıma yalnızca tek
ve kesin bir eşleşme varsa yapılıyor; numaralı balonlardaki kelimeler
sayılmıyor. Önbellekteki eski sonuçlar bir kez daha OCR'den geçiyor; model
yeniden çağrılmıyor.

## Sürüm 1.7.7 (2026-10-20)
Kullanıcının sayfasında 7 balon işaretlendi ama modelden yalnızca 1
metin geldi (konsol: "7 işaret, modelden 1 metin"). Kalan balonlar
çevrilmedi; hata işareti de çıkmadı.

- Model işaretli balonların yarısından azına metin verirse istek bir kez
  daha gönderiliyor; daha çok balonu kapsayan yanıt kalıyor. Önbellekteki
  eski eksik kayıtlar da bir kez yeniden soruluyor.
- Kutusu bozuk ama numarası olan metinler artık atılmıyor.
- Konsolda kullanılamayan kayıt sayısı ve yeniden sorma bilgisi
  görünüyor.

## Sürüm 1.7.8 (2026-10-20)
Model balonsuz bir yazının kutusunu sayfanın başka bir yerine koyduğunda
sayfa genelindeki OCR araması, satırlarından biri bozuk okunan yazıyı
bulamıyordu. Eşleşen satırlar arasında artık daha geniş boşluk kabul
ediliyor; önbellekteki sayfalar bir kez daha OCR'den geçiyor. Bilinen
kusur: model iki metne aynı numarayı verip kutuyu da yanlış balona
koyarsa (kullanıcının sayfasında "Shh..." ile "LA MAPPA..."), yanlış metin
balonda kalabiliyor. Çizgisi kesik küçük "Shh..." balonu bulunamıyor.

## Sürüm 1.7.9 (2026-10-20)
Kullanıcının sayfasında kedinin gözü balon sanılıp numaralandı. Model
yanındaki çizim üstü yazıya o numarayı verdi; çeviri göze sıkıştı.
Uzun bir metin, modelin kutusu da uzaktaysa, birkaç parçalık küçük bir
balonun numarasıyla artık oraya konmuyor; kendi yerinde gösteriliyor.

## Sürüm 1.7.10 (2026-10-20)
1.7.9'dan sonra da kedinin gözü çeviriyi aldı. Gerçek sayfa MangaDex'ten
indirilip incelendi. Göz 4 parçalı bir balon olarak numara alıyor; modelin
kutusu göze yakın düştüğü için 1.7.9'daki "hiç değmiyor" şartı
sağlanmıyordu. Artık metin sığmayacağı küçük bir alana hiçbir yoldan
konmuyor: numarayla, en yakın bölgeyle ya da sahipsiz balon eşleştirmesiyle
olmaz.

## Sürüm 1.7.11 (2026-10-20)
İki çizim üstü yazı (siyah çerçeveli beyaz harfler) çevrilmeden kaldı;
çevirileri modelin kayık kutusunda duruyordu. Gerçek sayfalar MangaDex'ten
indirildi ve OCR ilk kez gerçek Chrome'un offscreen belgesinde denendi.

- OCR öncesi piksel sınırı 4'ten 6 MP'ye çıktı. 975x1400 sayfa 1,71 yerine
  2 kat büyütülüyor ve bu yazılar artık okunuyor ("NON POSS0O SPRECARE
  QUEST", "FORSE … FOSS … MORTO"). Süre sayfa başına ~1 sn arttı.
- Sığmayacağı küçük bir alanın numarasını alan metin (kedinin gözü) de
  OCR'de aranıyor; bulunursa asıl yazısına taşınıyor.
- Önbellekteki sayfalar bir kez daha OCR'den geçiyor.

## Sürüm 1.7.12 (2026-10-20)
Model balonsuz bir yazının kutusunu uzağa koyduğunda yapılan sayfa geneli
OCR aramasında artık kısa kelimeler de sayılıyor; kümede en az iki uzun
kelime şartı korunuyor. Kullanıcının sayfasındaki "...HO UNA COSA DI CUI
VI DEVO PARLARE." böylece yerine oturuyor. Aynı sayfada el yazısı gibi
"Scusa..." OCR'de "Gcuso." okunduğu için düzeltilemiyor; ses efekti
etiketleri ("AAAHH!") hâlâ modelin verdiği yerde duruyor.

## Sürüm 1.7.13 (2026-10-20)
Ses efekti etiketleri modelin verdiği yerde duruyordu. Kullanıcının
sayfasında "AAAHH!" etiketi yazının 270 px altında, başka bir panelde
çıkıyordu. Latin harfli efektler artık OCR'de gevşek benzerlikle aranıyor
("AAAHH!" → "PARHH") ve etiket yazının yanına taşınıyor. Japonca
efektlerde OCR çalışmıyor; onlar modelin kutusunda kalıyor.

## Sürüm 1.8.0 (2026-10-21)
Yeni özellik: atlanan yazılar için yeniden sorma. Kullanıcının sayfasında
model birbirine değen iki balondan birini ("SPRIZZANO VOGLIA DI UCCIDERCI
DA TUTTI I PORI.") hiç döndürmedi. Balonlar sayfanın beyaz alanına açıldığı
için numara da almamıştı; ortada bir hata da görünmüyordu.

OCR'nin zaten çalıştığı sayfalarda artık şuna bakılıyor: OCR'nin güvenle
okuduğu, hiçbir çevirinin örtmediği, numaralı balonların dışında kalan ve
modelin okuduğu hiçbir metne benzemeyen bir kelime kümesi var mı? Varsa
model, bu alanlar söylenerek bir kez daha soruluyor. Yanıttan yalnızca o
yazılara ait metinler ekleniyor ve OCR ile yerine konuyor. Bu sayfa başına
bir kez yapılıyor. Ek ücret yalnızca böyle sayfalarda doğuyor.

Gerçek Chrome'da yalnızca atlanan yazı bulundu. Metinlerin hepsinin
döndüğü üç sayfada hiçbir şey bulunmadı. Gerçek bir model yanıtıyla
uçtan uca denenmedi (API anahtarı yok).

## Sürüm 1.8.1 (2026-10-21)
1.8.0'dan sonra kullanıcının iki sayfasında:
- Atlanan "SPRIZZANO…" balonu yine çevrilmedi. Denetim, önbellekteki
  sayfada hiç yapılmamıştı: balonsuz metinler önceki sürümlerde zaten OCR
  ile oturduğu için OCR çalışmıyordu. Artık denetim için de çalışıyor
  (dilim başına bir kez).
- İki sayfalık geniş resimde "VI DARÒ TEMPO PER DECIDERE." atlandı;
  sayfada balonsuz metin olmadığı için denetim yapılmadı. Model bir
  işaretli balonu kullanmadıysa da denetim artık yapılıyor.
- Aynı resim ekranda ~%30 boyutta gösterildiği için dar balonlardaki
  çeviriler kesiliyordu. Son çare olarak dolgu azalıyor, punto 6 px'e
  iniyor, gerekirse kutu dikey büyüyor; yazı kesilmiyor.

## Sürüm 1.8.2 (2026-10-21)
Chrome Web Store yayınına hazırlık:
- Gizlilik politikası (docs/PRIVACY.md).
- Mağaza metinleri, izin gerekçeleri ve veri beyanı (docs/MAGAZA.md).
- Kendi örnek sayfamızla 1280x800 ekran görüntüleri ve 440x280 tanıtım
  kutusu (docs/magaza/; üreten sayfa test/magaza_gorseli.html).
- minimum_chrome_version 121: Firefox için duran background.scripts
  anahtarı Chrome 120'de hata sayılabiliyordu.
- GitHub Actions ile otomatik testler.

## Sürüm 1.8.3 (2026-10-21)
Kullanıcının sayfasında balonun üstüne çizilmiş bir karakterin başı balonla
tek alan oldu ve ayrı bir "metin bloğu" olarak numara aldı. Model yazıya o
numarayı verdi; çeviri karakterin yüzüne gitti. Parçalarının çoğu harf
boyunda olmayan bloklar artık yazı sayılmıyor. Balona çizim karıştığında
beyaz zemin yalnızca yazının çevresine çiziliyor; çizimi örtmüyor. Bu,
1.7.3'teki "zemin kızın saçını biraz kapatabilir" kusurunu da gideriyor.
Sorun, eklentinin gerçek Chrome'da ürettiği gri kopya alınarak birebir
canlandırıldı.

## Sürüm 1.8.4 (2026-10-21)
Eklenti ilk kez gerçek Firefox'ta (158) denendi. Firefox'ta hiçbir sayfa
çevrilmiyordu: içerik betiği gönderilecek resmi base64'e çevirirken
"Permission denied to access property constructor" hatası veriyordu.
Sebep, içerik betiğinin OffscreenCanvas'ının sayfanın bölmesinde (Xray)
nesne üretmesi. Çeviri artık FileReader ile yapılıyor.

Firefox'ta doğrulananlar (geçici profil, web-ext run):
- yükleme, site izni (Firefox 158 kurulumda veriyor), içerik betiği
  kaydı;
- yerel motorla uçtan uca çeviri (arka plandaki Tesseract + MyMemory)
  ve önbellek;
- görsel yapay zekâda balon bulma, işaret çizme, anahtar yok hatası;
- açılır pencere.

Gerçek bir yapay zekâ anahtarıyla Firefox'ta henüz denenmedi.

## Sürüm 1.8.5 (2026-10-21)
Kullanıcının gönderdiği yedi sayfa tek tek, gerçek resimleri ve Chrome'un
gri kopyası/OCR sonucuyla incelendi; düzeltmeler:
- Tırtıklı kenarlı balon ("GLI UMANI..."): yoğunluk lekesiz yazı bloğunda
  ölçülüyor; kenar lekeleri balonu "seyrek" göstermiyor.
- Büyük balonda çok kısa yazı ("SAI..."): delik oranı %0,8–1,5 olsa da
  harfler sıksa balon sayılıyor.
- OCR'de 7+ harfli kelimede iki harf hatası kabul ("DAVVERO?" →
  "PAVWERO?").
- OCR kutusu bir alanın tamamen içindeyse oraya taşınmıyor (çadır
  listesi panel zemininden çıkan oval alana taşınıp kesiliyordu).
- Sığmayan kutular büyürken komşu kutuların üstüne çıkmıyor (yan yana
  anlatımlar birbirini kesiyordu).
- Model iki yazıyı tek metin döndürdüyse yakındaki ikinci OCR kümesi de
  örtülüyor ("ATTENZIONE!" + "RADUNATEVI...").
- OCR sürümü 8: önbellekteki sayfalar bir kez daha OCR'den geçiyor.

Düzeltilemeyenler: kesik çizgili (bulanık) balon kenarları dolguyu
sızdırıyor; OCR'nin hiç okuyamadığı eğik çerçeveli satırlar ("MA
PERCHÉ…" ilk/son satırları, "È IL MASSIMO…") örtülemiyor.

## Sürüm 1.8.6 (2026-10-21)
1.8.5'ten sonra da 350df388…/13 sayfasında kutular üst üste biniyordu;
sebep büyümede değil OCR kümelemesindeydi:
- OCR kelime kümelemesinde yatay erişim iki kelime boyundan bire indi:
  yan sütundaki yazının ortak kelimesi ("MA...", "RANNO") kümeye katılıp
  kutuyu komşusunun üstüne taşımıyor.
- Zaten birkaç piksel kesişen komşu kutular büyürken kesişmeyi ikiye
  bölüyor (önceden kesişen komşu hiç hesaba katılmıyordu).
- OCR sürümü 9: önbellekteki sayfalar bir kez daha OCR'den geçiyor.
