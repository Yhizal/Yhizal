// Sahne motoru: Raster için tam renkli piksel çerçeve tamponu.
// Her terminal hücresi 1×2 piksel: "▀" karakteri, ön plan = üst piksel, arka plan = alt piksel.
// Saf fonksiyonlar: aynı (tema, kare, ilerleme) her zaman aynı görüntüyü verir; durum tutmaz.

export const SAHNE_W = 40; // piksel = hücre sütunu
export const SAHNE_R = 3; // hücre satırı → 6 piksel yükseklik
const H = SAHNE_R * 2;
const UST_YARIM = 0x2580; // ▀

const hex = h => parseInt(h.slice(1), 16);
const rgb = (r, g, b) => (r << 16) | (g << 8) | b;
const kanal = (c, s) => (c >> s) & 255;
export function karistir(a, b, t) {
  const k = s => Math.round(kanal(a, s) + (kanal(b, s) - kanal(a, s)) * t);
  return rgb(k(16), k(8), k(0));
}
// Deterministik gürültü: aynı girdi → aynı değer (parıltı, yıldız, kum tanesi).
const gurultu = (x, y) => {
  let n = (x * 374761393 + y * 668265263) >>> 0;
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

function tampon(w, h) {
  const fb = new Uint32Array(w * h);
  const nokta = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < w && y >= 0 && y < h && c !== undefined) fb[y * w + x] = c;
  };
  const al = (x, y) => fb[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  return { fb, nokta, al, w, h };
}

// Sprite: satır dizgeleri; harf → palet rengi, "." saydam.
function sprite(t, x0, y0, satirlar, palet) {
  satirlar.forEach((s, y) => [...s].forEach((ch, x) => { if (ch !== ".") t.nokta(x0 + x, y0 + y, palet[ch]); }));
}

// ── Temalar: arka plan (paralaks), sprite kareleri (sağa bakar), parçacıklar ──
const P = {
  clawd: { O: hex("#D97757"), S: hex("#B5583D"), E: hex("#1B1B1B") },
  araba: { R: hex("#FF3B3B"), G: hex("#9BD4F5"), K: hex("#151515"), k: hex("#8A8A8A"), W: hex("#FFF3B0") },
  tekne: { W: hex("#FFFFFF"), w: hex("#DCE6EE"), M: hex("#6B4423"), B: hex("#8B5A2B"), b: hex("#6E4520"), F: hex("#E53935") },
  ucak: { S: hex("#F2F5F8"), s: hex("#AEB8C4"), B: hex("#1E5AA8"), R: hex("#D32F2F"), p: hex("#C8C8C8") },
  roket: { W: hex("#F4F4F4"), w: hex("#BFC5CC"), R: hex("#E53935"), B: hex("#4FC3F7") },
};

