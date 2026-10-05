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
const ORNEK_MAX = 40;
const PANE = "ekip";

// Takma adlar Claude Code tarafından her zaman ailenin en güncel sürümüne çözülür:
// yeni Fable/Opus çıkınca mod değişmeden onlara geçer.
export const DANISMAN_MODEL = "fable";
export const ISCI_MODEL = "opus";
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
    prompt: "Sen gömülü sistemler ve yazılım mimarisi danışmanısın; ekibin lideri gibi düşün. Önce 3 maddelik özet, sonra gerekçe, sonra riskler ve sıradaki adımlar. Kod yazma; karar ver, görev dağıt, çıktıları denetle. Türkçe yaz.",
    tools: ["Read", "Grep", "Glob"],
  },
  "firmware-analist": {
    rol: "isci", model: ISCI_MODEL, maxTurns: 25,
    description: "STM32 HAL/LL firmware analizi: clock, DMA/IRQ öncelikleri, ISR güvenliği, RTOS, güç modları.",
    prompt: "STM32 HAL/LL kodunu analiz et: clock tree, DMA/IRQ öncelikleri, ISR içinde blocking çağrı, HAL_Delay, RTOS stack, güç modları. Bulguları dosya:satır ve RM/datasheet referansıyla, ciddiyete göre sırala. Türkçe yaz.",
    tools: ["Read", "Grep", "Glob"],
  },
  "test-yazici": {
    rol: "isci", model: ISCI_MODEL, maxTurns: 30, permissionMode: "acceptEdits",
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
    rol: "isci", model: ISCI_MODEL, maxTurns: 10,
    description: "README, Doxygen başlıkları ve modül dokümantasyonu üretir.",
    prompt: "Modül/README/Doxygen dokümantasyonu üret; projenin mevcut tarzını koru; kısa ve net yaz.",
    tools: ["Read", "Grep", "Glob", "Write"],
  },
};

export const SABLON_EKIPLER = [
  { ad: "Firmware ekibi", amac: "STM32 firmware geliştirme, test ve inceleme", uyeler: ["danisman", "firmware-analist", "test-yazici", "kod-inceleyici"] },
  { ad: "Arayüz ekibi", amac: "ThingsBoard/dashboard arayüzü ve dokümantasyon", uyeler: ["danisman", "arayuz-gelistirici", "dokumantasyoncu"] },
];

