import { sahneKaresi, hucreler, SAHNE_W, SAHNE_R } from "./sahne.mjs";
import { svgSerit, svgDusunuyor, yuvarla } from "./svgsahne.mjs";
import { semaSvg, yuzde5, sureKisa } from "./sema.mjs";
import { KURALLAR, ISCI_FORMAT, KADEME_EK, ESIK, UZMAN_MODEL, HIZLI_MODEL, modelSec, kademe, dosyaCakismalari, yogunMu, bayrak, t2Mi, brifIzinli, uyeTablosu, brifDogrula, brifMetni, butce, butceUygula, BUTCE_AYAR, HAFIF_MODEL, MODEL_PROFILI_VARSAYILAN, profilMetni, projeProfili, stratejiEskiMi, stratejiMetni, profilDogrula } from "./kurallar.mjs";

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
const BUTCE = { plugin: "ekip", key: "butce" }; // { seviye, ozet } — son okunan kota bütçesi
const SON_KONTROL = { plugin: "ekip", key: "sonKontrol" }; // { id?, durum: bekliyor|onay|ret|hata, baslik, neden? }
const IZCI = { plugin: "ekip", key: "izciId" }; // siteden model profili okuyan izci ajanın kimliği
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
  "hafif-isci": {
    rol: "isci", model: HAFIF_MODEL, maxTurns: 15,
    description: "Yüksek hacimli mekanik işler (Haiku): log/CSV/telemetri tarama ve sınıflandırma, dosya/uyarı/TODO envanteri, alan çıkarma, çıktıları tabloya dökme. Kod mantığı değiştirmez.",
    prompt: "Verilen mekanik işi eksiksiz yap: tara, sınıflandır, say, çıkar, tabloya dök. Kaynak dosyaları değiştirme; sonucu doğrulanabilir sayılarla ver.",
    tools: ["Read", "Grep", "Glob", "Bash"],
  },
  // Ekip üyesi değil: danışmanın gözü (§8). Modellerin yeteneklerini Anthropic'in sitesinden okur; Haiku, çünkü iş çıkarım.
  "model-izci": {
    rol: "izci", model: HAFIF_MODEL, maxTurns: 6,
    description: "Anthropic model sayfasından güncel Claude modellerinin yetenek, hız ve fiyatını çıkarır (ekip danışmanı için).",
    prompt: "Görevin: WebFetch ile https://platform.claude.com/docs/en/about-claude/models/overview sayfasını (yönlendirme olursa yeni adresi) oku; gerekirse https://platform.claude.com/docs/en/about-claude/models/choosing-a-model sayfasına da bak. fable, opus, sonnet ve haiku ailelerinin her birinden en güncel modeli al. Yalnız JSON döndür, başka metin yazma:\n{\"kaynak\":\"okunan adres\",\"modeller\":[{\"alias\":\"fable|opus|sonnet|haiku\",\"id\":\"claude-...\",\"gecikme\":\"sitedeki göreli gecikme\",\"fiyat\":\"$girdi / $çıktı (MTok)\",\"guclu\":\"sitedeki tanım ve önerilen kullanım, Türkçe, ≤150 karakter\"}]}",
    tools: ["WebFetch"],
  },
};
// Her işçinin talimatına kademe sınırı ve çıktı biçimi eklenir (kurallar.mjs §1, §4).
for (const r of Object.values(ROLLER)) if (r.rol === "isci") r.prompt += `\n\n${KADEME_EK[r.model]}\n${ISCI_FORMAT}`;

