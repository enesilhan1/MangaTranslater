import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { balonlariBul, kutulariOturt } from '../src/kutu_oturtma.js';

const G = 400;
const Y = 600;

/** Gri "çizim" zemini (beyaz değil). */
function resim(zemin = 120) {
  return { gri: new Uint8Array(G * Y).fill(zemin), genislik: G, yukseklik: Y };
}
const boya = (r, x, y, v) => {
  if (x >= 0 && y >= 0 && x < G && y < Y) r.gri[y * G + x] = v;
};
/** Siyah çerçeveli beyaz elips balon. */
function balonCiz(r, cx, cy, rx, ry) {
  for (let y = 0; y < Y; y++) {
    for (let x = 0; x < G; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) r.gri[y * G + x] = 255;
      else if (d <= 1.08) r.gri[y * G + x] = 0;
    }
  }
}
/** Yazı satırı: 6x10 px'lik "harfler", aralarında 3 px boşluk. */
function yaziCiz(r, x0, y0, x1) {
  for (let x = x0; x + 6 <= x1; x += 9) {
    for (let y = y0; y < y0 + 10; y++) for (let dx = 0; dx < 6; dx++) boya(r, x + dx, y, 20);
  }
}
/** Piksel kutusundan 0-1 oranlı balon. */
const balon = (x0, y0, x1, y1, ek = {}) => ({
  x: x0 / G, y: y0 / Y, g: (x1 - x0) / G, h: (y1 - y0) / Y, tur: 'balon', orijinal: 'A', ceviri: 'B', ...ek,
});
const piksel = (b) => ({ x0: b.x * G, y0: b.y * Y, x1: (b.x + b.g) * G, y1: (b.y + b.h) * Y });

/** İki yazılı balon: sol üstte A, sağ altta B. */
function ikiBalon() {
  const r = resim();
  balonCiz(r, 110, 140, 80, 60);
  yaziCiz(r, 70, 125, 150);
  yaziCiz(r, 75, 145, 145);
  balonCiz(r, 290, 420, 80, 65);
  yaziCiz(r, 250, 405, 330);
  yaziCiz(r, 255, 425, 325);
  return r;
}

describe('balonlariBul', () => {
  it('yazılı balonları okuma sırasıyla bulur, yazının sınırlarını verir', () => {
    const b = balonlariBul(ikiBalon());
    assert.equal(b.length, 2);
    assert.ok(b[0].yazi.x0 >= 30 && b[0].yazi.x0 <= 72 && b[0].yazi.y1 <= 170, JSON.stringify(b[0]));
    assert.ok(b[1].yazi.x0 >= 210 && b[1].yazi.y0 >= 360, JSON.stringify(b[1]));
  });

  it('yazısız balonu ve çizim çizgili beyaz paneli balon saymaz', () => {
    const r = resim();
    balonCiz(r, 110, 140, 80, 60); // boş balon
    // Beyaz panel, içinden boydan boya kalın bir çizim çizgisi ve birkaç küçük çizgi geçiyor.
    for (let y = 300; y < 520; y++) for (let x = 200; x < 380; x++) r.gri[y * G + x] = 250;
    for (let t = 0; t < 200; t++) {
      for (let k = 0; k < 4; k++) boya(r, 215 + Math.round(t * 0.75) + k, 310 + t, 10);
    }
    for (let i = 0; i < 5; i++) for (let k = 0; k < 6; k++) boya(r, 230 + i * 25, 480 + k, 10);
    assert.deepEqual(balonlariBul(r), []);
  });
});