export const SAHNELER = {
  Clawd: {
    w: 9,
    kare: [
      [".OOOOOOO.", "OOEOOOEOO", "OOEOOOEOO", "OOOOOOOOO", ".S.S.S.S."],
      [".OOOOOOO.", "OOEOOOEOO", "OOEOOOEOO", "OOOOOOOOO", "S.S.S.S.."],
    ],
    y: 1, palet: P.clawd,
    zemin(t, f) {
      const gokU = hex("#7EC8F2"), gokA = hex("#CBEBFB"), deniz = hex("#3B9BD8"), kopuk = hex("#E8F6FF");
      const kum = hex("#EBCB8E"), kumK = hex("#D4B072");
      for (let x = 0; x < t.w; x++) {
        for (let y = 0; y < 3; y++) t.nokta(x, y, karistir(gokU, gokA, y / 2));
        t.nokta(x, 3, (x + (f >> 1)) % 7 === 0 ? kopuk : deniz);
        for (let y = 4; y < H; y++) t.nokta(x, y, gurultu(x + (f >> 2), y) > 0.82 ? kumK : kum);
      }
      t.nokta(t.w - 6, 0, hex("#FFE27A")); t.nokta(t.w - 5, 0, hex("#FFE27A")); // güneş
    },
    iz(t, x, f) { for (let i = 1; i < Math.min(x, 14); i += 2) t.nokta(x - i, H - 1, karistir(hex("#C9A365"), t.al(x - i, H - 1), i / 14)); },
  },
  yarış: {
    w: 11,
    kare: [
      ["...RGGGR...", "RRRRRRRRRRW", ".KK....KK.."],
      ["...RGGGR...", "RRRRRRRRRRW", ".Kk....Kk.."],
    ],
    y: 3, palet: P.araba,
    zemin(t, f) {
      const cim = hex("#2E7D32"), cimA = hex("#3E9142"), asfalt = hex("#3A3D42"), serit = hex("#F2F2F2");
      for (let x = 0; x < t.w; x++) {
        t.nokta(x, 0, gurultu(x + f, 0) > 0.7 ? cimA : cim);
        t.nokta(x, 1, (Math.floor((x + f) / 2) % 2) ? hex("#B71C1C") : hex("#EEEEEE")); // bordür, arabadan koyu
        for (let y = 2; y < H; y++) t.nokta(x, y, asfalt);
        t.nokta(x, 2, (x + f) % 6 < 3 ? serit : asfalt);
      }
    },
    iz(t, x, f) { // egzoz dumanı
      for (let i = 1; i <= 6; i++) {
        const yy = 4 - ((f + i) % 3 === 0 ? 1 : 0); // tekerlek hizasında
        t.nokta(x - i, yy, karistir(hex("#C9CDD2"), t.al(x - i, yy), i / 6));
      }
    },
  },
  yelken: {
    w: 10,
    kare: [
      ["....F.....", "....MW....", "....MWW...", "....MWWW..", "BBBBBBBBB.", ".bBBBBBb.."],
      ["....F.....", "....MW....", "....MWw...", "....MWWw..", "BBBBBBBBB.", ".bBBBBBb.."],
    ],
    y: 0, palet: P.tekne,
    zemin(t, f) {
      const gokU = hex("#FFC98A"), gokA = hex("#9FD3F0"), deniz = hex("#1E6FB8"), denizA = hex("#2B86D1"), kopuk = hex("#E6F4FF");
      for (let x = 0; x < t.w; x++) {
        for (let y = 0; y < 4; y++) t.nokta(x, y, karistir(gokU, gokA, y / 3));
        t.nokta(x, 4, Math.sin((x + f) / 2.2) > 0.6 ? kopuk : denizA);
        t.nokta(x, 5, deniz);
      }
      for (const dx of [0, 1]) { t.nokta(t.w - 9 + dx, 0, hex("#FFF2B0")); t.nokta(t.w - 9 + dx, 1, hex("#FFD36B")); }
      const kus = t.w + 2 - ((f >> 1) % (t.w + 4)), kanat = (f >> 1) % 2 ? 1 : 0; // "v", kanat çırpar
      t.nokta(kus, 1, hex("#3A3A3A")); t.nokta(kus + 1, kanat, hex("#3A3A3A")); t.nokta(kus + 2, 1, hex("#3A3A3A"));
    },
    iz(t, x, f) { for (let i = 1; i <= 7; i++) t.nokta(x - i, 4, karistir(hex("#FFFFFF"), t.al(x - i, 4), Math.min(1, i / 7 + ((f + i) % 2) * 0.15))); },
  },
  uçuş: {
    w: 12,
    kare: [
      ["RR..........", "RRSSSSSSSSs.", ".SSSBBSSSSSS", "....RRR....."],
      ["RR..........", "RRSSSSSSSSsp", ".SSSBBSSSSSS", "....RRR....p"],
    ],
    y: 1, palet: P.ucak,
    zemin(t, f) {
      const gokU = hex("#3F8FD6"), gokA = hex("#A8D8F5"), bulut = hex("#FFFFFF"), bulutU = hex("#E4EEF6");
      for (let x = 0; x < t.w; x++) for (let y = 0; y < H; y++) t.nokta(x, y, karistir(gokU, gokA, y / (H - 1)));
      const tur = t.w + 4; // bulut kenardan çıkar, karşıdan girer; ikiye bölünmez
      for (const [bx, by, hiz] of [[5, 1, 1], [24, 0, 1], [16, 4, 2], [33, 3, 2]]) {
        const x = ((bx - Math.floor(f * hiz / 2)) % tur + tur) % tur - 3;
        for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, -1]]) t.nokta(x + dx, by + dy, hiz === 2 ? bulut : bulutU);
      }
    },
    iz(t, x, f) { for (let i = 1; i < Math.min(x, 10); i++) t.nokta(x - i, 3, karistir(hex("#D9E6F2"), t.al(x - i, 3), i / 10)); },
  },
  roket: {
    w: 10,
    kare: [
      ["RR........", ".WWWWWWRR.", ".WWBWWWRRR", "RR........"],
      ["RR........", ".wWWWWWRR.", ".wWBWWWRRR", "RR........"],
    ],
    y: 1, palet: P.roket,
    zemin(t, f) {
      const uzay = hex("#0B1026"), uzayA = hex("#1A1F4A");
      for (let x = 0; x < t.w; x++) for (let y = 0; y < H; y++) {
        t.nokta(x, y, karistir(uzay, uzayA, y / (H - 1)));
        const g = gurultu((x + (f >> 1)) % 97, y);
        if (g > 0.97) t.nokta(x, y, karistir(hex("#FFFFFF"), uzay, ((f + x) % 5) / 6)); // parıldayan yıldız
        else if (g > 0.93) t.nokta(x, y, hex("#5C648C"));                               // sönük, sabit yıldız
      }
    },
    iz(t, x, f) { // alev: sarı → turuncu → kırmızı, titreşir
      const alev = [hex("#FFF59D"), hex("#FFB300"), hex("#FF6D00"), hex("#D84315")];
      const boy = 4 + ((f >> 1) % 3);
      for (let i = 1; i <= boy; i++) for (const yy of [2, 3]) {
        const c = alev[Math.min(alev.length - 1, Math.floor((i - 1) * alev.length / boy))];
        if (gurultu(i + f, yy) > 0.15) t.nokta(x - i + 1, yy, c);
      }
    },
  },
};
export const SAHNE_ADLARI = Object.keys(SAHNELER);

