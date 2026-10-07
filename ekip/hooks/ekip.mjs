import { sahneKaresi, hucreler, SAHNE_W, SAHNE_R } from "./sahne.mjs";
import { svgSerit, svgDusunuyor, yuvarla } from "./svgsahne.mjs";
import { KURALLAR, ISCI_FORMAT, KADEME_EK, ESIK, UZMAN_MODEL, HIZLI_MODEL, modelSec, kademe, dosyaCakismalari, yogunMu, bayrak, t2Mi, brifIzinli, uyeTablosu, brifDogrula, brifMetni } from "./kurallar.mjs";

const P = "ekip";
const KOSULAR = { plugin: "ekip", key: "kosular" };
const DANISMAN = { plugin: "ekip", key: "danisman" };
const MOD = { plugin: "ekip", key: "mod" };
const FRAME = { plugin: "ekip", key: "frame" };
const AKTIF = { plugin: "ekip", key: "aktif" };
const SURUM = { plugin: "ekip", key: "surum" }; // ekip listesi değişince paneli yeniden çizdirir
const INCELEME = { plugin: "ekip", key: "incelemeId" };
const TASLAK = { plugin: "ekip", key: "taslak" };
const TUR = { plugin: "ekip", key: "tur" };
const ADIM_BELLEK = { plugin: "ekip", key: "adimBellek" };
const BRIFLER = { plugin: "ekip", key: "brifler" }; // bu turun ara brifleri: [{ no, uye, eylem, tetik, neden, zaman }]
const ORNEK_MAX = 40;
const PANE = "ekip";

// Takma adlar Claude Code tarafından her zaman ailenin en güncel sürümüne çözülür:
// yeni Fable/Opus çıkınca mod değişmeden onlara geçer.
// Üç kademe (kurallar.mjs, v0.9.0): Fable danışman, Opus uzman, Sonnet hızlı.
export const DANISMAN_MODEL = "fable";
export const ISCI_MODEL = UZMAN_MODEL;
export { HIZLI_MODEL };
export const DANISMAN_ADAYLAR = ["fable", "claude-fable-5-1", "opus"];
const MAX_TUR = 3; // Fable'ın kendi kendine atama turu üst sınırı (kota koruması)
const MAX_UYE = 5;
const ARAC_IZINLI = ["Read", "Grep", "Glob", "Edit", "Write", "Bash", "WebFetch", "WebSearch"];
const SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const MAX_KOSU = 30;

export const ROLLER = {
  danisman: {
    rol: "danisman", model: DANISMAN_MODEL, effort: "high",
    description: "Ekip danışmanı: mimari kararlar, plan, risk analizi ve ekip çıktılarının gözden geçirilmesi (STM32/HAL, Altium, ThingsBoard). Tasarım kararı gerektiğinde çağır.",
    prompt: `Sen gömülü sistemler ve yazılım mimarisi danışmanısın; ekibin lideri gibi düşün. Önce 3 maddelik özet, sonra gerekçe, sonra riskler ve sıradaki adımlar. Kod yazma; karar ver, görev dağıt, çıktıları denetle. Türkçe yaz.\n\n${KURALLAR}`,
    tools: ["Read", "Grep", "Glob"],
  },
  "firmware-analist": {
    rol: "isci", model: ISCI_MODEL, maxTurns: 25,
    description: "STM32 HAL/LL firmware analizi: clock, DMA/IRQ öncelikleri, ISR güvenliği, RTOS, güç modları.",
    prompt: "STM32 HAL/LL kodunu analiz et: clock tree, DMA/IRQ öncelikleri, ISR içinde blocking çağrı, HAL_Delay, RTOS stack, güç modları. Bulguları dosya:satır ve RM/datasheet referansıyla, ciddiyete göre sırala. Türkçe yaz.",
    tools: ["Read", "Grep", "Glob"],
  },
  "test-yazici": {
    rol: "isci", model: HIZLI_MODEL, maxTurns: 30, permissionMode: "acceptEdits",
    description: "Verilen modül için birim test yazar, çalıştırır ve sonucu özetler.",
    prompt: "Verilen modül için projenin test çerçevesiyle (Unity/CMocka/pytest...) birim test yaz, çalıştır, sonucu özetle. Mevcut testleri kırma; mevcut dosyada yalnız değişen bloğu düzenle. Türkçe özetle.",
    tools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
  },
  "kod-inceleyici": {
    rol: "isci", model: ISCI_MODEL, maxTurns: 15,
    description: "Değişiklikleri inceler: hata, yarış durumu, sınır koşulu, bellek ve ISR güvenliği.",
    prompt: "Değişiklikleri (git diff) incele: hata, yarış durumu, sınır koşulu, bellek, ISR güvenliği. Ciddiyete göre sıralı liste ver, dosya:satır belirt. Düzeltme yazma, bulgu ver. Türkçe yaz.",
    tools: ["Read", "Grep", "Glob", "Bash"],
  },
  "arayuz-gelistirici": {
    rol: "isci", model: ISCI_MODEL, maxTurns: 30, permissionMode: "acceptEdits",
    description: "ThingsBoard ve web dashboard arayüzü geliştirir: widget, telemetri, kullanıcı dostu UI.",
    prompt: "ThingsBoard widget/dashboard ve web arayüzü geliştir. Son kullanıcı deneyimini öncele; telemetri anahtarlarını cihaz tarafıyla uyumlu tut. Mevcut dosyada yalnız değişen bloğu düzenle. Türkçe özetle.",
    tools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
  },
  dokumantasyoncu: {
    rol: "isci", model: HIZLI_MODEL, maxTurns: 10,
    description: "README, Doxygen başlıkları ve modül dokümantasyonu üretir.",
    prompt: "Modül/README/Doxygen dokümantasyonu üret; projenin mevcut tarzını koru; kısa ve net yaz.",
    tools: ["Read", "Grep", "Glob", "Write"],
  },
  "hizli-isci": {
    rol: "isci", model: HIZLI_MODEL, maxTurns: 20, permissionMode: "acceptEdits",
    description: "Tarifi net, doğrulaması belli, alan bilgisi gerektirmeyen hızlı işler (≤3 dosya): mevcut desenle ekleme, format, tarama, özetleme.",
    prompt: "Verilen dar kapsamlı işi tarif edildiği gibi yap; mevcut deseni izle; mevcut dosyada yalnız değişen bloğu düzenle; bitiş ölçütünü çalıştırıp sonucu bildir.",
    tools: ["Read", "Grep", "Glob", "Edit", "Bash"],
  },
};
// Her işçinin talimatına kademe sınırı ve çıktı biçimi eklenir (kurallar.mjs §1, §4).
for (const r of Object.values(ROLLER)) if (r.rol === "isci") r.prompt += `\n\n${KADEME_EK[r.model]}\n${ISCI_FORMAT}`;

export const SABLON_EKIPLER = [
  { ad: "Firmware ekibi", amac: "STM32 firmware geliştirme, test ve inceleme", uyeler: ["danisman", "firmware-analist", "test-yazici", "kod-inceleyici", "hizli-isci"] },
  { ad: "Arayüz ekibi", amac: "ThingsBoard/dashboard arayüzü ve dokümantasyon", uyeler: ["danisman", "arayuz-gelistirici", "dokumantasyoncu", "hizli-isci"] },
  // Firmware olmayan projelerin öntanımlısı (ör. AR-GE Takip Platformu: FastAPI + React).
  { ad: "Yazılım ekibi", amac: "Kod geliştirme, inceleme, test ve belge — Fable yönetir", uyeler: ["danisman", "kod-inceleyici", "test-yazici", "dokumantasyoncu", "hizli-isci"] },
];

// OTOMATİK MOD (v0.8.0, 7 Eki 2026 — kullanıcı: "müdahale etmek istemiyorum, Fable yönetsin"):
// ekip projeye göre kendiliğinden seçilir, Fable'ın planı onay beklemeden başlar, panel
// yalnız izleme gösterir; elle yönetim tuşları "⚙ Elle yönet"in arkasında.
export const VARSAYILAN_EKIP = { firmware: "Firmware ekibi", yazilim: "Yazılım ekibi" };
/** Proje kökündeki adlardan firmware mı: CubeMX .ioc, PlatformIO, ya da Core + Drivers. */
export function firmwareMi(adlar) {
  const a = adlar.map(x => String(x).toLowerCase());
  return a.some(x => x.endsWith(".ioc") || x === "platformio.ini") || (a.includes("core") && a.includes("drivers"));
}
let elleAcik = false; // "⚙ Elle yönet" açık mı (oturum içi; yeniden yüklemede kapanır)