export const SABLON_EKIPLER = [
  { ad: "Firmware ekibi", amac: "STM32 firmware geliştirme, test ve inceleme", uyeler: ["danisman", "firmware-analist", "test-yazici", "kod-inceleyici", "hizli-isci", "hafif-isci"] },
  { ad: "Arayüz ekibi", amac: "ThingsBoard/dashboard arayüzü ve dokümantasyon", uyeler: ["danisman", "arayuz-gelistirici", "dokumantasyoncu", "hizli-isci", "hafif-isci"] },
  // Firmware olmayan projelerin öntanımlısı (ör. AR-GE Takip Platformu: FastAPI + React).
  { ad: "Yazılım ekibi", amac: "Kod geliştirme, inceleme, test ve belge — Fable yönetir", uyeler: ["danisman", "kod-inceleyici", "test-yazici", "dokumantasyoncu", "hizli-isci", "hafif-isci"] },
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

// ── Kota bütçesi (§7): kalan 5 saatlik hak ve haftalık tempo → ekibin gücü/hızı ──
async function butceAl($) {
  let limits = [];
  try { limits = (await $.session.usage())?.rateLimits ?? []; } catch {}
  const b = butce(limits);
  await $.state.set(BUTCE, { seviye: b.seviye, ozet: b.ozet });
  return b;
}
const butceSatiri = b => `Kota: ${b.ozet}. Bütçe: ${b.seviye.toLocaleUpperCase("tr-TR")} — en fazla ${b.ayar.maxUye} işçi, ${b.ayar.maxTur} tur, en fazla ${b.ayar.opusMax} Opus${b.ayar.brifMaxTur ? "" : ", ara brif yok"}.`;
// Bütçenin Opus'tan Sonnet'e indirdiği üyenin kademe talimatı da değişir.
const indir = u => (u.inen ? { ...u, prompt: u.prompt.replace(KADEME_EK[UZMAN_MODEL], KADEME_EK[HIZLI_MODEL]) } : u);

// ── Dinamik model stratejisi (§8): siteden model profili + proje içeriği → danışmanın proje başına stratejisi ──
const GUN = 86_400_000;
async function modelProfili($) {
  const p = await $.store.get("modelProfili");
  return p?.modeller?.length ? p : MODEL_PROFILI_VARSAYILAN;
}
/** Model izcisini (Haiku, WebFetch) başlatır; cevabı turn.complete'te profil olarak saklanır. */
async function modelleriYenile($, { sessiz = false } = {}) {
  await $.store.set("izciDeneme", Date.now());
  const r = await $.agent.spawn({ subagentType: `${P}:model-izci`, prompt: "Güncel Claude modellerinin yetenek profilini çıkar (talimatındaki JSON biçiminde).", description: "model profili (site)" });
  if (r.agentId) {
    await $.state.set(IZCI, r.agentId);
    await kosuEkle($, r.agentId, `${P}:model-izci`, "model profili (site)", r.model);
    if (!sessiz) $.ui.toast("◆ Danışman model profilini siteden tazeliyor (Haiku)");
  } else if (!sessiz) $.ui.toast(`ekip: model izcisi başlamadı — ${String(r.deny ?? "bilinmeyen").slice(0, 60)}`);
  return r;
}
/** İzcinin cevabı: geçerliyse profil saklanır ve bu projenin stratejisi yeni profille yeniden yazılır. */
async function izciBitti($, cikti, basarili) {
  await $.state.set(IZCI, null);
  const p = basarili ? profilDogrula(jsonAl(cikti), new Date().toISOString().slice(0, 10)) : null;
  if (!p) { $.ui.toast("⚠ ekip: model profili siteden okunamadı; mevcut profil kullanılmaya devam ediyor"); return; }
  const once = await modelProfili($);
  const degisen = p.modeller.filter(m => !once.modeller.some(o => o.id === m.id && o.fiyat === m.fiyat)).map(m => m.id);
  // Model ya da fiyat değişmediyse profil tarihi korunur: stratejiler boşuna yeniden yazılmaz (token).
  await $.store.set("modelProfili", { ...p, tarih: degisen.length ? p.tarih : once.tarih, alinma: Date.now() });
  if (!degisen.length) { $.ui.toast("✔ Model profili siteden doğrulandı — değişiklik yok"); return; }
  $.ui.toast(`✔ Model profili güncellendi — yeni/değişen: ${degisen.join(", ")}; proje stratejisi yenileniyor`);
  void strateji($, { zorla: true }).catch(() => {});
}
async function profilYasliysaYenile($) {
  const p = await $.store.get("modelProfili");
  const alinma = p?.alinma ?? Date.parse(MODEL_PROFILI_VARSAYILAN.tarih);
  const deneme = (await $.store.get("izciDeneme")) ?? 0;
  if (Date.now() - alinma > 7 * GUN && Date.now() - deneme > GUN) await modelleriYenile($, { sessiz: true });
}
const ATLA = /^(node_modules|\.git|build|dist|debug|release|\.venv|venv|__pycache__|\.next|out|target|\.claude)$/i;
/** Proje kökü ve bir alt düzey (en fazla 400 dosya) + öne çıkan işaretler. */
async function projeTara($) {
  const dosyalar = [], isaretler = [];
  let kok = [];
  try { kok = await $.fs.list(); } catch { return projeProfili([]); }
  const adlar = kok.map(e => e.name);
  if (firmwareMi(adlar)) isaretler.push("firmware (CubeMX/PlatformIO)");
  if (adlar.includes("package.json")) isaretler.push("npm");
  if (adlar.some(a => /^(pyproject\.toml|requirements.*\.txt)$/i.test(a))) isaretler.push("python paketi");
  if (adlar.some(a => /^(docker-compose.*\.ya?ml|dockerfile)$/i.test(a))) isaretler.push("docker");
  for (const e of kok) {
    if (dosyalar.length >= 400) break;
    if (e.kind === "file") dosyalar.push({ yol: e.name });
    else if (e.kind === "dir" && !ATLA.test(e.name) && !e.name.startsWith(".")) {
      try { for (const a of (await $.fs.list(e.name)).slice(0, 120)) if (a.kind === "file") dosyalar.push({ yol: `${e.name}/${a.name}` }); } catch {}
    }
  }
  return projeProfili(dosyalar.slice(0, 400), isaretler);
}
const STRATEJI_SISTEM = `Sen ekip danışmanısın (Fable). Model profiline (Anthropic'in sitesinden) ve proje profiline bakarak BU PROJE için model kullanım stratejisi yaz: hangi tür iş Opus'a, Sonnet'e, Haiku'ya gider; senin (Fable) kendine sakladığın ne; sınırda ne yapılır. Projenin gerçek iş türlerinden somut örnekler ver (ör. firmware'de "DMA/kesme hatası → Opus", web'de "mevcut desenle API alanı → Sonnet", her projede "log/uyarı envanteri → Haiku"). Fiyat ve hız farkını gözet: aynı işi daha ucuz kademe güvenle yapabiliyorsa onu seç. ${KULLANICI}

${KURALLAR}

Yalnız JSON döndür: {"ozet":"tek cümle","kademeler":{"opus":["iş türü"],"sonnet":["..."],"haiku":["..."],"fable":["..."]},"sinir":"tereddütte kural"}`;
const stratejiAnahtari = () => `strateji:${projeKlasoru}`;
/** Projenin stratejisi: eskiyse (profil değişti, proje karakteri değişti, 14 gün) danışman yeniden yazar. */
async function strateji($, { zorla = false } = {}) {
  const profil = await modelProfili($);
  const pp = await projeTara($);
  const kayit = await $.store.get(stratejiAnahtari());
  if (!zorla && !stratejiEskiMi(kayit, { profilTarih: profil.tarih, imza: pp.imza })) return kayit.metin;
  const r = await fable($, { system: STRATEJI_SISTEM, prompt: `${profilMetni(profil)}\n\nProje: ${projeKlasoru || "?"}\nProje profili: ${pp.ozet}`, maxTokens: 1500, timeoutMs: 120_000 });
  const metin = r.isAnswered ? stratejiMetni(jsonAl(r.text)) : null;
  if (!metin) return kayit?.metin ?? null;
  await $.store.set(stratejiAnahtari(), { metin, profilTarih: profil.tarih, imza: pp.imza, zaman: Date.now(), proje: pp.ozet });
  return metin;
}
const stratejiOku = async $ => (await $.store.get(stratejiAnahtari()))?.metin ?? null;
const stratejiBolumu = st => (st ? `\n\nMODEL STRATEJİSİ (bu proje, danışmanın kendi kararı):\n${st}` : "");

async function kur($, hedef) {
  await $.state.set(TASLAK, { durum: "hazirlaniyor", hedef });
  cark($);
  const b = await butceAl($);
  const st = await strateji($);
  let r = await fable($, { system: KUR_SISTEM, prompt: `Hedef: ${hedef}\n\n${butceSatiri(b)}${stratejiBolumu(st)}`, maxTokens: 3500, timeoutMs: 180_000 });
  let taslak = r.isAnswered ? planDogrula(jsonAl(r.text)) : null;
  // Aynı dosya iki üyede: plan bir kez danışmana geri verilir (§2 bölme kuralı).
  if (taslak?.cakisma.length) {
    const not = taslak.cakisma.map(c => `${c.dosya}: ${c.a} ve ${c.b}`).join("; ");
    const r2 = await fable($, { system: KUR_SISTEM, prompt: `Hedef: ${hedef}\n\n${butceSatiri(b)}${stratejiBolumu(st)}\n\nÖnceki planında aynı dosya iki üyeye verilmiş (${not}). Dosyayı tek üyeye ver, öbürü salt okusun ya da bagimli olsun; planı yeniden yaz.`, maxTokens: 3500, timeoutMs: 180_000 });
    const t2 = r2.isAnswered ? planDogrula(jsonAl(r2.text)) : null;
    if (t2) { taslak = t2; r = r2; }
  }
  // Bütçe kodla da uygulanır: fazla üye ve sınırı aşan Opus kırpılır; kırpılanın bağımlısı serbest kalır.
  if (taslak) {
    const uyeler = butceUygula(taslak.uyeler, b.ayar).map(indir);
    for (const u of uyeler) if (u.bagimli && !uyeler.some(x => x.name === u.bagimli)) u.bagimli = "";
    taslak = { ...taslak, uyeler, butce: b.seviye };
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
  await $.state.set(TUR, { no: 1, durum: "calisiyor", yogun: Boolean(taslak.yogun), bekleyen, butce: taslak.butce ?? "normal" });
  for (const u of taslak.uyeler.filter(u => !u.bagimli)) await baslat($, u.name, u.gorev, 1, { model: u.model, beklenenDk: u.beklenenDk, yogun: taslak.yogun });
  if (taslak.yogun) izlemeyiBaslat($);
  const sonnet = taslak.uyeler.filter(u => u.model === HIZLI_MODEL).length;
  $.ui.toast(`◆ ${ad}: Fable ${taslak.uyeler.length} üyeye görev atadı (${taslak.uyeler.length - sonnet} Opus, ${sonnet} Sonnet · bütçe ${taslak.butce ?? "normal"}${taslak.yogun ? " · yoğun iş: ara brif + tablolu rapor" : ""})`);
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
  const { value: k = [] } = await $.state.get(KOSULAR);
  const kosan = k.filter(x => x.tur === tur.no && x.durum === "calisiyor");
  if (!kosan.length) return;
  // Bütçe brif sayısını da kısar; kritikte ara brif yok (§7).
  const bt = await butceAl($);
  if (br.length >= Math.min(ESIK.BRIF_MAX_TUR, bt.ayar.brifMaxTur)) return;
  const ad = x => x.tip.slice(P.length + 1);
  const durumlar = kosan.map(x => `- ${ad(x)} (${kademe(x.model)}, ${x.adim ?? 0} adım, ${sure(Date.now() - x.baslangic)}${x.beklenenDk ? ` / beklenen ${x.beklenenDk} dk` : ""}): ${x.aciklama}`).join("\n");
  const son15 = String(kaynak?.cikti ?? "").split("\n").slice(-15).join("\n");
  const r = await fable($, {
    system: BRIF_SISTEM, maxTokens: 800, timeoutMs: 90_000,
    prompt: `Tetikleyici: ${tetik}${kaynak ? ` — kaynak üye ${ad(kaynak)} (${kaynak.durum})` : ""}. Tur ${tur.no}.\n${butceSatiri(bt)}${stratejiBolumu(await stratejiOku($))}\n\nKoşan üyeler:\n${durumlar}\n\n` +
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
  const b = await butceAl($); // tur arasında kota değişmiş olabilir: sonraki turun gücü buna göre
  const maxTur = Math.min(MAX_TUR, b.ayar.maxTur);
  const r = await fable($, {
    system: DEGER_SISTEM, maxTokens: 3000, timeoutMs: 180_000,
    prompt: `Ekip: ${ekip.ad}. Hedef: ${ekip.hedef ?? ekip.amac}. Üyeler: ${ekip.uyeler.filter(u => u !== "danisman").join(", ")}. Tur ${no}/${maxTur}. İş: ${yogun ? "yoğun" : "basit"}.\n${butceSatiri(b)}${stratejiBolumu(await stratejiOku($))}` +
      (br.length ? `\nBu turdaki brifler: ${br.map(b => `#${b.no} → ${b.uye} (${b.eylem})`).join(", ")}.` : "") + `\n\n${ciktilar}`,
  });
  const j = r.isAnswered ? jsonAl(r.text) : null;
  const yogunSonra = yogun || j?.yogunluk === "yogun"; // yükseltilebilir, düşürülemez (§3)
  const { value: simdi = null } = await $.state.get(TUR);
  const sonraki = butceUygula(atamalar(j, ekip).map(a => ({ ...a, model: a.model ?? rolu(ekip, a.uye)?.model })), b.ayar);
  const son = simdi?.durum === "durduruldu" || j?.bitti || !sonraki.length || no >= maxTur;
  // Yoğun işte rapor: üye tablosu telemetriden, gerisi danışmandan (§4).
  const metin = r.isAnswered ? String(j?.degerlendirme ?? r.text) : `Değerlendirme alınamadı: ${r.reason}`;
  await $.state.set(DANISMAN, {
    soru: son ? `${yogunSonra ? "Son rapor" : "Sonuç"} — ${ekip.ad}` : `Tur ${no} değerlendirmesi`, durum: r.isAnswered ? "bitti" : "hata", ...notu(r),
    cevap: (yogunSonra && r.isAnswered ? `**Üye tablosu**\n\n${uyeTablosu(buTur, br)}\n\n${metin}` : metin).slice(0, 9000),
  });
  if (son) {
    if (simdi?.durum !== "durduruldu") await $.state.set(TUR, { no, durum: "bitti", yogun: yogunSonra, butce: b.seviye });
    $.ui.toast(j?.bitti ? `🏁 ${ekip.ad}: Fable hedefi tamamlandı saydı — son kontrol başlıyor` : `◆ ${ekip.ad}: tur ${no} bitti, yeni atama yok — son kontrol başlıyor`);
    // Son kontrol her zaman danışmanda (§7): tüm turların çıktıları ve rapor üzerinden.
    await sonKontrol($, { baslik: ekip.ad, rapor: metin, kosular: k.filter(x => x.tur && x.tip !== `${P}:danisman`), yogun: yogunSonra, butce: b });
    return;
  }
  await $.state.set(TUR, { no: no + 1, durum: "calisiyor", yogun: yogunSonra, bekleyen: [], butce: b.seviye });
  await $.state.set(BRIFLER, []);
  for (const a of sonraki) await baslat($, a.uye, a.gorev, no + 1, { model: a.model, yogun: yogunSonra });
  if (yogunSonra) izlemeyiBaslat($);
  $.ui.toast(`◆ Fable tur ${no + 1} için ${sonraki.length} görev atadı`);
}

// ── Son kontrol (§7): iş bitince danışman doğrular; tam = Fable ajanı dosyaları okur, hafif = yalnız çıktılar ──
export const kararOku = t => { const m = String(t ?? "").match(/KARAR:\s*(ONAY|RET)\b\s*[—–-]?\s*(.*)/i); return m ? { durum: m[1].toLowerCase() === "onay" ? "onay" : "ret", neden: m[2].trim().slice(0, 160) } : { durum: "hata", neden: "karar satırı yok" }; };
export function sonKontrolPrompt({ baslik, rapor, kosular, yogun }) {
  const ciktilar = kosular.slice(-8).map(x => `### ${x.tip.slice(P.length + 1)} (${kademe(x.model)}, ${x.durum}) — ${x.aciklama}\n${tek(x.cikti, 1500)}`).join("\n\n");
  return `SON KONTROL — ${baslik}. Ekibin işi bitti; son kontrol sende (kurallar §7).\n` +
    "İşçilerin iddia ettiği değişiklikleri dosyalardan doğrula (Read/Grep): bitiş ölçütü sağlandı mı, diff disiplini korunmuş mu, gözden kaçan risk var mı. Yeni iş başlatma, kod yazma.\n" +
    (yogun ? "Biçim (≤20 satır): | Kontrol | Sonuç | Kanıt (dosya:satır) | tablosu, sonra en fazla 3 madde.\n" : "Biçim: en fazla 5 satır.\n") +
    'Son satır zorunlu: "KARAR: ONAY" ya da "KARAR: RET — <tek cümle neden>".\n\n' +
    (rapor ? `Danışman raporu:\n${tek(rapor, 2500)}\n\n` : "") + ciktilar;
}
let sonKontrolZamani = 0; // elle/ana oturum işleri: bu andan sonra bitenler kontrol edilir
async function sonKontrol($, kapsam) {
  sonKontrolZamani = Date.now();
  const b = kapsam.butce ?? await butceAl($);
  const prompt = sonKontrolPrompt(kapsam);
  await $.state.set(SON_KONTROL, { durum: "bekliyor", baslik: kapsam.baslik });
  await $.state.set(DANISMAN, { soru: `Son kontrol — ${kapsam.baslik}`, durum: "bekliyor" });
  if (b.ayar.sonKontrol === "tam") {
    const r = await baslat($, "danisman", prompt);
    if (r.agentId) { await $.state.set(SON_KONTROL, { id: r.agentId, durum: "bekliyor", baslik: kapsam.baslik }); return; }
  }
  // Kritik bütçe ya da ajan başlamadı: hafif kontrol, yalnız çıktılar üzerinden.
  const r = await fable($, { system: ROLLER.danisman.prompt, prompt: `${prompt}\n\n(Hafif kontrol: dosya okuyamazsın; yalnız çıktılara dayan, kanıt sütununa "çıktı" yaz.)`, maxTokens: 1200, timeoutMs: 120_000 });
  await sonKontrolBitti($, kapsam.baslik, r.isAnswered ? r.text : `Son kontrol alınamadı: ${r.reason}`, r.isAnswered, notu(r));
}
async function sonKontrolBitti($, baslik, metin, basarili, ek = {}) {
  const k = basarili ? kararOku(metin) : { durum: "hata", neden: "danışmana ulaşılamadı" };
  await $.state.set(SON_KONTROL, { durum: k.durum, baslik, neden: k.neden });
  await $.state.set(DANISMAN, { soru: `Son kontrol — ${baslik}`, cevap: String(metin).slice(0, 9000), durum: basarili ? "bitti" : "hata", ...ek });
  $.ui.toast(k.durum === "onay" ? `✔ Son kontrol ONAY — ${baslik}` : k.durum === "ret" ? `✖ Son kontrol RET — ${tek(k.neden, 60)}` : `⚠ Son kontrol: ${k.neden}`);
}

// ── Denetmen: tek komut ya da tek koda değil bütüne bakar. Tamamlanan işleri, bekleyen istekleri,
// briflerini ve son kontrol sonuçlarını birlikte okuyup çakışmaları, boşlukları ve sıradaki önceliği çıkarır. ──
const DENETMEN_SISTEM = `Sen ekip denetmenisin (Fable). Tek bir komuta ya da tek bir koda değil, tüm işlerin bütününe bak. ${KULLANICI}
Yapacakların: (1) tamamlanan işlerin birbiriyle çelişip çelişmediğini ve aynı dosyaya dokunup dokunmadığını bul; (2) bekleyen istekleri birleştirilebilirse birleştir, gereksizleri ele, sırayı önceliğe göre öner; (3) hedefe göre eksik kalan parçaları ve açık uçları say; (4) bir sonraki adımı tek satırda söyle. Kod yazma.
Biçim (≤15 satır): "Durum" tek cümle; tablo | İş | Durum | Çakışma/Risk | Sıra |; "Öneri" en fazla 3 madde; son satır "DENETİM: TAMAM" ya da "DENETİM: DİKKAT — <neden>".`;
export function denetmenIstemi({ kosular, bekleyenler, brifler, sonKontrol }) {
  const isler = kosular.slice(-12).map(x => `- ${String(x.tip).replace(/^ekip:/, "")} (${x.durum}, ${x.adim ?? 0} adım): ${tek(x.aciklama, 80)}${x.cikti ? ` → ${tek(x.cikti, 160)}` : ""}`).join("\n") || "- henüz iş yok";
  const bek = bekleyenler.length ? bekleyenler.map((t, i) => `${i + 1}. ${tek(t, 160)}`).join("\n") : "yok";
  const br = brifler.slice(-5).map(b => `- #${b.no} → ${b.uye} (${b.eylem}): ${tek(b.neden, 100)}`).join("\n") || "yok";
  return `BÜTÜN DENETİMİ\n\nTamamlanan ve çalışan işler:\n${isler}\n\nBekleyen istekler (sırayla):\n${bek}\n\nAra brifler:\n${br}\n\nSon kontrol: ${sonKontrol ? `${sonKontrol.durum} — ${sonKontrol.baslik}` : "yok"}`;
}
async function denetle($) {
  const { value: k = [] } = await $.state.get(KOSULAR);
  const { value: br = [] } = await $.state.get(BRIFLER);
  const { value: sk = null } = await $.state.get(SON_KONTROL);
  const prompt = denetmenIstemi({ kosular: k.filter(x => !x.tip.endsWith(":model-izci")), bekleyenler: kuyrukMetinleri, brifler: br, sonKontrol: sk });
  await $.state.set(DANISMAN, { soru: "Bütün denetimi", durum: "bekliyor" });
  const r = await fable($, { system: DENETMEN_SISTEM, prompt, maxTokens: 1500, timeoutMs: 120_000 });
  const metin = r.isAnswered ? r.text : `Denetim alınamadı: ${r.reason}`;
  await $.state.set(DANISMAN, { soru: "Bütün denetimi", cevap: metin.slice(0, 9000), durum: r.isAnswered ? "bitti" : "hata", ...notu(r) });
  return metin;
}

// ── İstek kuyruğu: serbest metinler sırayla işlenir; her biri kur'un planlama aşamasını bitirene kadar bekler.
// Kuyruk boşalınca denetmen bütünü gözden geçirir. ──
let kuyruk = Promise.resolve();
let bekleyen = 0;
const kuyrukMetinleri = [];
function kuyrugaEkle(metin, is, bittiginde) {
  bekleyen++;
  kuyrukMetinleri.push(metin);
  const sira = bekleyen;
  kuyruk = kuyruk.then(async () => {
    try { await is(); } catch {}
    finally {
      kuyrukMetinleri.shift();
      bekleyen--;
      if (bekleyen === 0) await bittiginde().catch(() => {});
    }
  });
  return sira;
}
/** kur'u başlatır ve planın hazır/hata olmasını bekler (en fazla 6 dk). */
async function kurVeBekle($, hedef) {
  await kur($, hedef);
  const t0 = Date.now();
  while (Date.now() - t0 < 360_000) {
    const { value: t = null } = await $.state.get(TASLAK);
    if (!t || t.durum === "hata" || t.durum === "hazir") return;
    await new Promise(r => setTimeout(r, 1000));
  }
}

// Elle ya da ana oturumun verdiği ekip işleri (tursuz): hepsi bitince bir kez danışman kontrol eder.
export function elleKontrolEdilecek(kosular, sinir) {
  const isci = x => x.tip.startsWith(`${P}:`) && x.tip !== `${P}:danisman` && x.tip !== `${P}:model-izci` && !x.tur;
  if (kosular.some(x => isci(x) && x.durum === "calisiyor")) return [];
  return kosular.filter(x => isci(x) && x.durum === "bitti" && (x.bitis ?? 0) > sinir);
}
async function elleSonKontrol($) {
  const { value: tur = null } = await $.state.get(TUR);
  if (tur && (tur.durum === "calisiyor" || tur.durum === "degerlendiriliyor")) return;
  const { value: sk = null } = await $.state.get(SON_KONTROL);
  if (sk?.durum === "bekliyor") return;
  const { value: k = [] } = await $.state.get(KOSULAR);
  const kosular = elleKontrolEdilecek(k, sonKontrolZamani);
  if (!kosular.length) return;
  const ekip = await aktifEkip($);
  await sonKontrol($, { baslik: `${ekip.ad} (${kosular.length} iş)`, kosular, yogun: kosular.length >= ESIK.YOGUN_ISCI });
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

// ── Ekip şeması verisi: kademe grupları (ast-üst), üye durumları, başlık rozetleri ──
const KADEME_SIRA = [["uzman", "Uzman", "opus"], ["hızlı", "Hızlı", "sonnet"], ["hafif", "Hafif", "haiku"]];
export const modelAdi = id => String(id ?? "").replace(/^claude-/, "").replace(/-(\d+)-(\d+)$/, " $1.$2").replace(/^./, c => c.toUpperCase());
/** Üyeleri kademelerine göre gruplar; kademe, üyenin son koşusunun gerçek modelinden (yoksa rolünden) okunur. */
export function kademeGruplari(ekip, kosular) {
  const kdOf = u => { const kk = kademe(durumu(kosular, u)?.model ?? rolu(ekip, u)?.model); return kk === "danışman" ? "uzman" : kk; };
  const uyeler = ekip.uyeler.filter(u => u !== "danisman" && rolu(ekip, u));
  return KADEME_SIRA.map(([kd, etiket, alias]) => ({ kademe: kd, etiket, alias, uyeler: uyeler.filter(u => kdOf(u) === kd) }));
}
const BUTCE_RENK = { bol: "#16A34A", normal: "#0891B2", tasarruf: "#D97706", kritik: "#DC2626" };
export function semaVerisi(ekip, kosular, o = {}) {
  const now = o.now ?? Date.now();
  const pm = alias => o.profil?.modeller?.find(m => m.alias === alias);
  const kademeler = kademeGruplari(ekip, kosular).map(g => {
    const m = pm(g.alias);
    return { kademe: g.kademe, etiket: g.etiket, modelAd: m ? modelAdi(m.id) : g.alias, alt: m ? `${m.gecikme} · ${m.fiyat}` : "",
      uyeler: g.uyeler.map(u => {
        const k = durumu(kosular, u);
        const stat = k ? istatistik(o.adimBellek?.[k.tip], "s") : null;
        return { ad: u, durum: k ? k.durum : "bekliyor", yuzde: k ? yuzde5(ilerleme(k, stat)) : 0,
          sure: k ? sureKisa((k.bitis ?? now) - k.baslangic, k.durum !== "calisiyor") : "",
          gorev: k?.aciklama ?? rolu(ekip, u)?.description ?? "", brif: (o.brifler ?? []).filter(b => b.uye === u).length };
      }) };
  });
  const t = o.tur;
  const maxTur = t ? Math.min(MAX_TUR, BUTCE_AYAR[t.butce ?? "normal"]?.maxTur ?? MAX_TUR) : MAX_TUR;
  const tur = !t ? { yazi: "beklemede", renk: "#A1A1AA" } : t.durum === "calisiyor" ? { yazi: `tur ${t.no}/${maxTur} çalışıyor`, renk: "#0EA5E9" }
    : t.durum === "degerlendiriliyor" ? { yazi: `tur ${t.no} değerlendiriliyor`, renk: "#C026D3" }
    : t.durum === "durduruldu" ? { yazi: "durduruluyor", renk: "#D97706" } : { yazi: `tamamlandı · ${t.no} tur`, renk: "#16A34A" };
  const sk = o.sk;
  const sonKontrol = !sk ? null : sk.durum === "onay" ? { yazi: "son kontrol ✓", renk: "#16A34A" } : sk.durum === "ret" ? { yazi: "son kontrol ✕", renk: "#DC2626" }
    : sk.durum === "bekliyor" ? { yazi: "son kontrol…", renk: "#C026D3" } : { yazi: "son kontrol ?", renk: "#D97706" };
  const mesgul = o.taslak?.durum === "hazirlaniyor" || t?.durum === "degerlendiriliyor" || o.dan?.durum === "bekliyor" || sk?.durum === "bekliyor";
  const fm = pm("fable");
  return {
    ekip: { ad: ekip.ad, amac: ekip.amac }, tur, sonKontrol,
    butce: o.butceDurum ? { yazi: `bütçe ${o.butceDurum.seviye}`, renk: BUTCE_RENK[o.butceDurum.seviye] ?? "#0891B2" } : null,
    danisman: { model: fm ? modelAdi(fm.id) : "Fable", mesgul,
      durum: !mesgul ? "hazır" : sk?.durum === "bekliyor" ? "son kontrol" : o.taslak?.durum === "hazirlaniyor" ? "plan yazıyor" : "düşünüyor",
      is: o.dan?.soru ?? (t ? "" : "görev bekliyor") },
    kademeler,
  };
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
    sonKontrolZamani = Date.now(); // yeniden yüklemede eski işler yeniden kontrol edilmesin
    izleme?.cancel?.();
    izleme = null;
    try { const { value: t = null } = await $.state.get(TUR); if (t?.yogun && t.durum === "calisiyor") izlemeyiBaslat($); } catch {}
    await $.command.register({ name: "ekip", description: "Ajan ekibi panelini aç", argumentHint: "[sor <soru> | kur <hedef> | denetle | kurallar | modeller [yenile] | strateji [yenile] | <serbest istek, sıraya girer>]" });
    try {
      const b = await $.store.get("adimBellek");
      if (b && typeof b === "object") await $.state.set(ADIM_BELLEK, b);
    } catch {}
    try { await yukle($, (await aktifEkip($)).ad); } catch (err) { $.ui.toast(`ekip yüklenemedi: ${String(err).slice(0, 80)}`); }
    // Danışmanın gözü: model izcisi her oturumda kayıtlı (ana modelden gizli); profil haftalıktan eskiyse tazelenir.
    try { await $.agent.register(spec("model-izci")); void profilYasliysaYenile($).catch(() => {}); } catch {}
    return r;
  });

  on("command.run", { command: "ekip" }, async ($, e) => {
    const args = String(e.args ?? "").trim();
    await $.ui.open({ id: PANE, title: "Ajan Ekibi", focus: true, closeOnEscape: true });
    animasyon($);
    if (/^sor\s+/i.test(args)) { void sor($, args.replace(/^sor\s+/i, "")); return { text: "Soru danışmana gitti; cevap panelde." }; }
    if (/^kur\s+/i.test(args)) { void kur($, args.replace(/^kur\s+/i, "")); return { text: "Fable ekibi tasarlıyor; plan onay beklemeden başlar, ilerleme panelde." }; }
    if (/^kurallar\b/i.test(args)) { await $.state.set(DANISMAN, { soru: "Ekip kuralları v2", cevap: KURALLAR, durum: "bitti" }); return { text: KURALLAR }; }
    if (/^modeller\b/i.test(args)) {
      if (/yenile/i.test(args)) { await modelleriYenile($); return { text: "Danışman model profilini Anthropic'in sitesinden tazeliyor (Haiku izci); bitince bildirim gelir, sonra proje stratejisi yenilenir." }; }
      const p = await modelProfili($);
      const metin = `${profilMetni(p)}${p.alinma ? `\n(siteden alındı: ${new Date(p.alinma).toLocaleString("tr-TR")})` : "\n(kodla gelen varsayılan; \"/ekip modeller yenile\" siteden tazeler)"}`;
      await $.state.set(DANISMAN, { soru: "Model profili", cevap: metin, durum: "bitti" });
      return { text: metin };
    }
    if (/^strateji\b/i.test(args)) {
      await $.state.set(DANISMAN, { soru: "Model stratejisi (bu proje)", durum: "bekliyor" });
      const st = await strateji($, { zorla: /yenile/i.test(args) });
      const kayit = await $.store.get(stratejiAnahtari());
      const metin = st ? `${st}${kayit?.proje ? `\n\nProje profili: ${kayit.proje}` : ""}` : "Strateji yazılamadı (danışmana ulaşılamadı).";
      await $.state.set(DANISMAN, { soru: "Model stratejisi (bu proje)", cevap: metin, durum: st ? "bitti" : "hata" });
      return { text: metin };
    }
    // Serbest metin (alt komut değil): sıraya girer, öncekiler bitmeden başlamaz.
    if (/^denetle\b/i.test(args)) {
      await $.state.set(DANISMAN, { soru: "Bütün denetimi", durum: "bekliyor" });
      const metin = await denetle($);
      return { text: metin };
    }
    if (args) {
      const sira = kuyrugaEkle(args, () => kurVeBekle($, args), () => denetle($));
      $.ui.toast(`◆ İstek sıraya alındı (${sira} bekliyor)`);
      return { text: `İstek sıraya alındı (sırada ${sira}). Fable planlayıp işçileri sırayla yönlendirecek; ilerleme panelde.` };
    }
    return { text: "Ajan ekibi paneli açıldı." };
  });

  // Kota penceresi oynadıkça paneldeki bütçe satırı tazelenir (karar anlarında ayrıca okunur).
  on("session.measure", async ($, e, next) => {
    if (e.changed?.includes("rateLimits")) {
      const b = butce(e.rateLimits ?? []);
      await $.state.set(BUTCE, { seviye: b.seviye, ozet: b.ozet });
    }
    return next(e);
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
    const { value: sk = null } = await $.state.get(SON_KONTROL);
    if (sk?.id === e.agentId) { await sonKontrolBitti($, sk.baslik, kosu.cikti, durum === "bitti"); return r; }
    const { value: izci = null } = await $.state.get(IZCI);
    if (izci === e.agentId) { await izciBitti($, kosu.cikti, durum === "bitti"); return r; }
    if (kosu.tur) void turIlerle($, kosu, ad).catch(err => $.ui.toast(`ekip: tur akışı hatası — ${String(err).slice(0, 80)}`));
    else void elleSonKontrol($).catch(err => $.ui.toast(`ekip: son kontrol hatası — ${String(err).slice(0, 80)}`));
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
    const { value: butceDurum = null } = await $.state.get(BUTCE);
    const { value: sk = null } = await $.state.get(SON_KONTROL);
    await $.state.get(SURUM);
    const profil = await modelProfili($);
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
    const uyeSatiri = (u, i, onek = "") => {
      const k = durumu(kosular, u);
      const r = rolu(ekip, u) ?? { model: "?", rol: "isci" };
      const dan_ = r.rol === "danisman";
      const gecen = k ? sure((k.bitis ?? Date.now()) - k.baslangic) : "";
      const stat = k ? istatistik(adimBellek[k.tip], "s") : null;
      const yuzde = k ? `${Math.round(ilerleme(k, stat) * 100)}%`.padStart(4) : "";
      const fableMesgul = dan_ && (taslak?.durum === "hazirlaniyor" || tur?.durum === "degerlendiriliyor" || dan?.durum === "bekliyor");
      const kosuyor = k && k.durum !== "hata" && k.durum !== "iptal" && !(fableMesgul && k.durum !== "calisiyor");
      const tema = k ? temaSec(i, k.baslangic) : null;
      // Renk yalnız danışmanda: "white" açık temada görünmüyordu (8 Eki 2026 ekran görüntüsü).
      const ad = Text({ ...(dan_ ? { color: "magenta" } : {}), bold: true, children: `${dan_ ? "◆" : "▸"} ${u.slice(0, 18).padEnd(19)}` });
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
        return Box({ key: `u-${u}`, flexDirection: "row", children: [...(onek ? [Text({ dimColor: true, children: onek })] : []), ad, Text({ dimColor: true, children: kisaModel(k?.model ?? r.model).padEnd(7) }),
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

    // Uygulama yüzeylerinde başlık + ast-üst şeması tek grafik; terminalde aynı hiyerarşi ağaç çizgileriyle.
    const semaVar = Boolean(Svg) && e.surface !== "terminal";
    const sema = semaVar ? (() => {
      const v = semaVerisi(ekip, kosular, { dan, taslak, tur, sk, butceDurum, brifler, adimBellek, profil });
      const alt = `${ekip.ad}: ${v.tur.yazi}; danışman ${v.danisman.durum}; ` + v.kademeler.map(kd => `${kd.etiket} (${kd.modelAd}): ${kd.uyeler.map(u => `${u.ad} ${u.durum}`).join(", ") || "üye yok"}`).join("; ");
      return Svg({ key: "sema", source: semaSvg(v), alt });
    })() : null;
    const agac = () => {
      const gruplar = kademeGruplari(ekip, kosular).filter(g => g.uyeler.length);
      const satirlar = [uyeSatiri("danisman", 0)];
      let i = 1;
      gruplar.forEach((g, gi) => {
        const son = gi === gruplar.length - 1;
        satirlar.push(Text({ key: `kd-${g.kademe}`, dimColor: true, children: `${son ? "└─" : "├─"} ${g.etiket} · ${g.alias}` }));
        g.uyeler.forEach((u, ui) => satirlar.push(uyeSatiri(u, i++, `${son ? "   " : "│  "}${ui === g.uyeler.length - 1 ? "└ " : "├ "}`)));
      });
      return satirlar;
    };
    // Şemada görev düğmeleri yok: elle yönetimde üyeler için ayrı düğme sırası.
    const uyeDugmeleri = () => girisVar && elleAcik ? [Box({ key: "uyeDug", flexDirection: "row", flexWrap: "wrap", children: ekip.uyeler.slice(0, 9).map((u, i) =>
      Button({ key: `b-${u}`, hotkey: String(i + 1), plain: true, label: `görev: ${u}`, onPress: () => modAyarla({ tur: "gorev", uye: u }) })) })] : [];

    return Box({
      flexDirection: "column", paddingX: 1,
      children: semaVar ? [sema, ...ortak(uyeDugmeleri())] : [
        Box({ key: "bas", flexDirection: "row", children: [
          Text({ color: "magenta", bold: true, children: `◆ ${ekip.ad}` }),
          Text({ dimColor: true, children: `  ${ekip.amac}` }),
          Text({ color: calisan ? "cyan" : "gray", children: `  ·  ${calisan}/${ekip.uyeler.length} çalışıyor` }),
        ] }),
        ...(ekip.oto || tur || !elleAcik ? [Box({ key: "tur", flexDirection: "row", children: [
          Text({ dimColor: true, children: `  Fable yönetir · Opus uzman · Sonnet hızlı · Haiku hafif${tur ? ` · ${tur.yogun ? "yoğun iş" : "basit iş"}` : ""}  ·  ` }),
          Text({ color: tur?.durum === "bitti" ? "green" : tur?.durum === "durduruldu" ? "yellow" : "cyan", children:
            !tur ? "beklemede" : tur.durum === "calisiyor" ? `${spin} tur ${tur.no}/${Math.min(MAX_TUR, BUTCE_AYAR[tur.butce ?? "normal"]?.maxTur ?? MAX_TUR)} çalışıyor`
              : tur.durum === "degerlendiriliyor" ? `${spin} Fable tur ${tur.no}'i değerlendiriyor`
              : tur.durum === "durduruldu" ? `⏸ tur ${tur.no} sonunda durdurulacak` : `🏁 tamamlandı (${tur.no} tur)` }),
        ] })] : []),
        // Bütçe (§7) ve son kontrol durumu.
        ...(butceDurum ? [Box({ key: "butce", flexDirection: "row", children: [
          Text({ dimColor: true, children: "  Bütçe: " }),
          Text({ color: { bol: "green", normal: "cyan", tasarruf: "yellow", kritik: "red" }[butceDurum.seviye] ?? "cyan", children: butceDurum.seviye }),
          Text({ dimColor: true, children: `  ·  ${tek(butceDurum.ozet, genis ? 90 : 50)}` }),
        ] })] : []),
        ...(sk ? [Box({ key: "sk", flexDirection: "row", children: [
          Text({ dimColor: true, children: "  Son kontrol: " }),
          Text({ color: sk.durum === "onay" ? "green" : sk.durum === "ret" ? "red" : sk.durum === "bekliyor" ? "magenta" : "yellow",
            children: sk.durum === "bekliyor" ? `${spin} danışman kontrol ediyor` : sk.durum === "onay" ? "✔ ONAY" : sk.durum === "ret" ? `✖ RET — ${tek(sk.neden, 50)}` : `⚠ ${tek(sk.neden, 50)}` }),
          Text({ dimColor: true, children: `  ·  ${tek(sk.baslik, 40)}` }),
        ] })] : []),
        ...ortak([Box({ key: "uyeler", flexDirection: "column", marginTop: 1, children: agac() })]),
      ],
    });

    // Plan, giriş, koşular, brifler, danışman çıktısı ve tuşlar: iki görünümde ortak; üye bölümü görünüme göre.
    function ortak(uyeBolum) {
      return [
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
        ...uyeBolum,
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
      ];
    }
  });
}