describe('kutulariOturt', () => {
  it('işaret numarası verilen kayıt, modelin kutusu nerede olursa olsun o balona gider', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    // Model kutusu tamamen yanlış yerde (sol üst), ama 2 numaralı balon dedi.
    const [b] = kutulariOturt(r, [balon(10, 10, 60, 40, { bolge: 2, ceviri: 'iki' })], bulunanlar);
    const k = piksel(b);
    assert.equal(b.oturdu, true);
    assert.ok(k.x0 > 200 && k.y0 > 350, JSON.stringify(k));
  });

  it('aynı numara iki farklı metne: balona yakın olan kalır, diğeri boş balona geçer', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    // Sayfadaki hata: model sol üst balonun metnine de 2 numarayı verdi, ama
    // kutusu sol üst balonun üstünde.
    const s = kutulariOturt(r, [
      balon(70, 125, 150, 155, { bolge: 2, ceviri: 'üstteki' }),
      balon(250, 405, 330, 435, { bolge: 2, ceviri: 'alttaki' }),
    ], bulunanlar);
    assert.equal(s.length, 2);
    const ust = piksel(s.find((b) => b.ceviri === 'üstteki'));
    const alt = piksel(s.find((b) => b.ceviri === 'alttaki'));
    assert.ok(ust.y1 < 200 && ust.x0 < 100, JSON.stringify(ust));
    assert.ok(alt.y0 > 350 && alt.x0 > 200, JSON.stringify(alt));
    assert.ok(s.every((b) => b.oturdu));
  });

  it('aynı numara ve tahmin de aynı balonda: model balonu bölmüş, art arda yazılır; aynısı bir kez', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    const bolunmus = kutulariOturt(r, [
      balon(70, 120, 150, 135, { bolge: 1, ceviri: 'Bir' }),
      balon(75, 140, 145, 158, { bolge: 1, ceviri: 'iki' }),
    ], bulunanlar);
    assert.equal(bolunmus.length, 1);
    assert.equal(bolunmus[0].ceviri, 'Bir iki');
    const ayni = kutulariOturt(r, [balon(0, 0, 1, 1, { bolge: 1, ceviri: 'Uah' }), balon(0, 0, 1, 1, { bolge: 1, ceviri: 'Uah' })], bulunanlar);
    assert.equal(ayni.length, 1);
  });

  it('numarasız kayıt: kaymış tahmin en yakın geçerli balona oturur', () => {
    const r = ikiBalon();
    // Tahmin sağ alt balonun yazısından 40 px aşağı, 30 px sağa kaymış.
    const [b] = kutulariOturt(r, [balon(280, 440, 380, 500)]);
    const k = piksel(b);
    assert.equal(b.oturdu, true);
    assert.ok(Math.abs(k.x0 - 250) <= 15 && Math.abs(k.y0 - 405) <= 15, JSON.stringify(k));
  });

  it('numarasız kayıt numaralı kayda verilmiş balona oturmaz; farklı metinler birleşmez', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    const s = kutulariOturt(r, [
      balon(0, 0, 1, 1, { bolge: 2, ceviri: 'numaralı' }),
      balon(250, 405, 330, 435, { ceviri: 'numarasız' }),
    ], bulunanlar);
    assert.equal(s.length, 2);
    const numarasiz = s.find((b) => b.ceviri === 'numarasız');
    assert.notEqual(numarasiz.oturdu, true);
  });

  it('numarasız iki farklı kayıt aynı balona düşerse ikincisi tahminde kalır', () => {
    const r = ikiBalon();
    const s = kutulariOturt(r, [balon(240, 400, 340, 440, { ceviri: 'Uah' }), balon(250, 410, 335, 445, { ceviri: 'Başka' })]);
    assert.equal(s.length, 2);
    assert.equal(s.filter((b) => b.oturdu).length, 1);
    assert.ok(!s.some((b) => b.ceviri.includes(' ')), 'farklı metinler birleşmemeli');
  });

  it('beyaz arka planda ya da yazısız balonda tahmin korunur; ses efektine dokunmaz', () => {
    const beyaz = resim(255);
    yaziCiz(beyaz, 150, 125, 250);
    const tahmin = balon(140, 110, 260, 150);
    assert.deepEqual(kutulariOturt(beyaz, [tahmin]), [tahmin]);

    const bos = resim();
    balonCiz(bos, 200, 150, 100, 70);
    assert.deepEqual(kutulariOturt(bos, [tahmin]), [tahmin]);

    const r = ikiBalon();
    const ses = balon(250, 405, 330, 435, { tur: 'ses', bolge: 2 });
    assert.deepEqual(kutulariOturt(r, [ses], balonlariBul(r)), [ses]);
  });
});