let aktifUyeler = new Set();
let ticker = null;

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
      [".#######.", "##.###.##", ".#######.", ".#.#.#.#."],
      [".#######.", "##.###.##", ".#######.", "#.#.#.#.#"]],
    gok: ["°", " ", " ", " ", " ", "∘", " ", " "], zemin: ["_", " ", ".", " "], izUst: " ", izAlt: "∴", izRenk: "#D97757" },
  { ad: "yarış", renk: "red", kare: [
      ["#.####....", ".#########", "##########", ".##....##."],
      ["#.####....", ".#########", "##########", ".#.#..#.#."]],
    gok: [" ", " ", " ", " "], zemin: ["─", "─", " ", " "], izUst: " ", izAlt: "═", izRenk: "red" },
  { ad: "yelken", renk: "white", kare: [
      ["....#.....", "....##....", "#########.", ".#######.."],
      ["....#.....", "....###...", "#########.", ".#######.."]],
    gok: [" ", "ᵥ", " ", " ", " ", " "], zemin: ["~", "≈", "~", " "], izUst: " ", izAlt: "≈", izRenk: "cyan" },
  { ad: "uçuş", renk: "blue", kare: [
      ["#........#", "#########.", "..###....#", ".........."],
      ["#.........", "##########", "..###.....", ".........."]],
    gok: ["∘", " ", " ", " ", " "], zemin: [" ", " ", "·", " ", " ", " "], izUst: "╌", izAlt: " ", izRenk: "blue" },
  { ad: "maraton", renk: "yellow", kare: [
      ["...##", "..###", "..#..", ".#..#"],
      ["...##", "..##.", "..#..", "..##."]],
    gok: [" ", " ", " ", " "], zemin: ["·", " ", " "], izUst: " ", izAlt: ",", izRenk: "yellow" },
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
  const akis = frame >> 1;
  const manzara = (desen, bas, n) => Array.from({ length: n }, (_, i) => desen[(bas + i + akis) % desen.length]).join("");
  const iz = (ch, n) => (n > 0 ? ch.repeat(n) : "");
  const kalan = W - pos - aw;
  const renk = bitti ? "green" : tema.renk;
  const bayrak = BAYRAK[bitti ? 0 : adim];
  const parca = (izCh, sprite, desen, b) => [
    ...(pos > 3 ? [{ color: tema.izRenk, dimColor: true, children: iz(izCh, pos - 3) }] : []),
    ...(pos > 0 ? [{ color: tema.izRenk, children: iz(izCh, Math.min(3, pos)) }] : []),
    { color: renk, bold: true, children: sprite },
    ...(kalan > 0 ? [{ dimColor: true, children: manzara(desen, pos + aw, kalan) }] : []),
    { color: "white", dimColor: bitti, children: b },
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
    uyeler.push({
      name, rol: "isci", model: ISCI_MODEL, maxTurns: 30,
      description: tek(u.aciklama || u.ad, 150),
      prompt: `${tek(u.talimat || u.aciklama || "", 1500)}\n\nMevcut dosyada yalnız değişen bloğu düzenle. Sonunda Türkçe kısa özet ver.`,
      tools: tools.length ? tools : ["Read", "Grep", "Glob"],
      ...(tools.some(t => t === "Edit" || t === "Write") ? { permissionMode: "acceptEdits" } : {}),
      gorev: tek(u.gorev, 1500),
    });
  }
  return uyeler.length ? { ad: tek(j.ad || "Fable ekibi", 40), amac: tek(j.amac || "", 120), uyeler } : null;
}
export function atamalar(j, ekip) {
  if (!j || !Array.isArray(j.sonraki)) return [];
  return j.sonraki
    .map(a => ({ uye: adTemizle(a?.uye), gorev: tek(a?.gorev, 1500) }))
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
  if (Array.isArray(kayit) && kayit.length) return kayit;
  await $.store.set("ekipler", SABLON_EKIPLER);
  return SABLON_EKIPLER;
}

async function aktifEkip($) {
  const liste = await ekipler($);
  const ad = await $.store.get("aktif");
  return liste.find(x => x.ad === ad) ?? liste[0];
}