// Dama bayrağı: 2 piksel geniş, kare kare dalgalanır.
function bayrak(t, f, bitti) {
  for (let y = 0; y < H; y++) for (let i = 0; i < 2; i++) {
    const dama = (y + i + (bitti ? 0 : f >> 2)) % 2 === 0;
    t.nokta(t.w - 2 + i, y, dama ? hex("#FFFFFF") : hex("#111111"));
  }
}
// Bitişte konfeti: deterministik renkli kıvılcımlar.
function konfeti(t, x0, f) {
  const renkler = [hex("#FFD54F"), hex("#4FC3F7"), hex("#F06292"), hex("#81C784")];
  for (let i = 0; i < 6; i++) {
    const g = gurultu(i * 13 + (f >> 1), i);
    t.nokta(x0 + Math.floor(g * 12) - 2, Math.floor(gurultu(i, f >> 1) * H), renkler[i % 4]);
  }
}

// Bir karenin piksel tamponu: ilerleme 0..1, bitti → araç bayrakta durur, yol durur.
export function sahneKaresi(ad, f, ilerleme, bitti, w = SAHNE_W) {
  const s = SAHNELER[ad] ?? SAHNELER.Clawd;
  const t = tampon(w, H);
  const akis = bitti ? 0 : f;
  s.zemin(t, akis);
  const x = Math.round(Math.max(0, Math.min(1, ilerleme)) * (w - 2 - s.w));
  if (!bitti) s.iz(t, x, f);
  if (bitti) konfeti(t, w - 2 - s.w, f); // sprite'ın altında kalsın
  sprite(t, x, s.y, s.kare[bitti ? 0 : (f >> 1) % 2], s.palet);
  bayrak(t, f, bitti);
  return t;
}

// Raster hücreleri: [codePoint, ön plan, arka plan] u32 üçlüleri, little-endian, base64.
export function hucreler(t) {
  const n = t.w * (t.h / 2);
  const u = new Uint32Array(n * 3);
  for (let r = 0; r < t.h / 2; r++) for (let x = 0; x < t.w; x++) {
    const i = (r * t.w + x) * 3;
    u[i] = UST_YARIM; u[i + 1] = t.al(x, r * 2); u[i + 2] = t.al(x, r * 2 + 1);
  }
  return base64(new Uint8Array(u.buffer));
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function base64(b) {
  let s = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < b.length ? B64[n & 63] : "=");
  }
  return s;
}