describe('balon şekli ve kutusu', () => {
  it('oval balon elips, siyah çerçeveli dikdörtgen kutu elips değil', () => {
    const r = resim();
    balonCiz(r, 110, 140, 80, 60);
    yaziCiz(r, 70, 125, 150);
    yaziCiz(r, 75, 145, 145);
    // Dikdörtgen anlatım kutusu: siyah çerçeve, beyaz iç.
    for (let y = 350; y < 470; y++) for (let x = 200; x < 380; x++) {
      r.gri[y * G + x] = y < 353 || y > 466 || x < 203 || x > 376 ? 0 : 255;
    }
    yaziCiz(r, 220, 390, 360);
    yaziCiz(r, 225, 410, 355);
    const b = balonlariBul(r);
    assert.equal(b.length, 2);
    assert.equal(b[0].elips, true);
    assert.equal(b[1].elips, false);
  });

  it('yerleşen kayıt balonun iç kutusunu taşır; kutu yazı kutusunu kapsar', () => {
    const r = ikiBalon();
    const [b] = kutulariOturt(r, [balon(0, 0, 1, 1, { bolge: 1 })], balonlariBul(r));
    assert.equal(b.balon.elips, true);
    assert.ok(b.balon.x <= b.x && b.balon.y <= b.y);
    assert.ok(b.balon.x + b.balon.g >= b.x + b.g && b.balon.y + b.balon.h >= b.y + b.h);
    // Balonun içi (elips 30-190 x 80-200) dışına çıkmaz.
    const k = piksel(b.balon);
    assert.ok(k.x0 >= 28 && k.x1 <= 192 && k.y0 >= 78 && k.y1 <= 202, JSON.stringify(k));
  });
});

describe('zor balon biçimleri (kullanıcının sayfalarından)', () => {
  it('uzun ince kuyruklu balon bulunur; kuyruk balonun kutusuna girmez', () => {
    const r = resim();
    balonCiz(r, 110, 140, 70, 60);
    yaziCiz(r, 75, 125, 145);
    yaziCiz(r, 80, 145, 140);
    // Balonun sağından 200 px uzanan, içi 4 px genişliğinde beyaz kuyruk (iki çizgi arası).
    for (let x = 178; x < 380; x++) {
      for (let y = 136; y <= 141; y++) r.gri[y * G + x] = y === 136 || y === 141 ? 0 : 255;
    }
    const b = balonlariBul(r);
    assert.equal(b.length, 1);
    assert.ok(b[0].kutu.x1 < 200, JSON.stringify(b[0].kutu));
  });

  it('yazısı neredeyse tam genişlikte olan dar balon ikiye bölünmez', () => {
    const r = resim();
    balonCiz(r, 110, 200, 45, 110);
    for (let y = 120; y <= 270; y += 16) yaziCiz(r, 72, y, 150);
    const b = balonlariBul(r);
    assert.equal(b.length, 1);
    assert.ok(b[0].kutu.y1 - b[0].kutu.y0 > 180, JSON.stringify(b[0].kutu));
  });
});

describe('tramlı çizim', () => {
  it('minik beneklerle farklı boyda saç telleri olan beyaz alan balon sayılmaz', () => {
    // Kullanıcının sayfası: balonun yanındaki benekli kapüşon numara aldı,
    // model alttaki metinlerin numaralarını kaydırdı.
    const r = resim();
    balonCiz(r, 200, 300, 60, 70);
    let n = 0;
    for (let y = 260; y < 345 && n < 22; y += 7) {
      for (let x = 165; x < 235 && n < 22; x += 7) {
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) boya(r, x + dx, y + dy, 30);
        n++;
      }
    }
    [5, 7, 9, 12, 6, 10, 8, 11, 14, 4, 13, 6, 9, 15, 7, 10].forEach((boy, i) => {
      for (let y = 0; y < boy; y++) for (let dx = 0; dx < 3; dx++) boya(r, 168 + (i % 8) * 8 + dx, (i < 8 ? 300 : 322) + y, 20);
    });
    assert.equal(balonlariBul(r).length, 0);
  });
});