async function yukle($, ad) {
  const liste = await ekipler($);
  const ekip = liste.find(x => x.ad === ad) ?? liste[0];
  await $.store.set("aktif", ekip.ad);
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

function cark($) {
  if (ticker) return;
  ticker = $.clock.every(150, async () => {
    const { value: k = [] } = await $.state.get(KOSULAR);
    const { value: taslak = null } = await $.state.get(TASLAK);
    const { value: tur = null } = await $.state.get(TUR);
    const { value: dan = null } = await $.state.get(DANISMAN);
    const hareket = k.some(x => x.durum === "calisiyor") || taslak?.durum === "hazirlaniyor" ||
      tur?.durum === "degerlendiriliyor" || dan?.durum === "bekliyor";
    if (!hareket) { ticker?.cancel?.(); ticker = null; return; }
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

const KULLANICI = "Kullanıcı STM32/HAL, Altium ve ThingsBoard ile çalışan bir donanım AR-GE mühendisi; token tasarrufu ve diff disiplini önemli.";
const KUR_SISTEM = `Sen ekip kurucu danışmansın. Kullanıcının hedefine göre en fazla ${MAX_UYE} işçi ajanlı bir ekip tasarla ve her üyeye ilk somut görevini ata. İşçiler en güncel Opus ile çalışır; sen ekibin danışmanısın. Paralel çalışacakları için aynı dosyayı iki üyeye verme. ${KULLANICI}
Yalnız JSON döndür, başka metin yazma:
{"ad":"Ekip adı","amac":"tek cümle","uyeler":[{"ad":"kisa-ad","aciklama":"ne zaman çağrılır","talimat":"üyenin kalıcı sistem talimatı","araclar":["Read","Grep","Glob","Edit","Write","Bash","WebFetch","WebSearch" içinden gerekenler],"gorev":"ilk görev, somut ve doğrulanabilir"}]}`;
const DEGER_SISTEM = `Sen ekibin danışmanısın. İşçilerin bu turdaki çıktılarını değerlendir; hedef tamamlanmadıysa sıradaki görevleri ata. ${KULLANICI}
Yalnız JSON döndür: {"degerlendirme":"kısa markdown: ne bitti, ne riskli","bitti":true|false,"sonraki":[{"uye":"üye adı","gorev":"somut görev"}]}`;

async function kur($, hedef) {
  await $.state.set(TASLAK, { durum: "hazirlaniyor", hedef });
  cark($);
  const r = await fable($, { system: KUR_SISTEM, prompt: `Hedef: ${hedef}`, maxTokens: 3000, timeoutMs: 180_000 });
  const taslak = r.isAnswered ? planDogrula(jsonAl(r.text)) : null;
  await $.state.set(TASLAK, taslak
    ? { durum: "hazir", hedef, ...taslak, ...notu(r) }
    : { durum: "hata", hedef, hata: r.isAnswered ? "Fable'ın planı okunamadı; hedefi biraz daha somut yaz." : `Fable'a ulaşılamadı: ${r.reason}` });
}

async function onayla($) {
  const { value: taslak = null } = await $.state.get(TASLAK);
  if (taslak?.durum !== "hazir") return;
  const liste = await ekipler($);
  let ad = taslak.ad;
  for (let n = 2; liste.some(x => x.ad === ad); n++) ad = `${taslak.ad} ${n}`;
  const ozel = Object.fromEntries(taslak.uyeler.map(({ gorev, ...u }) => [u.name, u]));
  const ekip = { ad, amac: taslak.amac, hedef: taslak.hedef, oto: true, uyeler: ["danisman", ...taslak.uyeler.map(u => u.name)], ozel };
  await kaydet($, [...liste, ekip]);
  await yukle($, ad);
  await $.state.set(TASLAK, null);
  await $.state.set(TUR, { no: 1, durum: "calisiyor" });
  for (const u of taslak.uyeler) await baslat($, u.name, u.gorev, 1);
  $.ui.toast(`◆ ${ad}: Fable ${taslak.uyeler.length} üyeye görev atadı`);
}

// Tur bitince Fable çıktıları değerlendirir ve sıradaki görevleri kendisi atar.
async function turBitti($, no) {
  const { value: k = [] } = await $.state.get(KOSULAR);
  const { value: tur = null } = await $.state.get(TUR);
  if (!tur || tur.no !== no || tur.durum !== "calisiyor") return;
  if (k.some(x => x.tur === no && x.durum === "calisiyor")) return;
  const ekip = await aktifEkip($);
  if (!ekip.oto) return;
  await $.state.set(TUR, { no, durum: "degerlendiriliyor" });
  await $.state.set(DANISMAN, { soru: `Tur ${no} değerlendirmesi`, durum: "bekliyor" });
  cark($);
  const ciktilar = k.filter(x => x.tur === no)
    .map(x => `### ${x.tip.slice(P.length + 1)} (${x.durum}) — ${x.aciklama}\n${tek(x.cikti, 1800)}`).join("\n\n");
  const r = await fable($, {
    system: DEGER_SISTEM, maxTokens: 2500, timeoutMs: 180_000,
    prompt: `Ekip: ${ekip.ad}. Hedef: ${ekip.hedef ?? ekip.amac}. Üyeler: ${ekip.uyeler.filter(u => u !== "danisman").join(", ")}. Tur ${no}/${MAX_TUR}.\n\n${ciktilar}`,
  });
  const j = r.isAnswered ? jsonAl(r.text) : null;
  await $.state.set(DANISMAN, {
    soru: `Tur ${no} değerlendirmesi`, durum: r.isAnswered ? "bitti" : "hata", ...notu(r),
    cevap: r.isAnswered ? String(j?.degerlendirme ?? r.text).slice(0, 9000) : `Değerlendirme alınamadı: ${r.reason}`,
  });
  const { value: simdi = null } = await $.state.get(TUR);
  const sonraki = atamalar(j, ekip);
  if (simdi?.durum === "durduruldu" || j?.bitti || !sonraki.length || no >= MAX_TUR) {
    if (simdi?.durum !== "durduruldu") await $.state.set(TUR, { no, durum: "bitti" });
    $.ui.toast(j?.bitti ? `🏁 ${ekip.ad}: Fable hedefi tamamlandı saydı` : `◆ ${ekip.ad}: tur ${no} bitti, yeni atama yok`);
    return;
  }
  await $.state.set(TUR, { no: no + 1, durum: "calisiyor" });
  for (const a of sonraki) await baslat($, a.uye, a.gorev, no + 1);
  $.ui.toast(`◆ Fable tur ${no + 1} için ${sonraki.length} görev atadı`);
}

async function kosuEkle($, id, tip, aciklama, model, tur) {
  const { value: k = [] } = await $.state.get(KOSULAR);
  if (k.some(x => x.id === id)) return;
  const kosu = { id, tip, aciklama: tek(aciklama, 50), model, baslangic: Date.now(), durum: "calisiyor", adim: 0, ...(tur ? { tur } : {}) };
  await $.state.set(KOSULAR, [...k, kosu].slice(-MAX_KOSU));
  cark($);
}

// $.agent.spawn kendi agent.spawn hook'umuzdan geçmez: koşuyu burada elle kaydet.
export async function baslat($, uye, gorev, tur) {
  const r = await $.agent.spawn({ subagentType: `${P}:${uye}`, prompt: gorev, description: tek(gorev, 40) });
  if (r.deny) $.ui.toast(`ekip: ${uye} başlatılamadı — ${r.deny}`);
  else if (r.agentId) await kosuEkle($, r.agentId, `${P}:${uye}`, gorev, r.model, tur);
  return r;
}

export function register(on) {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    ticker?.cancel?.();
    ticker = null;
    await $.command.register({ name: "ekip", description: "Ajan ekibi panelini aç", argumentHint: "[sor <soru> | kur <hedef>]" });
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
    if (/^sor\s+/i.test(args)) { void sor($, args.replace(/^sor\s+/i, "")); return { text: "Soru danışmana gitti; cevap panelde." }; }
    if (/^kur\s+/i.test(args)) { void kur($, args.replace(/^kur\s+/i, "")); return { text: "Fable ekibi tasarlıyor; plan panelde onayını bekleyecek." }; }
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
    if (kosu.tur) void turBitti($, kosu.tur);
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
    const { Box, Text, Button, Input, Select, Markdown } = $.ui.resolve(e);
    const { value: kosular = [] } = await $.state.get(KOSULAR);
    const { value: dan = null } = await $.state.get(DANISMAN);
    const { value: mod = null } = await $.state.get(MOD);
    const { value: frame = 0 } = await $.state.get(FRAME);
    const { value: taslak = null } = await $.state.get(TASLAK);
    const { value: tur = null } = await $.state.get(TUR);
    const { value: adimBellek = {} } = await $.state.get(ADIM_BELLEK);
    await $.state.get(SURUM);
    const liste = await ekipler($);
    const ekip = await aktifEkip($);
    const genis = (e.props.bodyColumns ?? 80) >= 88;
    const spin = SPIN[frame % SPIN.length];
    const calisan = kosular.filter(k => k.durum === "calisiyor").length;
    const modAyarla = m => void $.state.set(MOD, m);
    const girisVar = Boolean(Input && Select);

    // Geniş panelde her üye 2 satırlık bir şerit: üstte ad + gökyüzü, altta model + zemin.
    // Dar panelde (ya da mobilde) tek satırlık özet.
    const SW = SERIT_W + 2;
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
      const buton = girisVar && i < 9 ? [Text({ children: "  " }), Button({ key: `b-${u}`, hotkey: String(i + 1), plain: true, label: "görev ver", onPress: () => modAyarla({ tur: "gorev", uye: u }) })] : [];
      const sag = kosuyor
        ? [Text({ color: k.durum === "bitti" ? "green" : "cyan", bold: true, children: ` ${yuzde}` }), Text({ dimColor: true, children: ` ${gecen.padStart(5)}` })]
        : [Text({ children: " ".repeat(11) })];
      if (!genis) {
        const ozet = fableMesgul ? `${spin} düşünüyor` : !k ? "· bekliyor" : k.durum === "hata" || k.durum === "iptal" ? `✖ ${k.durum} ${gecen}`
          : `${k.durum === "bitti" ? "✔" : spin} ${yuzde} ${gecen}`;
        return Box({ key: `u-${u}`, flexDirection: "row", children: [ad, Text({ dimColor: true, children: kisaModel(r.model).padEnd(7) }),
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
      if (mod.tur === "kur") return [Input({ key: "kur", autoFocus: true, label: "Hedef (Fable ekibi kursun)", placeholder: "örn. STM32 UART DMA sürücüsünü yaz, test et, belgele", submitLabel: "tasarla",
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

    return Box({
      flexDirection: "column", paddingX: 1,
      children: [
        Box({ key: "bas", flexDirection: "row", children: [
          Text({ color: "magenta", bold: true, children: `◆ ${ekip.ad}` }),
          Text({ dimColor: true, children: `  ${ekip.amac}` }),
          Text({ color: calisan ? "cyan" : "gray", children: `  ·  ${calisan}/${ekip.uyeler.length} çalışıyor` }),
        ] }),
        ...(ekip.oto || tur ? [Box({ key: "tur", flexDirection: "row", children: [
          Text({ dimColor: true, children: "  Fable atıyor, Opus yürütüyor  ·  " }),
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
          Text({ dimColor: true, children: kosular.length ? "Son koşular" : "Henüz koşu yok — bir üyeye görev ver (1-9) ya da ana model ajan çağırsın." }),
          ...kosular.slice(-5).map(kosuSatiri),
        ] }),
        ...(dan ? [Box({ key: "dan", flexDirection: "column", marginTop: 1, children: [
          Text({ color: "magenta", bold: true, children: `◆ Danışman: ${tek(dan.soru, 70)}` }),
          ...(dan.not ? [Text({ color: "yellow", children: `  ${dan.not}` })] : []),
          dan.durum === "bekliyor"
            ? Text({ color: "cyan", children: `  ${spin} düşünüyor…` })
            : Markdown ? Markdown({ key: "cevap", text: dan.cevap ?? "", dimColor: dan.durum === "hata" }) : Text({ children: dan.cevap ?? "" }),
        ] })] : []),
        ...(girisVar ? [Box({ key: "eylem", flexDirection: "row", flexWrap: "wrap", marginTop: 1, children: [
          ...(taslak?.durum === "hazir" ? [
            Button({ key: "onay", hotkey: "o", variant: "primary", label: "Planı onayla ve başlat", onPress: () => void onayla($) }),
            eylem("red", "r", "Reddet", () => void $.state.set(TASLAK, null)),
          ] : [eylem("kur", "k", "Fable ekip kursun", () => modAyarla({ tur: "kur" }))]),
          ...(tur && (tur.durum === "calisiyor" || tur.durum === "degerlendiriliyor") ? [eylem("dur", "p", "Durdur", () => void $.state.set(TUR, { ...tur, durum: "durduruldu" }))] : []),
          eylem("sor", "s", "Danışmana sor", () => modAyarla({ tur: "soru" })),
          eylem("inc", "i", "Çıktıları incelet", () => void incelet()),
          eylem("deg", "e", "Ekip değiştir", () => modAyarla({ tur: "ekip" })),
          eylem("yeni", "y", "Yeni ekip", () => modAyarla({ tur: "yeni" })),
          eylem("ekle", "u", "Üye ekle", () => modAyarla({ tur: "uye" })),
          eylem("cik", "x", "Üye çıkar", () => modAyarla({ tur: "cikar" })),
          eylem("tem", "t", "Temizle", () => { void $.state.set(KOSULAR, kosular.filter(k => k.durum === "calisiyor")); void $.state.set(DANISMAN, null); }),
        ] })] : [Text({ key: "mobil", dimColor: true, children: "Bu yüzeyde yalnız izleme var; yönetim terminal/masaüstünde." })]),
      ],
    });
  });
}
