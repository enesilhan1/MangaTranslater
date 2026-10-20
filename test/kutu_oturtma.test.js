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