describe('beyaz yüz / giysi (ince gri kopyayla yazı düzeni)', () => {
  /** Gri resmin [kat] kat büyütülmüş kopyası (en yakın komşu). */
  const buyut = (r, kat) => {
    const g = { gri: new Uint8Array(G * kat * Y * kat), genislik: G * kat, yukseklik: Y * kat };
    for (let y = 0; y < Y * kat; y++) for (let x = 0; x < G * kat; x++) g.gri[y * G * kat + x] = r.gri[Math.floor(y / kat) * G + Math.floor(x / kat)];
    return g;
  };
  const kutuCiz = (r, x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) boya(r, x, y, 20); };

  it('dağınık lekeli beyaz alan (göz, burun, ağız, saç) ince kopyada yazı düzeni olmadığı için balon sayılmaz', () => {
    // Kullanıcının denediği Boruto sayfalarında beyaz yüzler numara alıyordu.
    const r = resim();
    balonCiz(r, 200, 300, 60, 70);
    kutuCiz(r, 178, 280, 14, 7); // sol göz
    kutuCiz(r, 210, 284, 14, 8); // sağ göz (farklı hizada)
    kutuCiz(r, 198, 295, 4, 12); // burun
    kutuCiz(r, 188, 312, 24, 3); // ağız
    kutuCiz(r, 182, 268, 3, 9); // saç telleri
    kutuCiz(r, 220, 268, 3, 10);
    kutuCiz(r, 176, 296, 5, 7); // yanak gölgesi
    assert.equal(balonlariBul(r).length, 1, 'ince kopya yoksa eski davranış');
    const t = [];
    assert.equal(balonlariBul(r, (x) => t.push(x), buyut(r, 2)).length, 0, JSON.stringify(t.filter((x) => x.kutu.x0 > 100 && x.kutu.x0 < 200)));
  });

  it('seyrek ama satır düzenli yazı ince kopyayla da balon kalır', () => {
    const r = resim();
    balonCiz(r, 200, 300, 70, 60);
    // İnce çizgili "L" harfleri: yoğunluk düşük, satırlar düzenli.
    for (let y = 270; y <= 318; y += 16) {
      for (let x = 165; x + 7 <= 235; x += 10) {
        kutuCiz(r, x, y, 2, 10);
        kutuCiz(r, x, y + 8, 7, 2);
      }
    }
    const t = [];
    const b = balonlariBul(r, (x) => t.push(x), buyut(r, 2));
    assert.equal(b.length, 1, JSON.stringify(t.filter((x) => x.kutu.x0 > 100 && x.kutu.x0 < 200)));
    assert.ok(t.find((x) => x.sebep === 'balon').ozellik.yogunluk < 0.28, 'test seyrek yazıyı sınamalı');
  });
});