let aktifUyeler = new Set();
// Raster animasyonu: render'ın çizdiği canlı şeritler; saat bunları blit ile yeniden boyar.
const canli = new Map(); // key → { ad, ilerleme, bitti, bitis }
const svgIz = new Map(); // üye → { p, once }: SVG aracı önceki konumdan yenisine kaysın
let kareNo = 0;
let anim = null;
const ANIM_MS = 83; // ~12 kare/sn
const KONFETI_MS = 2500;
let ticker = null;
let seyrek = 0;
let svgYuzey = false; // son çizim uygulama yüzeyinde (SVG sahne) mi — çark seyrekleşir
// SADE: animasyon yok — sahne/şerit, spinner ve zamanlayıcılar kapalı; panel yalnız durum
// değişince (ajan başladı, adım attı, bitti) yeniden çizilir. Sakinleştirilmiş sahne de
// uygulama panelinde titremeyi sürdürdü (kullanıcı, 7 Eki 2026: "daha basit bir şey").
export const SADE = true;

export function sure(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export function tek(text, n) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}
export function kisaModel(m) {
  return String(m ?? "").replace(/^claude-/, "").replace(/-\d{8}$/, "");
}
// Fable'ın kurduğu ekiplerin üyeleri ekibin kendi "ozel" tanımlarında durur.
export function rolu(ekip, name) {
  return ekip?.ozel?.[name] ?? ROLLER[name];
}
export function spec(name, ekip) {
  const { rol, gorev, ...r } = rolu(ekip, name);
  return { name, ...r };
}

// İlerleme: alt ajanın adım sayısından, bitene kadar %95'i geçmeyen yumuşak eğri.
// Ajan tipi başına adım belleğinden aritmetik ortalama ve örneklem standart sapması.
export function istatistik(ornekler, alan) {
  const x = (ornekler ?? []).map(o => o[alan]).filter(Number.isFinite);
  const n = x.length;
  if (!n) return { n: 0, ort: 0, ss: 0 };
  const ort = x.reduce((a, b) => a + b, 0) / n;
  const ss = n > 1 ? Math.sqrt(x.reduce((a, b) => a + (b - ort) ** 2, 0) / (n - 1)) : 0;
  return { n, ort, ss };
}
// Ortalamaya kadar %0-85, sonra standart sapma ölçeğinde %95'e yaklaşır: geri gitmez, takılmaz.
function egri(x, ort, ss) {
  return x <= ort ? 0.85 * x / ort : 0.85 + 0.10 * (1 - Math.exp(-(x - ort) / Math.max(ss, ort * 0.15, 1)));
}
export function ilerleme(kosu, stat) {
  if (kosu.durum !== "calisiyor") return 1;
  const adim = kosu.adim ?? 0;
  const p = stat?.n >= 3 && stat.ort > 0 ? egri(adim, stat.ort, stat.ss) : 0.95 * (1 - Math.exp(-adim / 6));
  return Math.min(0.95, Math.max(0.04, p));
}

// ── Piksel motoru: yarım bloklarla her hücre 2 piksel; 2 satırlık şeritte 4 piksel yüksek çizim ──
// Emoji yok: her karakter tek sütun, yön her fontta sağa.
export function piksel(satirlar) {
  const g = Math.max(...satirlar.map(r => r.length));
  const hucre = (u, a) => (u && a ? "█" : u ? "▀" : a ? "▄" : " ");
  const on = (r, c) => satirlar[r]?.[c] === "#";
  return [0, 2].map(r => Array.from({ length: g }, (_, c) => hucre(on(r, c), on(r + 1, c))).join(""));
}

// kare: 4 satırlık piksel çizimleri (sağa bakar), adım adım değişir.
// gok/zemin: araç önündeki manzara (sola akar); iz: aracın arkasında kalan.
export const TEMALAR = [
  { ad: "Clawd", renk: "#D97757", kare: [
      [".#######.", "#########", "##.###.##", "##...##.."],
      [".#######.", "#########", "##.###.##", ".##...##."]],
    gok: [".", " ", " ", " ", " ", " ", " "], zemin: ["_", " ", ".", " "], izUst: " ", izAlt: ":", izRenk: "#D97757" },
  { ad: "yarış", renk: "red", kare: [
      ["..####....", ".#########", "##########", ".##....##."],
      ["..####....", ".#########", "##########", ".#.#..#.#."]],
    gok: [" ", " ", " ", " "], zemin: ["─", "─", " ", " "], izUst: " ", izAlt: "═", izRenk: "red" },
  { ad: "yelken", renk: "white", kare: [
      ["...##.....", "...####...", "#########.", ".#######.."],
      ["...##.....", "...###....", "#########.", ".#######.."]],
    gok: [" ", "v", " ", " ", " ", " "], zemin: ["~", "-", "~", " "], izUst: " ", izAlt: "~", izRenk: "cyan" },
  { ad: "uçuş", renk: "blue", kare: [
      [".#........", ".##.......", "##########", "....###..."],
      [".#........", ".##.......", "##########", ".....###.."]],
    gok: [" ", " ", ".", " ", " "], zemin: [" ", " ", " ", " "], izUst: " ", izAlt: "╌", izRenk: "blue" },
  { ad: "roket", renk: "yellow", kare: [
      ["##.......", ".#######.", ".########", "##......."],
      ["##.......", ".######..", ".########", "##......."]],
    gok: [".", " ", " ", " ", " "], zemin: [" ", " ", ".", " "], izUst: "-", izAlt: "=", izRenk: "red" },
];
const BAYRAK = [["▀▄", "▀▄"], ["▄▀", "▄▀"]];
export const SERIT_W = 26; // pist genişliği (bayrak hariç)
// Her üye farklı temada başlar; tema koşu başında seçilir ve koşu boyunca sabit kalır.
export function temaSec(i, t) {
  return TEMALAR[(i + Math.floor(t / 45_000)) % TEMALAR.length];
}

// İki satırlık şerit: { ust, alt } — her biri Text parça listesi, genişlik her durumda SERIT_W + 2.
export function serit(kosu, tema, frame, stat, W = SERIT_W) {
  const bitti = kosu.durum !== "calisiyor";
  const adim = Math.floor(frame / 2) % 2;
  const [ust, alt] = piksel(tema.kare[bitti ? 0 : adim]);
  const aw = ust.length;
  const pos = Math.round(ilerleme(kosu, stat) * (W - aw));
  const akis = bitti ? 0 : frame >> 1; // araç durunca yol da durur
  const manzara = (desen, bas, n) => Array.from({ length: n }, (_, i) => desen[(bas + i + akis) % desen.length]).join("");
  const iz = (ch, n) => (n > 0 ? ch.repeat(n) : "");
  const kalan = W - pos - aw;
  const renk = tema.renk; // bitişte de kimliğini korur; yeşil yalnız bayrakta
  const bayrak = BAYRAK[bitti ? 0 : adim];
  const parca = (izCh, sprite, desen, b) => [
    ...(pos > 3 ? [{ color: tema.izRenk, dimColor: true, children: iz(izCh, pos - 3) }] : []),
    ...(pos > 0 ? [{ color: tema.izRenk, children: iz(izCh, Math.min(3, pos)) }] : []),
    { color: renk, bold: true, children: sprite },
    ...(kalan > 0 ? [{ dimColor: true, children: manzara(desen, pos + aw, kalan) }] : []),
    { color: bitti ? "green" : "white", bold: bitti, children: b },
  ].filter(x => x.children !== "");
  return { ust: parca(tema.izUst, ust, tema.gok, bayrak[0]), alt: parca(tema.izAlt, alt, tema.zemin, bayrak[1]) };
}
// Danışman düşünürken: soldan sağa kayan tarayıcı ışık.
export function tarayici(frame, W = 16) {
  const p = frame % (2 * W - 2);
  const x = p < W ? p : 2 * W - 2 - p;
  return Array.from({ length: W }, (_, i) => (Math.abs(i - x) === 0 ? "●" : Math.abs(i - x) === 1 ? "•" : Math.abs(i - x) === 2 ? "∙" : "·")).join("");
}