describe('ortak beyaz alanda birden çok metin', () => {
  it('birbirinden uzak iki yazı bloğu ayrı balon sayılır; yakın satırlar ve tek kelimelik parçalar bölünmez', () => {
    const r = resim();
    // Tek beyaz alan (iç içe geçmiş iki balon gibi; resmin %15'inden küçük), içinde iki ayrı metin.
    for (let y = 100; y < 320; y++) for (let x = 150; x < 300; x++) {
      r.gri[y * G + x] = y < 103 || y > 316 || x < 153 || x > 296 ? 0 : 255;
    }
    yaziCiz(r, 165, 125, 285);
    yaziCiz(r, 165, 140, 285);
    yaziCiz(r, 165, 155, 285);
    yaziCiz(r, 170, 270, 280);
    yaziCiz(r, 170, 285, 280);
    const b = balonlariBul(r);
    assert.equal(b.length, 2, JSON.stringify(b.map((x) => x.yazi)));
    assert.ok(b[0].yazi.y1 < 200 && b[1].yazi.y0 > 240, JSON.stringify(b.map((x) => x.yazi)));
    assert.ok(b.every((x) => x.elips === false));
  });

  it('hemen alt alta ama yatayda kayık iki metin ayrılır; sola yaslı tek metin bölünmez', () => {
    // Kullanıcının sayfası: "…SALDI, OK?" satırının hemen altında, solda
    // başlayan "MENOU HA DETTO…"; satır aralığı iki metinde de aynı.
    const alanCiz = (r) => {
      for (let y = 100; y < 330; y++) for (let x = 150; x < 300; x++) {
        r.gri[y * G + x] = y < 103 || y > 326 || x < 153 || x > 296 ? 0 : 255;
      }
    };
    const r = resim();
    alanCiz(r);
    for (let y = 120; y <= 165; y += 15) yaziCiz(r, 220, y, 290);
    for (let y = 180; y <= 225; y += 15) yaziCiz(r, 160, y, 222);
    const b = balonlariBul(r);
    assert.equal(b.length, 2, JSON.stringify(b.map((x) => x.yazi)));
    assert.ok(b.some((x) => x.yazi.x0 >= 205 && x.yazi.y1 < 190) && b.some((x) => x.yazi.x1 <= 235 && x.yazi.y0 >= 165), JSON.stringify(b.map((x) => x.yazi)));
    // Sola yaslı tek metin: kısa satırlar uzunlarla örtüşür, bölünmez.
    const r2 = resim();
    alanCiz(r2);
    [290, 200, 290, 215, 285, 190, 280, 210].forEach((son, i) => yaziCiz(r2, 160, 120 + 15 * i, son));
    assert.equal(balonlariBul(r2).length, 1);
  });

  it('birbirine değen iki balonda her işaret kendi metnine yakın ve öbürüyle çakışmıyor', () => {
    const r = resim();
    // Kullanıcının sayfası: iki balon birbirine değiyor, beyaz alan tek parça.
    for (let y = 0; y < Y; y++) {
      for (let x = 0; x < G; x++) {
        const d = Math.min(((x - 110) / 60) ** 2 + ((y - 300) / 75) ** 2, ((x - 210) / 60) ** 2 + ((y - 300) / 75) ** 2);
        if (d <= 1) r.gri[y * G + x] = 255;
        else if (d <= 1.08) r.gri[y * G + x] = 0;
      }
    }
    // Soldaki metnin üstünde geniş boşluk; sağdakinin üstünde neredeyse hiç.
    for (let y = 300; y <= 330; y += 15) yaziCiz(r, 80, y, 140);
    for (let y = 238; y <= 343; y += 15) yaziCiz(r, 180, y, 240);
    const b = balonlariBul(r);
    assert.equal(b.length, 2, JSON.stringify(b.map((x) => x.kutu)));
    const uz = (i, k) => Math.hypot(Math.max(k.x0 - i.x, 0, i.x - k.x1), Math.max(k.y0 - i.y, 0, i.y - k.y1));
    for (const [a, c] of [[b[0], b[1]], [b[1], b[0]]]) {
      assert.ok(a.isaret, 'işaret yok');
      assert.ok(uz(a.isaret, a.kutu) <= 0.5 * uz(a.isaret, c.kutu), JSON.stringify({ i: a.isaret, k: a.kutu, o: c.kutu }));
    }
    assert.ok(Math.hypot(b[0].isaret.x - b[1].isaret.x, b[0].isaret.y - b[1].isaret.y) > b[0].isaret.r + b[1].isaret.r);
  });
});

describe('güvenilmez numara', () => {
  it('metin birkaç parçalık küçük balona sığmıyorsa numarasıyla oraya konmaz (çok uzunsa hiç, biraz uzunsa kutusu dışındaysa); kısa metin konur', () => {
    const r = resim();
    // Kedinin gözü gibi küçük beyaz alan: içinde iki leke.
    balonCiz(r, 100, 300, 28, 22);
    for (const x of [88, 104]) for (let y = 293; y < 305; y++) for (let dx = 0; dx < 5; dx++) boya(r, x + dx, y, 20);
    const bulunanlar = balonlariBul(r);
    assert.equal(bulunanlar.length, 1, 'göz balon sayılmalı (testin varsayımı)');
    const uzun = 'FORSE PENSAVANO FOSSI MORTO';
    const [uzakta] = kutulariOturt(r, [balon(220, 280, 330, 330, { bolge: 1, orijinal: uzun })], bulunanlar);
    assert.notEqual(uzakta.oturdu, true);
    assert.ok(piksel(uzakta).x0 > 200, JSON.stringify(piksel(uzakta)));
    // Kesin uyumsuzluk (2 parça, 24 harf): kutu gözün içinde olsa da oraya konmaz.
    const [yakinda] = kutulariOturt(r, [balon(80, 290, 120, 310, { bolge: 1, orijinal: uzun })], bulunanlar);
    assert.notEqual(yakinda.oturdu, true);
    // Orta uyumsuzlukta (2 parça, 10 harf) kutusu balonun içindeyse numaraya güvenilir.
    const [orta] = kutulariOturt(r, [balon(80, 290, 120, 310, { bolge: 1, orijinal: 'FORSE MORTO' })], bulunanlar);
    assert.equal(orta.oturdu, true);
    const [ortaUzak] = kutulariOturt(r, [balon(220, 280, 330, 330, { bolge: 1, orijinal: 'FORSE MORTO' })], bulunanlar);
    assert.notEqual(ortaUzak.oturdu, true);
    const [kisa] = kutulariOturt(r, [balon(220, 280, 330, 330, { bolge: 1, orijinal: 'EH?' })], bulunanlar);
    assert.equal(kisa.oturdu, true);
    // Numarasız metin de kutusu gözün üstünde olsa bile oraya oturtulmaz.
    const [numarasiz] = kutulariOturt(r, [balon(80, 290, 120, 310, { bolge: 0, orijinal: 'MA NON ERA COSI' })], bulunanlar);
    assert.notEqual(numarasiz.oturdu, true);
  });
});

describe('kutusuz kayıt', () => {
  it('numarasıyla balona oturur; numarası geçersizse gösterilmez', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    const kutusuz = (bolge, ceviri) => ({ x: 0, y: 0, g: 0, h: 0, tur: 'balon', bolge, orijinal: 'A', ceviri, kutusuz: true });
    const s = kutulariOturt(r, [kutusuz(2, 'iki'), kutusuz(9, 'yok')], bulunanlar);
    assert.deepEqual(s.map((b) => b.ceviri), ['iki']);
    assert.ok(piksel(s[0]).y0 > 360);
  });
});

describe('sahipsiz balon ve yersiz metin', () => {
  it('numarasız, balonu bulunamayan metin yakındaki sahipsiz balona gider', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    // 1 numaralı balon numaralı kayda gitti; ikinci metne model numara vermedi
    // ve kutusunu boş bir yere (çizim ortası) koydu. 2 numaralı balon sahipsiz.
    const s = kutulariOturt(r, [
      balon(0, 0, 1, 1, { bolge: 1, ceviri: 'bir', orijinal: 'ABCDEFGHI' }),
      balon(200, 250, 330, 300, { bolge: 0, ceviri: 'iki', orijinal: 'NE PODHODI' }),
    ], bulunanlar);
    const iki = s.find((b) => b.ceviri === 'iki');
    assert.equal(iki.oturdu, true);
    assert.ok(piksel(iki).y0 > 360, JSON.stringify(piksel(iki)));
  });

  it('harf sayısı balonla uyumsuz uzun metin sahipsiz balona taşınmaz', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    const uzun = 'BU CIZIMIN USTUNE YAZILMIS COK UZUN BIR ANLATIM METNIDIR VE BALONA SIGMAZ';
    const s = kutulariOturt(r, [
      balon(0, 0, 1, 1, { bolge: 1, ceviri: 'bir', orijinal: 'ABCDEFGHI' }),
      balon(200, 250, 330, 300, { bolge: 0, ceviri: 'uzun', orijinal: uzun }),
    ], bulunanlar);
    assert.notEqual(s.find((b) => b.ceviri === 'uzun').oturdu, true);
  });

  it('komşu balonun numarasını alıp onun kenarına düşen metin birleşmez, yanındaki çevirisiz dar balona gider', () => {
    // Kullanıcının Rusça sayfası: model dar balonun metnine yandaki anlatım
    // kutusunun numarasını verdi, kutusunu da onun sol kenarına koydu.
    const r = resim();
    balonCiz(r, 110, 140, 80, 60);
    yaziCiz(r, 70, 125, 150);
    yaziCiz(r, 75, 145, 145);
    balonCiz(r, 240, 150, 30, 55);
    for (let y = 125; y <= 165; y += 16) yaziCiz(r, 222, y, 260);
    const bulunanlar = balonlariBul(r);
    assert.equal(bulunanlar.length, 2);
    const s = kutulariOturt(r, [
      balon(70, 125, 150, 155, { bolge: 1, ceviri: 'bir', orijinal: 'ABCDEFGHIJKLMN' }),
      balon(150, 130, 185, 160, { bolge: 1, ceviri: 'iki', orijinal: 'NE PODHODI' }),
    ], bulunanlar);
    assert.equal(s.length, 2);
    assert.equal(s[0].ceviri, 'bir');
    const iki = s.find((b) => b.ceviri === 'iki');
    assert.equal(iki.oturdu, true);
    assert.ok(piksel(iki).x0 > 205, JSON.stringify(piksel(iki)));
  });
});