export function jsonAl(text) {
  const m = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
export function adTemizle(s) {
  return String(s ?? "").toLowerCase().replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
}
// Fable'ın JSON planını güvenli bir ekip tanımına çevirir (ad, araç, üye sayısı sınırlı).
export function planDogrula(j) {
  if (!j || !Array.isArray(j.uyeler)) return null;
  const goruldu = new Set(["danisman"]);
  const uyeler = [];
  for (const u of j.uyeler.slice(0, MAX_UYE)) {
    const name = adTemizle(u?.ad);
    if (!name || goruldu.has(name) || !u.gorev) continue;
    goruldu.add(name);
    const tools = (Array.isArray(u.araclar) ? u.araclar : ["Read", "Grep", "Glob"]).filter(t => ARAC_IZINLI.includes(t));
    const model = modelSec(u.model); // danışmanın kademe kararı; tanınmayan → Opus
    uyeler.push({
      name, rol: "isci", model, maxTurns: 30,
      description: tek(u.aciklama || u.ad, 150),
      prompt: `${tek(u.talimat || u.aciklama || "", 1500)}\n\nMevcut dosyada yalnız değişen bloğu düzenle.\n${KADEME_EK[model]}\n${ISCI_FORMAT}`,
      tools: tools.length ? tools : ["Read", "Grep", "Glob"],
      ...(tools.some(t => t === "Edit" || t === "Write") ? { permissionMode: "acceptEdits" } : {}),
      gorev: tek(u.gorev, 1500) + (u.bitis_olcutu ? `\nBitiş ölçütü: ${tek(u.bitis_olcutu, 300)}` : ""),
      dosyalar: Array.isArray(u.dosyalar) ? u.dosyalar.map(String).slice(0, 20) : [],
      beklenenDk: Number(u.beklenen_sure_dk) > 0 ? Number(u.beklenen_sure_dk) : 0,
      bagimli: u.bagimli ? adTemizle(u.bagimli) : "",
    });
  }
  if (!uyeler.length) return null;
  // Bağımlılık yalnız plandaki başka bir üyeye olabilir (yoksa paralel başlar).
  for (const u of uyeler) if (u.bagimli === u.name || !uyeler.some(x => x.name === u.bagimli)) u.bagimli = "";
  const dosyaSayisi = new Set(uyeler.flatMap(u => u.dosyalar)).size;
  const yogun = yogunMu({ yogunluk: j.yogunluk, uyeSayisi: uyeler.length, dosyaSayisi, maxSureDk: Math.max(0, ...uyeler.map(u => u.beklenenDk)), turPlani: Number(j.tur_plani) || 1 });
  return { ad: tek(j.ad || "Fable ekibi", 40), amac: tek(j.amac || "", 120), uyeler, yogun, cakisma: dosyaCakismalari(uyeler) };
}
export function atamalar(j, ekip) {
  if (!j || !Array.isArray(j.sonraki)) return [];
  return j.sonraki
    .map(a => ({ uye: adTemizle(a?.uye), gorev: tek(a?.gorev, 1500) + (a?.bitis_olcutu ? `\nBitiş ölçütü: ${tek(a.bitis_olcutu, 300)}` : ""), ...(a?.model ? { model: modelSec(a.model) } : {}) }))
    .filter(a => a.gorev && a.uye !== "danisman" && ekip.uyeler.includes(a.uye))
    .slice(0, MAX_UYE);
}
export function durumu(kosular, uye) {
  return [...kosular].reverse().find(k => k.tip === `${P}:${uye}`) ?? null;
}
export function incelemePrompt(ekip, kosular) {
  const tipler = new Set(ekip.uyeler.map(u => `${P}:${u}`));
  const son = kosular.filter(k => k.durum !== "calisiyor" && tipler.has(k.tip) && k.tip !== `${P}:danisman`).slice(-6);
  if (!son.length) return null;
  return `"${ekip.ad}" ekibinin (${ekip.amac}) son çıktılarını danışman olarak gözden geçir. ` +
    "Her çıktı için: doğru mu, eksik/riskli ne var, sıradaki görev ne olmalı ve hangi üyeye verilmeli? Gerekirse kodu oku.\n\n" +
    son.map(k => `### ${k.tip.slice(P.length + 1)} (${k.durum}, ${sure((k.bitis ?? k.baslangic) - k.baslangic)}) — ${k.aciklama}\n${tek(k.cikti, 1800)}`).join("\n\n");
}

async function ekipler($) {
  const kayit = await $.store.get("ekipler");
  if (Array.isArray(kayit) && kayit.length) {
    // Sonradan eklenen şablonlar (ör. Yazılım ekibi) ve şablon üyeleri (ör. hizli-isci) eski kayıtlara da girsin.
    const eksik = SABLON_EKIPLER.filter(s => !kayit.some(x => x.ad === s.ad));
    const uyeEksik = s => s && s.uyeler.some(u => !kayit.find(x => x.ad === s.ad)?.uyeler.includes(u));
    if (!eksik.length && !SABLON_EKIPLER.some(uyeEksik)) return kayit;
    const tam = [...kayit.map(x => { const s = SABLON_EKIPLER.find(y => y.ad === x.ad);
      return s ? { ...x, uyeler: [...x.uyeler, ...s.uyeler.filter(u => !x.uyeler.includes(u))] } : x; }), ...eksik];
    await $.store.set("ekipler", tam);
    return tam;
  }
  await $.store.set("ekipler", SABLON_EKIPLER);
  return SABLON_EKIPLER;
}

// Etkin ekip PROJE başına tutulur (eskiden tek, global "aktif" vardı: bir web projesinde
// STM32 "Firmware ekibi" görünüyordu). Kayıt yoksa proje türünden seçilir.
let projeKlasoru = ""; // session.start'ın cwd'si (yeniden yüklemede session.start yine gelir)
const aktifAnahtari = async () => `aktif:${projeKlasoru}`;
async function varsayilanEkipAdi($) {
  try {
    const ogeler = await $.fs.list();
    return firmwareMi(ogeler.map(o => o.name)) ? VARSAYILAN_EKIP.firmware : VARSAYILAN_EKIP.yazilim;
  } catch {
    return VARSAYILAN_EKIP.yazilim;
  }
}

async function aktifEkip($) {
  const liste = await ekipler($);
  const ad = await $.store.get(await aktifAnahtari());
  const secili = liste.find(x => x.ad === ad);
  if (secili) return secili;
  const varsayilan = await varsayilanEkipAdi($);
  return liste.find(x => x.ad === varsayilan) ?? liste[0];
}

async function yukle($, ad) {
  const liste = await ekipler($);
  const ekip = liste.find(x => x.ad === ad) ?? liste[0];
  await $.store.set(await aktifAnahtari(), ekip.ad);
  aktifUyeler = new Set(ekip.uyeler);
  for (const u of ekip.uyeler) {
    if (!rolu(ekip, u)) continue;
    try { await $.agent.register(spec(u, ekip)); } catch (err) { $.ui.toast(`ekip: ${u} kaydedilemedi (${String(err).slice(0, 60)})`); }
  }
  await $.state.set(AKTIF, ekip.ad);
  return ekip;
}

async function kaydet($, liste) {
  await $.store.set("ekipler", liste);
  const { value: v = 0 } = await $.state.get(SURUM);
  await $.state.set(SURUM, v + 1);
}

function animasyon($) {
  if (anim || SADE) return;
  anim = $.clock.every(ANIM_MS, async () => {
    kareNo++;
    const { value: k = [] } = await $.state.get(KOSULAR);
    const simdi = Date.now();
    for (const [key, v] of canli) if (v.bitti && simdi - v.bitis > KONFETI_MS) canli.delete(key);
    if (!canli.size && !k.some(x => x.durum === "calisiyor")) { anim?.cancel?.(); anim = null; return; }
    const { value: ab = {} } = await $.state.get(ADIM_BELLEK);
    for (const [key, v] of canli) {
      const kosu = durumu(k, v.uye);
      if (kosu) {
        const bitti = kosu.durum !== "calisiyor";
        if (bitti && !v.bitti) v.bitis = simdi;
        v.bitti = bitti;
        v.ilerleme = ilerleme(kosu, istatistik(ab[kosu.tip], "s"));
      }
      const r = await $.ui.blit({ requestId: PANE, key, cells: hucreler(sahneKaresi(v.ad, kareNo, v.ilerleme, v.bitti)), columns: SAHNE_W, rows: SAHNE_R });
      if (r?.deny) canli.delete(key); // panel kapalı ya da yeniden çizildi: render yeniden ekler
    }
  });
}

function cark($) {
  if (ticker || SADE) return;
  ticker = $.clock.every(150, async () => {
    const { value: k = [] } = await $.state.get(KOSULAR);
    const { value: taslak = null } = await $.state.get(TASLAK);
    const { value: tur = null } = await $.state.get(TUR);
    const { value: dan = null } = await $.state.get(DANISMAN);
    const hareket = k.some(x => x.durum === "calisiyor") || taslak?.durum === "hazirlaniyor" ||
      tur?.durum === "degerlendiriliyor" || dan?.durum === "bekliyor";
    if (!hareket) { ticker?.cancel?.(); ticker = null; return; }
    // Raster şeritleri blit ile canlı; tam yeniden çizimi yalnız yazı spinner'ları için seyrek yap (~1.6 Hz).
    // Uygulama yüzeyinde (SVG) sahneyi uygulama oynatır; panel yalnız süre/yüzde yazıları için
    // saniyede bir çizilir — 150 ms'lik tam çizim paneli titretiyordu (7 Eki 2026).
    if ((canli.size || svgYuzey) && ++seyrek % (svgYuzey ? 7 : 4)) return;
    const { value: f = 0 } = await $.state.get(FRAME);
    await $.state.set(FRAME, f + 1);
  });
}

// Danışman çağrısı: en güncel Fable takma adı, olmazsa sabit sürüm, o da olmazsa Opus.
async function fable($, istek) {
  let son = { isAnswered: false, reason: "model yok" };
  for (const model of DANISMAN_ADAYLAR) {
    try {
      const r = await $.model.complete({ ...istek, model });
      if (r.isAnswered || r.reason === "aborted") return { ...r, model };
      son = r;
    } catch (err) { son = { isAnswered: false, reason: String(err).slice(0, 120) }; }
  }
  return son;
}
const notu = r => (r.model && r.model !== DANISMAN_MODEL ? { not: `fable erişilemedi, ${r.model} kullanıldı` } : {});

async function sor($, soru) {
  const ekip = await aktifEkip($);
  await $.state.set(DANISMAN, { soru, durum: "bekliyor" });
  cark($);
  const r = await fable($, {
    system: `${ROLLER.danisman.prompt}\n\nAktif ekip: ${ekip.ad} — ${ekip.amac}. Üyeler: ${ekip.uyeler.join(", ")}.`,
    prompt: soru, maxTokens: 1500, timeoutMs: 120_000,
  });
  await $.state.set(DANISMAN, r.isAnswered
    ? { soru, cevap: r.text.slice(0, 9000), durum: "bitti", ...notu(r) }
    : { soru, cevap: `Cevap alınamadı: ${r.reason}`, durum: "hata" });
}

const KULLANICI = "Kullanıcı EMELEC AR-GE'de; donanım (STM32/HAL, Altium, ThingsBoard) ve AR-GE Takip Platformu (FastAPI + React, SharePoint köprüsü) üzerinde çalışır. Türkçe, kısa ve tablolu rapor ister; ekibe müdahale etmek istemez — kararları sen (Fable) ver. Token tasarrufu ve diff disiplini önemli.";
const KUR_SISTEM = `Sen ekip kurucu danışmansın. Kullanıcının hedefine göre en fazla ${MAX_UYE} işçi ajanlı bir ekip tasarla, işi kurallara göre çekirdek (Opus) + hızlı (Sonnet) parçalara böl ve her üyeye ilk somut görevini ata. ${KULLANICI}

${KURALLAR}

Yalnız JSON döndür, başka metin yazma:
{"ad":"Ekip adı","amac":"tek cümle","yogunluk":"basit|yogun","tur_plani":1,"uyeler":[{"ad":"kisa-ad","model":"opus|sonnet","aciklama":"ne zaman çağrılır","talimat":"üyenin kalıcı sistem talimatı","araclar":["Read","Grep","Glob","Edit","Write","Bash","WebFetch","WebSearch" içinden gerekenler],"gorev":"ilk görev: tam dosya yolu ve blok","bitis_olcutu":"doğrulama komutu/ölçütü (boş olamaz)","dosyalar":["değişecek dosyalar"],"beklenen_sure_dk":5,"bagimli":"önce bitmesi gereken üye adı ya da boş"}]}`;
const DEGER_SISTEM = `Sen ekibin danışmanısın. İşçilerin bu turdaki çıktılarını değerlendir; hedef tamamlanmadıysa sıradaki görevleri ata ve her görevin modelini kurallara göre seç. ${KULLANICI}

${KURALLAR}

"degerlendirme" alanı: iş yoğunsa §4'teki yoğun rapor (Sonuç, Karşılaştırma tablosu, Bulgular, Açık uçlar; üye tablosunu YAZMA, telemetriden eklenir), basitse ≤5 satır düz metin. Son satır: "Karar: devam|bitir — <tek satır gerekçe>".
Yalnız JSON döndür: {"degerlendirme":"markdown","bitti":true|false,"yogunluk":"basit|yogun","sonraki":[{"uye":"üye adı","model":"opus|sonnet","gorev":"somut görev","bitis_olcutu":"..."}]}`;
const BRIF_SISTEM = `Sen ekibin danışmanısın; iş sürerken ara brif kararı veriyorsun (§5). Tetikleyici gerçekten yönü etkilemiyorsa brif verme: {"brif":false}. Verirsen tek üyeye, ≤6 satırlık içerikle. ${KULLANICI}

${KURALLAR}

Yalnız JSON döndür: {"brif":true,"hedef_uye":"koşan üye adı","tetikleyici":"T1|T2|T3|T4","eylem":"yon|durdur|yeniden_ata","neden":"...","yeni_hedef":"...","dokunma":["yol"],"bitis_olcutu":"...","yeni_model":"opus|sonnet (yalnız yeniden_ata)","yeni_gorev":"(yalnız yeniden_ata)"}`;

async function kur($, hedef) {
  await $.state.set(TASLAK, { durum: "hazirlaniyor", hedef });
  cark($);
  let r = await fable($, { system: KUR_SISTEM, prompt: `Hedef: ${hedef}`, maxTokens: 3500, timeoutMs: 180_000 });
  let taslak = r.isAnswered ? planDogrula(jsonAl(r.text)) : null;
  // Aynı dosya iki üyede: plan bir kez danışmana geri verilir (§2 bölme kuralı).
  if (taslak?.cakisma.length) {
    const not = taslak.cakisma.map(c => `${c.dosya}: ${c.a} ve ${c.b}`).join("; ");
    const r2 = await fable($, { system: KUR_SISTEM, prompt: `Hedef: ${hedef}\n\nÖnceki planında aynı dosya iki üyeye verilmiş (${not}). Dosyayı tek üyeye ver, öbürü salt okusun ya da bagimli olsun; planı yeniden yaz.`, maxTokens: 3500, timeoutMs: 180_000 });
    const t2 = r2.isAnswered ? planDogrula(jsonAl(r2.text)) : null;
    if (t2) { taslak = t2; r = r2; }
  }
  await $.state.set(TASLAK, taslak
    ? { durum: "hazir", hedef, ...taslak, ...notu(r) }
    : { durum: "hata", hedef, hata: r.isAnswered ? "Fable'ın planı okunamadı; hedefi biraz daha somut yaz." : `Fable'a ulaşılamadı: ${r.reason}` });
  // Otomatik mod: plan onay beklemez, üyeler hemen başlar (elle yönetimde onay düğmesi kalır).
  if (taslak && !elleAcik) await onayla($);
}

async function onayla($) {
  const { value: taslak = null } = await $.state.get(TASLAK);
  if (taslak?.durum !== "hazir") return;
  const liste = await ekipler($);
  let ad = taslak.ad;
  for (let n = 2; liste.some(x => x.ad === ad); n++) ad = `${taslak.ad} ${n}`;
  const ozel = Object.fromEntries(taslak.uyeler.map(({ gorev, dosyalar, beklenenDk, bagimli, ...u }) => [u.name, u]));
  const ekip = { ad, amac: taslak.amac, hedef: taslak.hedef, oto: true, uyeler: ["danisman", ...taslak.uyeler.map(u => u.name)], ozel };
  await kaydet($, [...liste, ekip]);
  await yukle($, ad);
  await $.state.set(TASLAK, null);
  await $.state.set(BRIFLER, []);
  // Bağımlı üyeler, bağlı oldukları üye bitince başlar (turn.complete).
  const bekleyen = taslak.uyeler.filter(u => u.bagimli).map(u => ({ uye: u.name, gorev: u.gorev, model: u.model, beklenenDk: u.beklenenDk, bagimli: u.bagimli }));
  await $.state.set(TUR, { no: 1, durum: "calisiyor", yogun: Boolean(taslak.yogun), bekleyen });
  for (const u of taslak.uyeler.filter(u => !u.bagimli)) await baslat($, u.name, u.gorev, 1, { model: u.model, beklenenDk: u.beklenenDk, yogun: taslak.yogun });
  if (taslak.yogun) izlemeyiBaslat($);
  const sonnet = taslak.uyeler.filter(u => u.model === HIZLI_MODEL).length;
  $.ui.toast(`◆ ${ad}: Fable ${taslak.uyeler.length} üyeye görev atadı (${taslak.uyeler.length - sonnet} Opus, ${sonnet} Sonnet${taslak.yogun ? " · yoğun iş: ara brif + tablolu rapor" : ""})`);
}

// ── Ara brif (§5): yalnız yoğun işte; T1 üye bitti/diğerleri sürüyor, T2 süre/adım aşımı, T3 bayrak ──
let izleme = null;
const t2Gidenler = new Set(); // "tur:uye"
function izlemeyiBaslat($) {
  if (izleme) return;
  izleme = $.clock.every(ESIK.IZLEME_MS, async () => {
    const { value: tur = null } = await $.state.get(TUR);
    if (!tur?.yogun || tur.durum !== "calisiyor") { izleme?.cancel?.(); izleme = null; return; }
    const { value: k = [] } = await $.state.get(KOSULAR);
    const { value: br = [] } = await $.state.get(BRIFLER);
    for (const kosu of k.filter(x => x.tur === tur.no && x.durum === "calisiyor")) {
      const uye = kosu.tip.slice(P.length + 1);
      if (t2Mi(kosu, { brifSayisi: br.filter(b => b.uye === uye).length, t2Gitti: t2Gidenler.has(`${tur.no}:${uye}`) })) {
        t2Gidenler.add(`${tur.no}:${uye}`);
        await araBrif($, "T2", kosu);
        return; // bir dakikada en fazla bir brif
      }
    }
  });
}

export async function araBrif($, tetik, kaynak) {
  const { value: tur = null } = await $.state.get(TUR);
  if (!tur?.yogun || tur.durum !== "calisiyor") return;
  const { value: br = [] } = await $.state.get(BRIFLER);
  if (br.length >= ESIK.BRIF_MAX_TUR) return;
  const { value: k = [] } = await $.state.get(KOSULAR);
  const kosan = k.filter(x => x.tur === tur.no && x.durum === "calisiyor");
  if (!kosan.length) return;
  const ad = x => x.tip.slice(P.length + 1);
  const durumlar = kosan.map(x => `- ${ad(x)} (${kademe(x.model)}, ${x.adim ?? 0} adım, ${sure(Date.now() - x.baslangic)}${x.beklenenDk ? ` / beklenen ${x.beklenenDk} dk` : ""}): ${x.aciklama}`).join("\n");
  const son15 = String(kaynak?.cikti ?? "").split("\n").slice(-15).join("\n");
  const r = await fable($, {
    system: BRIF_SISTEM, maxTokens: 800, timeoutMs: 90_000,
    prompt: `Tetikleyici: ${tetik}${kaynak ? ` — kaynak üye ${ad(kaynak)} (${kaynak.durum})` : ""}. Tur ${tur.no}.\n\nKoşan üyeler:\n${durumlar}\n\n` +
      (son15 ? `Kaynak üyenin son çıktısı:\n${son15}\n\n` : "") +
      (br.length ? `Bu turdaki önceki brifler:\n${br.map(b => `#${b.no} → ${b.uye} (${b.eylem}): ${b.neden}`).join("\n")}` : "Bu turda henüz brif yok."),
  });
  const b = r.isAnswered ? brifDogrula(jsonAl(r.text), kosan.map(ad)) : null;
  if (!b) return;
  const hedef = kosan.find(x => ad(x) === b.uye);
  const oncekiler = br.filter(x => x.uye === b.uye);
  if (!brifIzinli(hedef, tetik, { brifSayisi: oncekiler.length })) return;
  if (b.eylem === "yeniden_ata" && oncekiler.filter(x => x.eylem === "yeniden_ata").length >= ESIK.YENIDEN_ATA_MAX) b.eylem = "durdur";
  const no = br.length + 1;
  const g = await $.session.send({ to: { agentId: hedef.id }, text: brifMetni(no, b) });
  if (g?.deny) { $.ui.toast(`ekip: brif #${no} ${b.uye}'e gitmedi — ${String(g.deny).slice(0, 60)}`); return; }
  await $.state.set(BRIFLER, [...br, { no, uye: b.uye, eylem: b.eylem, tetik, neden: b.neden, zaman: Date.now() }]);
  if (b.eylem === "yeniden_ata") await baslat($, b.uye, b.yeniGorev, tur.no, { model: b.yeniModel, yogun: true });
  $.ui.toast(`◆ Brif #${no} → ${b.uye} (${b.eylem === "yon" ? "yön" : b.eylem === "durdur" ? "durdur" : `yeniden ata: ${kademe(b.yeniModel)}`}): ${tek(b.neden, 60)}`);
}

// Bir üye bitince: ona bağlı bekleyenler başlar; yoğun işte diğerleri sürüyorsa danışman ara brif
// kararı verir (T3 bayrak, yoksa T1); hiçbiri kalmadıysa tur değerlendirmesi.
/** Biten üyeden sonra ne olur (saf): açılan bağımlılar, kalan bekleyenler, ara brif tetikleyicisi. */
export function turAdimi(tur, kosular, kosu, ad) {
  if (tur?.no !== kosu.tur || tur.durum !== "calisiyor") return { acilan: [], bekleyen: tur?.bekleyen ?? [], tetik: null };
  const acilan = (tur.bekleyen ?? []).filter(b => b.bagimli === ad).map(b => ({ ...b, gorev: `${b.gorev}\n\n${ad} çıktısı:\n${tek(kosu.cikti, 1200)}` }));
  const surenVar = kosular.some(x => x.tur === tur.no && x.durum === "calisiyor" && x.id !== kosu.id);
  return { acilan, bekleyen: (tur.bekleyen ?? []).filter(b => b.bagimli !== ad), tetik: tur.yogun && surenVar ? (bayrak(kosu.cikti) ? "T3" : "T1") : null };
}
async function turIlerle($, kosu, ad) {
  const { value: tur = null } = await $.state.get(TUR);
  const { value: k = [] } = await $.state.get(KOSULAR);
  const a = turAdimi(tur, k, kosu, ad);
  if (a.acilan.length) {
    await $.state.set(TUR, { ...tur, bekleyen: a.bekleyen });
    for (const b of a.acilan) await baslat($, b.uye, b.gorev, tur.no, { model: b.model, beklenenDk: b.beklenenDk, yogun: tur.yogun });
  }
  if (a.tetik) await araBrif($, a.tetik, kosu);
  await turBitti($, kosu.tur);
}

// Tur bitince Fable çıktıları değerlendirir ve sıradaki görevleri kendisi atar.
async function turBitti($, no) {
  const { value: k = [] } = await $.state.get(KOSULAR);
  const { value: tur = null } = await $.state.get(TUR);
  if (!tur || tur.no !== no || tur.durum !== "calisiyor") return;
  if (k.some(x => x.tur === no && x.durum === "calisiyor") || tur.bekleyen?.length) return;
  const ekip = await aktifEkip($);
  if (!ekip.oto) return;
  const yogun = Boolean(tur.yogun);
  await $.state.set(TUR, { ...tur, durum: "degerlendiriliyor" });
  await $.state.set(DANISMAN, { soru: `Tur ${no} değerlendirmesi`, durum: "bekliyor" });
  cark($);
  const { value: br = [] } = await $.state.get(BRIFLER);
  const buTur = k.filter(x => x.tur === no);
  const ciktilar = buTur
    .map(x => `### ${x.tip.slice(P.length + 1)} (${kademe(x.model)}, ${x.durum}, ${x.adim ?? 0} adım, ${sure((x.bitis ?? Date.now()) - x.baslangic)}) — ${x.aciklama}\n${tek(x.cikti, 1800)}`).join("\n\n");
  const r = await fable($, {
    system: DEGER_SISTEM, maxTokens: 3000, timeoutMs: 180_000,
    prompt: `Ekip: ${ekip.ad}. Hedef: ${ekip.hedef ?? ekip.amac}. Üyeler: ${ekip.uyeler.filter(u => u !== "danisman").join(", ")}. Tur ${no}/${MAX_TUR}. İş: ${yogun ? "yoğun" : "basit"}.` +
      (br.length ? `\nBu turdaki brifler: ${br.map(b => `#${b.no} → ${b.uye} (${b.eylem})`).join(", ")}.` : "") + `\n\n${ciktilar}`,
  });
  const j = r.isAnswered ? jsonAl(r.text) : null;
  const yogunSonra = yogun || j?.yogunluk === "yogun"; // yükseltilebilir, düşürülemez (§3)
  const { value: simdi = null } = await $.state.get(TUR);
  const sonraki = atamalar(j, ekip);
  const son = simdi?.durum === "durduruldu" || j?.bitti || !sonraki.length || no >= MAX_TUR;
  // Yoğun işte rapor: üye tablosu telemetriden, gerisi danışmandan (§4).
  const metin = r.isAnswered ? String(j?.degerlendirme ?? r.text) : `Değerlendirme alınamadı: ${r.reason}`;
  await $.state.set(DANISMAN, {
    soru: son ? `${yogunSonra ? "Son rapor" : "Sonuç"} — ${ekip.ad}` : `Tur ${no} değerlendirmesi`, durum: r.isAnswered ? "bitti" : "hata", ...notu(r),
    cevap: (yogunSonra && r.isAnswered ? `**Üye tablosu**\n\n${uyeTablosu(buTur, br)}\n\n${metin}` : metin).slice(0, 9000),
  });
  if (son) {
    if (simdi?.durum !== "durduruldu") await $.state.set(TUR, { no, durum: "bitti", yogun: yogunSonra });
    $.ui.toast(j?.bitti ? `🏁 ${ekip.ad}: Fable hedefi tamamlandı saydı${yogunSonra ? " — son rapor panelde" : ""}` : `◆ ${ekip.ad}: tur ${no} bitti, yeni atama yok`);
    return;
  }
  await $.state.set(TUR, { no: no + 1, durum: "calisiyor", yogun: yogunSonra, bekleyen: [] });
  await $.state.set(BRIFLER, []);
  for (const a of sonraki) await baslat($, a.uye, a.gorev, no + 1, { model: a.model, yogun: yogunSonra });
  if (yogunSonra) izlemeyiBaslat($);
  $.ui.toast(`◆ Fable tur ${no + 1} için ${sonraki.length} görev atadı`);
}

async function kosuEkle($, id, tip, aciklama, model, tur, beklenenDk) {
  const { value: k = [] } = await $.state.get(KOSULAR);
  if (k.some(x => x.id === id)) return;
  const kosu = { id, tip, aciklama: tek(aciklama, 50), model, baslangic: Date.now(), durum: "calisiyor", adim: 0, ...(tur ? { tur } : {}), ...(beklenenDk ? { beklenenDk } : {}) };
  await $.state.set(KOSULAR, [...k, kosu].slice(-MAX_KOSU));
  cark($);
  animasyon($);
}

// $.agent.spawn kendi agent.spawn hook'umuzdan geçmez: koşuyu burada elle kaydet.
// o.model: danışmanın bu görev için seçtiği kademe (yoksa rolün modeli); o.yogun: işçi tablolu biçimde raporlar.
export async function baslat($, uye, gorev, tur, o = {}) {
  const prompt = `${o.yogun ? "[YOĞUN] " : ""}${gorev}`;
  const r = await $.agent.spawn({ subagentType: `${P}:${uye}`, prompt, description: tek(gorev, 40), ...(o.model ? { model: o.model } : {}) });
  if (r.deny) $.ui.toast(`ekip: ${uye} başlatılamadı — ${r.deny}`);
  else if (r.agentId) await kosuEkle($, r.agentId, `${P}:${uye}`, gorev, r.model ?? o.model, tur, o.beklenenDk);
  return r;
}

export function register(on) {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    projeKlasoru = String(r?.cwd ?? e.cwd ?? "");
    ticker?.cancel?.();
    ticker = null;
    anim?.cancel?.();
    anim = null;
    canli.clear();
    izleme?.cancel?.();
    izleme = null;
    try { const { value: t = null } = await $.state.get(TUR); if (t?.yogun && t.durum === "calisiyor") izlemeyiBaslat($); } catch {}
    await $.command.register({ name: "ekip", description: "Ajan ekibi panelini aç", argumentHint: "[sor <soru> | kur <hedef> | kurallar]" });
    try {
      const b = await $.store.get("adimBellek");
      if (b && typeof b === "object") await $.state.set(ADIM_BELLEK, b);
    } catch {}
    try { await yukle($, (await aktifEkip($)).ad); } catch (err) { $.ui.toast(`ekip yüklenemedi: ${String(err).slice(0, 80)}`); }
    return r;
  });

  on("command.run", { command: "ekip" }, async ($, e) => {
    const args = String(e.args ?? "").trim();
    await $.ui.open({ id: PANE, title: "Ajan Ekibi", focus: true, closeOnEscape: true });
    animasyon($);
    if (/^sor\s+/i.test(args)) { void sor($, args.replace(/^sor\s+/i, "")); return { text: "Soru danışmana gitti; cevap panelde." }; }
    if (/^kur\s+/i.test(args)) { void kur($, args.replace(/^kur\s+/i, "")); return { text: "Fable ekibi tasarlıyor; plan onay beklemeden başlar, ilerleme panelde." }; }
    if (/^kurallar\b/i.test(args)) { await $.state.set(DANISMAN, { soru: "Ekip kuralları v2", cevap: KURALLAR, durum: "bitti" }); return { text: KURALLAR }; }
    return { text: "Ajan ekibi paneli açıldı." };
  });

  // Aktif ekipte olmayan üyeleri ana modelden gizle (unregister API'si yok).
  on("agent.offer", async ($, e, next) => {
    if (e.agent.startsWith(`${P}:`) && !aktifUyeler.has(e.agent.slice(P.length + 1))) return { isOffered: false };
    return next(e);
  });

  on("agent.spawn", async ($, e, next) => {
    const r = await next(e);
    if (r.agentId) await kosuEkle($, r.agentId, e.subagentType || "genel", e.description || e.prompt, r.model);
    return r;
  });

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (!e.agentId) return r;
    const { value: k = [] } = await $.state.get(KOSULAR);
    const i = k.findIndex(x => x.id === e.agentId);
    if (i < 0) return r;
    const durum = e.isAborted ? "iptal" : e.reason && e.reason !== "answer" ? "hata" : "bitti";
    const kosu = { ...k[i], durum, bitis: Date.now(), cikti: String(e.answer ?? "").slice(0, 4000) };
    await $.state.set(KOSULAR, k.map((x, j) => (j === i ? kosu : x)));
    if (durum === "bitti" && (kosu.adim ?? 0) > 0) {
      const { value: b = {} } = await $.state.get(ADIM_BELLEK);
      const yeni = { ...b, [kosu.tip]: [...(b[kosu.tip] ?? []), { s: kosu.adim, d: kosu.bitis - kosu.baslangic }].slice(-ORNEK_MAX) };
      await $.state.set(ADIM_BELLEK, yeni);
      await $.store.set("adimBellek", yeni);
    }
    const ad = kosu.tip.startsWith(`${P}:`) ? kosu.tip.slice(P.length + 1) : kosu.tip;
    $.ui.toast(`${durum === "bitti" ? "✔" : "✖"} ${ad} ${durum} (${sure(kosu.bitis - kosu.baslangic)})`);
    const { value: inc = null } = await $.state.get(INCELEME);
    if (inc === e.agentId) {
      await $.state.set(DANISMAN, { soru: "Ekip çıktılarını incele", cevap: kosu.cikti, durum: durum === "bitti" ? "bitti" : "hata" });
      await $.state.set(INCELEME, null);
    }
    if (kosu.tur) void turIlerle($, kosu, ad).catch(err => $.ui.toast(`ekip: tur akışı hatası — ${String(err).slice(0, 80)}`));
    return r;
  });

  on("turn.step", async function* ($, e, next) {
    const r = yield* next(e);
    if (!e.agentId) return r;
    const { value: k = [] } = await $.state.get(KOSULAR);
    if (k.some(x => x.id === e.agentId && x.durum === "calisiyor"))
      await $.state.set(KOSULAR, k.map(x => (x.id === e.agentId ? { ...x, adim: e.index + 1 } : x)));
    return r;
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input, Select, Markdown, Raster, Svg } = $.ui.resolve(e);
    const { value: kosular = [] } = await $.state.get(KOSULAR);
    const { value: dan = null } = await $.state.get(DANISMAN);
    const { value: mod = null } = await $.state.get(MOD);
    const { value: frame = 0 } = await $.state.get(FRAME);
    const { value: taslak = null } = await $.state.get(TASLAK);
    const { value: tur = null } = await $.state.get(TUR);
    const { value: adimBellek = {} } = await $.state.get(ADIM_BELLEK);
    const { value: brifler = [] } = await $.state.get(BRIFLER);
    await $.state.get(SURUM);
    const liste = await ekipler($);
    const ekip = await aktifEkip($);
    // Sade modda her genişlikte tek satırlık özet (şerit/sahne yok), spinner yerine sabit nokta.
    const genis = !SADE && (e.props.bodyColumns ?? 80) >= 88;
    const spin = SADE ? "●" : SPIN[frame % SPIN.length];
    const calisan = kosular.filter(k => k.durum === "calisiyor").length;
    const modAyarla = m => void $.state.set(MOD, m);
    const girisVar = Boolean(Input && Select);

    // Geniş panelde her üye 2 satırlık bir şerit: üstte ad + gökyüzü, altta model + zemin.
    // Dar panelde (ya da mobilde) tek satırlık özet.
    const SW = SERIT_W + 2;
    const raster = !SADE && Boolean(Raster) && e.surface === "terminal" && (e.props.bodyColumns ?? 80) >= 90;
    const svg = !SADE && Boolean(Svg) && !raster; // Claude Code uygulaması (masaüstü, web, VS Code, mobil): animasyonu uygulama oynatır
    svgYuzey = svg;
    const uyeSatiri = (u, i) => {
      const k = durumu(kosular, u);
      const r = rolu(ekip, u) ?? { model: "?", rol: "isci" };
      const dan_ = r.rol === "danisman";
      const gecen = k ? sure((k.bitis ?? Date.now()) - k.baslangic) : "";
      const stat = k ? istatistik(adimBellek[k.tip], "s") : null;
      const yuzde = k ? `${Math.round(ilerleme(k, stat) * 100)}%`.padStart(4) : "";
      const fableMesgul = dan_ && (taslak?.durum === "hazirlaniyor" || tur?.durum === "degerlendiriliyor" || dan?.durum === "bekliyor");
      const kosuyor = k && k.durum !== "hata" && k.durum !== "iptal" && !(fableMesgul && k.durum !== "calisiyor");
      const tema = k ? temaSec(i, k.baslangic) : null;
      const ad = Text({ color: dan_ ? "magenta" : "white", bold: dan_, children: `${dan_ ? "◆" : "▸"} ${u.slice(0, 18).padEnd(19)}` });
      const buton = girisVar && elleAcik && i < 9 ? [Text({ children: "  " }), Button({ key: `b-${u}`, hotkey: String(i + 1), plain: true, label: "görev ver", onPress: () => modAyarla({ tur: "gorev", uye: u }) })] : [];
      const sag = kosuyor
        ? [Text({ color: k.durum === "bitti" ? "green" : "cyan", bold: true, children: ` ${yuzde}` }), Text({ dimColor: true, children: ` ${gecen.padStart(5)}` })]
        : [Text({ children: " ".repeat(11) })];
      if (svg && (kosuyor || fableMesgul)) {
        const bilgi = Box({ key: `ui-${u}`, flexDirection: "row", children: [ad, Text({ dimColor: true, children: `${kisaModel(r.model)}${kosuyor && !fableMesgul ? ` · ${tema.ad}` : ""}  ` }),
          ...(fableMesgul ? [Text({ color: "magenta", children: "düşünüyor…" })] : sag), ...buton] });
        let kaynak = svgDusunuyor();
        if (!fableMesgul) {
          const pYeni = yuvarla(ilerleme(k, stat));
          const iz = svgIz.get(u);
          const once = !iz || iz.kosu !== k.id ? undefined : iz.p !== pYeni ? iz.p : iz.once;
          svgIz.set(u, { kosu: k.id, p: pYeni, once });
          kaynak = svgSerit(tema.ad, ilerleme(k, stat), k.durum !== "calisiyor", `s-${u}`, once);
        }
        return Box({ key: `u-${u}`, flexDirection: "column", children: [bilgi,
          Svg({ key: `s-${u}`, source: kaynak, alt: fableMesgul ? "Fable düşünüyor" : `${u}: ${yuzde.trim()} ${tema.ad}`, isInteractive: true })] });
      }
      if (!genis) {
        const ozet = fableMesgul ? `${spin} düşünüyor` : !k ? "· bekliyor" : k.durum === "hata" || k.durum === "iptal" ? `✖ ${k.durum} ${gecen}`
          : `${k.durum === "bitti" ? "✔" : spin} ${yuzde} ${gecen}`;
        return Box({ key: `u-${u}`, flexDirection: "row", children: [ad, Text({ dimColor: true, children: kisaModel(k?.model ?? r.model).padEnd(7) }),
          Text({ color: fableMesgul ? "magenta" : !k ? "gray" : k.durum === "bitti" ? "green" : k.durum === "calisiyor" ? "cyan" : "red", children: ozet.padEnd(22) }), ...buton] });
      }
      const [ust, alt] = fableMesgul
        ? [[Text({ color: "magenta", children: tarayici(frame, SW) })], [Text({ color: "magenta", dimColor: true, children: "Fable düşünüyor…".padEnd(SW) })]]
        : kosuyor
        ? (({ ust, alt }) => [ust.map(Text), alt.map(Text)])(serit(k, tema, frame, stat))
        : !k
        ? [[Text({ children: " ".repeat(SW) })], [Text({ dimColor: true, children: `${"┈".repeat(SERIT_W)}  `.slice(0, SW) })]]
        : [[Text({ color: "red", children: `✖ ${k.durum} · ${gecen}`.padEnd(SW) })], [Text({ color: "red", dimColor: true, children: tek(k.cikti, SW).padEnd(SW) })]];
      const alt2 = `  ${kisaModel(r.model)}${kosuyor ? ` · ${tema.ad}` : ""}`.slice(0, 21).padEnd(21); // ad sütunuyla aynı genişlik: üst ve alt pikseller üst üste oturur
      if (raster && kosuyor && !fableMesgul) {
        const key = `r-${u}`;
        const bitti = k.durum !== "calisiyor";
        const il = ilerleme(k, stat);
        const once = canli.get(key);
        canli.set(key, { uye: u, ad: tema.ad, ilerleme: il, bitti, bitis: once?.bitti ? once.bitis : bitti ? Date.now() : 0 });
        return Box({ key: `u-${u}`, flexDirection: "row", children: [
          Box({ key: `ua-${u}`, flexDirection: "column", children: [ad, Text({ dimColor: true, children: alt2 }), Text({ children: " " })] }),
          Raster({ key, columns: SAHNE_W, rows: SAHNE_R, cells: hucreler(sahneKaresi(tema.ad, kareNo, il, bitti)) }),
          Box({ key: `us-${u}`, flexDirection: "column", children: [Box({ key: `us1-${u}`, flexDirection: "row", children: [...sag, ...buton] })] }),
        ] });
      }
      return Box({ key: `u-${u}`, flexDirection: "column", children: [
        Box({ key: `u1-${u}`, flexDirection: "row", children: [ad, ...ust, ...sag, ...buton] }),
        Box({ key: `u2-${u}`, flexDirection: "row", children: [Text({ dimColor: true, children: alt2 }), ...alt] }),
      ] });
    };

    const kosuSatiri = k => {
      const ad = k.tip.startsWith(`${P}:`) ? k.tip.slice(P.length + 1) : k.tip;
      const ikon = k.durum === "calisiyor" ? spin : k.durum === "bitti" ? "✔" : "✖";
      const renk = k.durum === "calisiyor" ? "cyan" : k.durum === "bitti" ? "green" : "red";
      const ne = k.durum === "calisiyor" ? k.aciklama : tek(k.cikti || k.aciklama, genis ? 60 : 30);
      return Text({ key: `k-${k.id}`, children: [
        Text({ color: renk, children: `  ${ikon} ` }),
        Text({ children: `${ad} ` }),
        Text({ dimColor: true, children: `${sure((k.bitis ?? Date.now()) - k.baslangic)} → ${ne}` }),
      ] });
    };

    const giris = () => {
      if (!mod || !girisVar) return [];
      const kapat = () => modAyarla(null);
      if (mod.tur === "gorev") return [Input({ key: "gorev", autoFocus: true, label: `${mod.uye} görevi`, placeholder: "Ne yapsın?", submitLabel: "başlat",
        onSubmit: v => { kapat(); if (v.trim()) void baslat($, mod.uye, v.trim()); } })];
      if (mod.tur === "kur") return [Input({ key: "kur", autoFocus: true, label: "Hedef (Fable ekibi kursun)", placeholder: "örn. Haftam panosundaki taşmayı çöz, test et, belgele", submitLabel: "tasarla",
        onSubmit: v => { kapat(); if (v.trim()) void kur($, v.trim()); } })];
      if (mod.tur === "soru") return [Input({ key: "soru", autoFocus: true, label: "Danışmana soru", placeholder: "Mimari / karar sorusu…", submitLabel: "sor",
        onSubmit: v => { kapat(); if (v.trim()) void sor($, v.trim()); } })];
      if (mod.tur === "yeni") return [Input({ key: "yeni", autoFocus: true, label: "Yeni ekip adı", placeholder: "örn. ADC kalibrasyon ekibi", submitLabel: "kur",
        onSubmit: v => { kapat(); const ad = v.trim(); if (!ad || liste.some(x => x.ad === ad)) return;
          void kaydet($, [...liste, { ad, amac: "özel ekip", uyeler: ["danisman"] }]).then(() => yukle($, ad)); } })];
      if (mod.tur === "ekip") return [Select({ key: "ekip", autoFocus: true, label: "Ekip seç", value: ekip.ad,
        options: liste.map(x => ({ value: x.ad, label: `${x.ad} (${x.uyeler.length})` })),
        onSelect: v => { kapat(); void yukle($, v).then(() => kaydet($, liste)); } })];
      if (mod.tur === "uye") {
        const secenek = Object.keys(ROLLER).filter(r => !ekip.uyeler.includes(r));
        if (!secenek.length) return [Text({ dimColor: true, children: "Tüm roller zaten ekipte." })];
        return [Select({ key: "uye", autoFocus: true, label: "Üye ekle", options: secenek.map(r => ({ value: r, label: `${r} · ${kisaModel(ROLLER[r].model)}` })),
          onSelect: v => { kapat(); void kaydet($, liste.map(x => (x.ad === ekip.ad ? { ...x, uyeler: [...x.uyeler, v] } : x))).then(() => yukle($, ekip.ad)); } })];
      }
      if (mod.tur === "cikar") {
        const secenek = ekip.uyeler.filter(u => u !== "danisman");
        if (!secenek.length) return [Text({ dimColor: true, children: "Çıkarılacak üye yok." })];
        return [Select({ key: "cikar", autoFocus: true, label: "Üye çıkar", options: secenek.map(u => ({ value: u })),
          onSelect: v => { kapat(); void kaydet($, liste.map(x => (x.ad === ekip.ad ? { ...x, uyeler: x.uyeler.filter(u => u !== v) } : x))).then(() => yukle($, ekip.ad)); } })];
      }
      return [];
    };

    const incelet = async () => {
      const prompt = incelemePrompt(ekip, kosular);
      if (!prompt) { $.ui.toast("İncelenecek bitmiş çıktı yok."); return; }
      const r = await baslat($, "danisman", prompt);
      if (r.agentId) {
        await $.state.set(INCELEME, r.agentId);
        await $.state.set(DANISMAN, { soru: "Ekip çıktılarını incele", durum: "bekliyor" });
      }
    };

    const eylem = (key, hotkey, label, onPress) => Button({ key, hotkey, plain: true, label, onPress });
    // Elle yönetim aç/kapa: modül değişkeni + çerçeve sayacıyla yeniden çizim.
    const elleDegis = () => {
      elleAcik = !elleAcik;
      void $.state.set(FRAME, frame + 1);
    };
    const durdurDugmesi = tur && (tur.durum === "calisiyor" || tur.durum === "degerlendiriliyor")
      ? [eylem("dur", "p", "Durdur", () => void $.state.set(TUR, { ...tur, durum: "durduruldu" }))] : [];

    return Box({
      flexDirection: "column", paddingX: 1,
      children: [
        Box({ key: "bas", flexDirection: "row", children: [
          Text({ color: "magenta", bold: true, children: `◆ ${ekip.ad}` }),
          Text({ dimColor: true, children: `  ${ekip.amac}` }),
          Text({ color: calisan ? "cyan" : "gray", children: `  ·  ${calisan}/${ekip.uyeler.length} çalışıyor` }),
        ] }),
        ...(ekip.oto || tur || !elleAcik ? [Box({ key: "tur", flexDirection: "row", children: [
          Text({ dimColor: true, children: `  Fable yönetir · Opus uzman · Sonnet hızlı${tur ? ` · ${tur.yogun ? "yoğun iş" : "basit iş"}` : ""}  ·  ` }),
          Text({ color: tur?.durum === "bitti" ? "green" : tur?.durum === "durduruldu" ? "yellow" : "cyan", children:
            !tur ? "beklemede" : tur.durum === "calisiyor" ? `${spin} tur ${tur.no}/${MAX_TUR} çalışıyor`
              : tur.durum === "degerlendiriliyor" ? `${spin} Fable tur ${tur.no}'i değerlendiriyor`
              : tur.durum === "durduruldu" ? `⏸ tur ${tur.no} sonunda durdurulacak` : `🏁 tamamlandı (${tur.no} tur)` }),
        ] })] : []),
        ...(taslak ? [Box({ key: "taslak", flexDirection: "column", marginTop: 1, children: taslak.durum === "hazirlaniyor"
          ? [Text({ color: "magenta", children: `${spin} Fable ekibi tasarlıyor: ${tek(taslak.hedef, 60)}` })]
          : taslak.durum === "hata"
          ? [Text({ color: "red", children: `✖ ${taslak.hata}` })]
          : [
            Text({ color: "magenta", bold: true, children: `◆ Fable'ın planı: ${taslak.ad} — ${taslak.amac}` }),
            ...(taslak.not ? [Text({ color: "yellow", children: `  ${taslak.not}` })] : []),
            ...taslak.uyeler.map(u => Text({ key: `t-${u.name}`, children: [
              Text({ children: `  ▸ ${u.name.padEnd(18)}` }),
              Text({ dimColor: true, children: `${u.tools.join(",").slice(0, 28).padEnd(29)}` }),
              Text({ children: tek(u.gorev, genis ? 60 : 30) }),
            ] })),
            Text({ dimColor: true, children: "  Onaylarsan üyeler kaydedilir ve görevleri hemen başlar (en güncel Opus)." }),
          ] })] : []),
        Box({ key: "uyeler", flexDirection: "column", marginTop: 1, children: ekip.uyeler.map(uyeSatiri) }),
        ...giris(),
        Box({ key: "kosular", flexDirection: "column", marginTop: 1, children: [
          Text({ dimColor: true, children: kosular.length ? "Son koşular" : "Henüz koşu yok — görev geldikçe ekip burada çalışır; senin bir şey yapman gerekmez." }),
          ...kosular.slice(-5).map(kosuSatiri),
        ] }),
        ...(brifler.length ? [Box({ key: "brif", flexDirection: "column", marginTop: 1, children: [
          Text({ dimColor: true, children: `Ara brifler (tur ${tur?.no ?? "?"})` }),
          ...brifler.slice(-3).map(b => Text({ key: `br-${b.no}`, children: [
            Text({ color: b.eylem === "yon" ? "cyan" : "yellow", children: `  #${b.no} ${b.tetik} → ${b.uye} ` }),
            Text({ dimColor: true, children: `${b.eylem === "yon" ? "yön" : b.eylem === "durdur" ? "durdur" : "yeniden ata"} · ${tek(b.neden, genis ? 70 : 40)}` }),
          ] })),
        ] })] : []),
        ...(dan ? [Box({ key: "dan", flexDirection: "column", marginTop: 1, children: [
          Text({ color: "magenta", bold: true, children: `◆ Danışman: ${tek(dan.soru, 70)}` }),
          ...(dan.not ? [Text({ color: "yellow", children: `  ${dan.not}` })] : []),
          dan.durum === "bekliyor"
            ? Text({ color: "cyan", children: `  ${spin} düşünüyor…` })
            : Markdown ? Markdown({ key: "cevap", text: dan.cevap ?? "", dimColor: dan.durum === "hata" }) : Text({ children: dan.cevap ?? "" }),
        ] })] : []),
        // Otomatik görünüm: yalnız Durdur (iş sürüyorsa) ve "Elle yönet". Elle yönetim açılınca tüm tuşlar.
        ...(girisVar && !elleAcik ? [Box({ key: "eylem", flexDirection: "row", flexWrap: "wrap", marginTop: 1, children: [
          ...durdurDugmesi,
          eylem("elle", "m", "⚙ Elle yönet", elleDegis),
        ] })] : []),
        ...(girisVar && elleAcik ? [Box({ key: "eylem", flexDirection: "row", flexWrap: "wrap", marginTop: 1, children: [
          ...(taslak?.durum === "hazir" ? [
            Button({ key: "onay", hotkey: "o", variant: "primary", label: "Planı onayla ve başlat", onPress: () => void onayla($) }),
            eylem("red", "r", "Reddet", () => void $.state.set(TASLAK, null)),
          ] : [eylem("kur", "k", "Fable ekip kursun", () => modAyarla({ tur: "kur" }))]),
          ...durdurDugmesi,
          eylem("sor", "s", "Danışmana sor", () => modAyarla({ tur: "soru" })),
          eylem("inc", "i", "Çıktıları incelet", () => void incelet()),
          eylem("deg", "e", "Ekip değiştir", () => modAyarla({ tur: "ekip" })),
          eylem("yeni", "y", "Yeni ekip", () => modAyarla({ tur: "yeni" })),
          eylem("ekle", "u", "Üye ekle", () => modAyarla({ tur: "uye" })),
          eylem("cik", "x", "Üye çıkar", () => modAyarla({ tur: "cikar" })),
          eylem("tem", "t", "Temizle", () => { void $.state.set(KOSULAR, kosular.filter(k => k.durum === "calisiyor")); void $.state.set(DANISMAN, null); }),
          eylem("elle", "m", "Gizle", elleDegis),
        ] })] : []),
        ...(girisVar ? [] : [Text({ key: "mobil", dimColor: true, children: "Bu yüzeyde yalnız izleme var; yönetim terminal/masaüstünde." })]),
      ],
    });
  });
}