describe('balona karışan çizim lekeleri', () => {
  it('uzun metnin altındaki birkaç küçük leke yazı kutusunu uzatmaz, ayrı balon da sayılmaz', () => {
    const r = resim();
    balonCiz(r, 110, 140, 80, 60);
    yaziCiz(r, 70, 120, 150);
    yaziCiz(r, 75, 140, 145);
    // Alt ucu açık balonda kızın saçı gibi: 1-3 piksellik birkaç leke.
    for (const [x, y] of [[100, 182], [103, 185], [106, 188], [140, 180]]) {
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) boya(r, x + dx, y + dy, 20);
    }
    const b = balonlariBul(r);
    assert.equal(b.length, 1);
    assert.ok(b[0].yazi.y1 < 170, JSON.stringify(b[0].yazi));
  });
});

describe('büyük balonda çok kısa yazı', () => {
  it('delik oranı düşük ama harfleri sık olan kısa yazı balon sayılır; aynı oranda seyrek noktalar sayılmaz', () => {
    const r = resim();
    balonCiz(r, 200, 300, 90, 120);
    // "SAI...": beş harf, balonun %1'inden az yer kaplıyor.
    for (let i = 0; i < 5; i++) for (let y = 295; y < 306; y++) for (let dx = 0; dx < 7; dx++) boya(r, 176 + i * 10 + dx, y, 20);
    const b = balonlariBul(r);
    assert.equal(b.length, 1);
    const seyrek = resim();
    balonCiz(seyrek, 200, 300, 90, 120);
    for (let i = 0; i < 5; i++) for (let y = 260; y < 271; y++) for (let dx = 0; dx < 7; dx++) boya(seyrek, 140 + i * 30 + dx, y + (i % 2) * 60, 20);
    assert.equal(balonlariBul(seyrek).length, 0);
  });
});

describe('tırtıklı kenarlı balon', () => {
  it('kenardaki küçük lekeler kısa yazıyı seyrek göstermez; balon bulunur', () => {
    const r = resim();
    balonCiz(r, 200, 300, 90, 120);
    // Kısa yazı: iki satır, birkaç harf ("GLI / UMANI...").
    yaziCiz(r, 175, 285, 220);
    yaziCiz(r, 165, 305, 235);
    // Tırtıklı kenarın içe düşen minik lekeleri, yazıdan uzakta.
    for (const [x, y] of [[125, 230], [128, 380], [270, 220], [275, 385], [200, 190], [200, 410]]) boya(r, x, y, 20);
    const b = balonlariBul(r);
    assert.equal(b.length, 1);
    assert.ok(b[0].yazi.y0 > 260 && b[0].yazi.y1 < 340, JSON.stringify(b[0].yazi));
  });
});

describe('balona karışan çizim', () => {
  it('parçaları harf boyunda olmayan blok ayrı balon sayılmaz; beyaz zemin yalnızca yazının çevresi', () => {
    const r = resim();
    balonCiz(r, 150, 260, 90, 110);
    // Balonun üst kısmına çizilmiş bir baş: uzun çizgiler ve minik noktalar.
    for (const x of [110, 130, 150, 170]) for (let y = 170; y < 200; y++) for (let dx = 0; dx < 3; dx++) boya(r, x + dx, y, 20);
    for (const [x, y] of [[120, 210], [140, 212], [160, 210], [180, 212]]) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) boya(r, x + dx, y + dy, 20);
    for (let y = 250; y <= 310; y += 15) yaziCiz(r, 100, y, 200);
    const b = balonlariBul(r);
    assert.equal(b.length, 1, JSON.stringify(b.map((x) => x.kutu)));
    assert.ok(b[0].yazi.y0 > 230, JSON.stringify(b[0].yazi));
    assert.ok(b[0].kutu.y0 > 230, 'zemin çizimi örtmemeli: ' + JSON.stringify(b[0].kutu));
    assert.equal(b[0].elips, false);
  });
});

describe('OCR ile oturmuş metin', () => {
  it('OCR kutusu çevirisiz balona değiyorsa o balona yerleşir; balondan uzaksa olduğu gibi kalır', () => {
    const r = ikiBalon();
    const bulunanlar = balonlariBul(r);
    // Kullanıcının sayfası: numarasız metnin OCR kümesi balonun alt ucundan çizime taşmış.
    const s = kutulariOturt(r, [
      balon(0, 0, 1, 1, { bolge: 1, ceviri: 'bir', orijinal: 'ABCDEFGHI' }),
      balon(270, 420, 330, 520, { bolge: 0, ceviri: 'iki', orijinal: 'ABCDEFGHIJKL', ocrOturdu: true }),
      balon(20, 520, 120, 560, { bolge: 0, ceviri: 'uc', orijinal: 'ABCDEFGHIJKL', ocrOturdu: true }),
    ], bulunanlar);
    const iki = s.find((b) => b.ceviri === 'iki');
    assert.equal(iki.oturdu, true);
    assert.ok(piksel(iki).y1 < 450 && piksel(iki).x0 < 260, JSON.stringify(piksel(iki)));
    // Balonun tamamen içindeki OCR kutusu (yazı zaten yerinde) taşınmaz.
    const [ic] = kutulariOturt(r, [balon(250, 400, 330, 440, { bolge: 0, ceviri: 'ic', orijinal: 'ABCDEFGHIJKL', ocrOturdu: true })], bulunanlar);
    assert.equal(ic.ocrOturdu, true);
    assert.ok(Math.abs(piksel(ic).y0 - 400) < 1);
    const uc = s.find((b) => b.ceviri === 'uc');
    assert.equal(uc.ocrOturdu, true);
    assert.ok(Math.abs(piksel(uc).y0 - 520) < 1);
  });
});

describe('seyrek delikli beyaz alan', () => {
  it('tram/kumaş deseni gibi seyrek noktalar yazı sayılmaz; kalın kısa yazı ("!!") sayılır', () => {
    const r = resim();
    balonCiz(r, 110, 140, 70, 55);
    // 3x3 noktalar, 12 px arayla: yazı kutusunun ~%6'sı.
    for (let y = 105; y <= 165; y += 12) for (let x = 60; x <= 150; x += 12) {
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) boya(r, x + dx, y + dy, 20);
    }
    const sebepler = [];
    assert.equal(balonlariBul(r, (t) => sebepler.push(t.sebep)).length, 0);
    assert.ok(sebepler.some((s) => s.startsWith('seyrek')), sebepler.join());

    const iki = resim();
    balonCiz(iki, 110, 140, 40, 40);
    for (let y = 125; y < 150; y++) for (let x = 100; x < 107; x++) { boya(iki, x, y, 20); boya(iki, x + 11, y, 20); }
    assert.equal(balonlariBul(iki).length, 1);

    const nokta = resim();
    balonCiz(nokta, 110, 140, 40, 40);
    // İki küçük leke birbirinden uzak: kısa yazı değil.
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) { boya(nokta, 95 + dx, 120 + dy, 20); boya(nokta, 98 + dx, 150 + dy, 20); }
    assert.equal(balonlariBul(nokta).length, 0);
  });
});

describe('işaret yeri', () => {
  const temizMi = (r, i) => {
    for (let y = i.y - i.r; y <= i.y + i.r; y++) {
      for (let x = i.x - i.r; x <= i.x + i.r; x++) if (r.gri[y * G + x] < 190) return false;
    }
    return true;
  };
  const kesisir = (i, k) => i.x + i.r >= k.x0 && i.x - i.r <= k.x1 && i.y + i.r >= k.y0 && i.y - i.r <= k.y1;

  it('işaret beyaz balon içinde, hiçbir harfe ve yazı kutusuna değmeden, yazının üstünde', () => {
    const r = ikiBalon();
    for (const b of balonlariBul(r)) {
      assert.ok(b.isaret, 'işaret yeri bulunmalı');
      assert.ok(temizMi(r, b.isaret), JSON.stringify(b.isaret));
      assert.ok(!kesisir(b.isaret, b.yazi));
      assert.ok(b.isaret.y < b.yazi.y0, 'yazının üstünde');
    }
  });

  it('yazı balonun tepesine dayanmışsa işaret yazının üstüne değil altına gider', () => {
    const r = resim();
    balonCiz(r, 110, 140, 45, 70); // dar, uzun balon
    yaziCiz(r, 85, 80, 135); // ilk satır balonun tepesinde
    yaziCiz(r, 85, 95, 135);
    const [b] = balonlariBul(r);
    assert.ok(b && b.isaret, JSON.stringify(b));
    assert.ok(temizMi(r, b.isaret));
    assert.ok(b.isaret.y > b.yazi.y1, JSON.stringify({ isaret: b.isaret, yazi: b.yazi }));
  });
});
