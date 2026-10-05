const P = "ekip";
const KOSULAR = { plugin: "ekip", key: "kosular" };
const DANISMAN = { plugin: "ekip", key: "danisman" };
const MOD = { plugin: "ekip", key: "mod" };
const FRAME = { plugin: "ekip", key: "frame" };
const AKTIF = { plugin: "ekip", key: "aktif" };
const SURUM = { plugin: "ekip", key: "surum" }; // ekip listesi değişince paneli yeniden çizdirir
const INCELEME = { plugin: "ekip", key: "incelemeId" };
const PANE = "ekip";

export const DANISMAN_MODEL = "claude-fable-5-1";
const YEDEK_MODEL = "opus";
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
    rol: "isci", model: "sonnet", maxTurns: 25,
    description: "STM32 HAL/LL firmware analizi: clock, DMA/IRQ öncelikleri, ISR güvenliği, RTOS, güç modları.",
    prompt: "STM32 HAL/LL kodunu analiz et: clock tree, DMA/IRQ öncelikleri, ISR içinde blocking çağrı, HAL_Delay, RTOS stack, güç modları. Bulguları dosya:satır ve RM/datasheet referansıyla, ciddiyete göre sırala. Türkçe yaz.",
    tools: ["Read", "Grep", "Glob"],
  },
  "test-yazici": {
    rol: "isci", model: "sonnet", maxTurns: 30, permissionMode: "acceptEdits",
    description: "Verilen modül için birim test yazar, çalıştırır ve sonucu özetler.",
    prompt: "Verilen modül için projenin test çerçevesiyle (Unity/CMocka/pytest...) birim test yaz, çalıştır, sonucu özetle. Mevcut testleri kırma; mevcut dosyada yalnız değişen bloğu düzenle. Türkçe özetle.",
    tools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
  },
  "kod-inceleyici": {
    rol: "isci", model: "sonnet", maxTurns: 15,
    description: "Değişiklikleri inceler: hata, yarış durumu, sınır koşulu, bellek ve ISR güvenliği.",
    prompt: "Değişiklikleri (git diff) incele: hata, yarış durumu, sınır koşulu, bellek, ISR güvenliği. Ciddiyete göre sıralı liste ver, dosya:satır belirt. Düzeltme yazma, bulgu ver. Türkçe yaz.",
    tools: ["Read", "Grep", "Glob", "Bash"],
  },
  "arayuz-gelistirici": {
    rol: "isci", model: "sonnet", maxTurns: 30, permissionMode: "acceptEdits",
    description: "ThingsBoard ve web dashboard arayüzü geliştirir: widget, telemetri, kullanıcı dostu UI.",
    prompt: "ThingsBoard widget/dashboard ve web arayüzü geliştir. Son kullanıcı deneyimini öncele; telemetri anahtarlarını cihaz tarafıyla uyumlu tut. Mevcut dosyada yalnız değişen bloğu düzenle. Türkçe özetle.",
    tools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
  },
  dokumantasyoncu: {
    rol: "isci", model: "haiku", maxTurns: 10,
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
export function spec(name) {
  const { rol, ...r } = ROLLER[name];
  return { name, ...r };
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
    if (!ROLLER[u]) continue;
    try { await $.agent.register(spec(u)); } catch (err) { $.ui.toast(`ekip: ${u} kaydedilemedi (${String(err).slice(0, 60)})`); }
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
    if (!k.some(x => x.durum === "calisiyor")) { ticker?.cancel?.(); ticker = null; return; }
    const { value: f = 0 } = await $.state.get(FRAME);
    await $.state.set(FRAME, f + 1);
  });
}

async function sor($, soru) {
  const ekip = await aktifEkip($);
  await $.state.set(DANISMAN, { soru, durum: "bekliyor" });
  const istek = {
    system: `${ROLLER.danisman.prompt}\n\nAktif ekip: ${ekip.ad} — ${ekip.amac}. Üyeler: ${ekip.uyeler.join(", ")}.`,
    prompt: soru, maxTokens: 1500, timeoutMs: 120_000,
  };
  let not;
  let r;
  try {
    r = await $.model.complete({ ...istek, model: DANISMAN_MODEL });
  } catch {
    not = `${DANISMAN_MODEL} erişilemedi, ${YEDEK_MODEL} kullanıldı`;
    try { r = await $.model.complete({ ...istek, model: YEDEK_MODEL }); } catch (err) { r = { isAnswered: false, reason: String(err) }; }
  }
  await $.state.set(DANISMAN, r.isAnswered
    ? { soru, cevap: r.text.slice(0, 9000), durum: "bitti", ...(not ? { not } : {}) }
    : { soru, cevap: `Cevap alınamadı: ${r.reason}`, durum: "hata" });
}

async function kosuEkle($, id, tip, aciklama, model) {
  const { value: k = [] } = await $.state.get(KOSULAR);
  if (k.some(x => x.id === id)) return;
  await $.state.set(KOSULAR, [...k, { id, tip, aciklama: tek(aciklama, 50), model, baslangic: Date.now(), durum: "calisiyor" }].slice(-MAX_KOSU));
  cark($);
}

// $.agent.spawn kendi agent.spawn hook'umuzdan geçmez: koşuyu burada elle kaydet.
export async function baslat($, uye, gorev) {
  const r = await $.agent.spawn({ subagentType: `${P}:${uye}`, prompt: gorev, description: tek(gorev, 40) });
  if (r.deny) $.ui.toast(`ekip: ${uye} başlatılamadı — ${r.deny}`);
  else if (r.agentId) await kosuEkle($, r.agentId, `${P}:${uye}`, gorev, r.model);
  return r;
}

export function register(on) {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    ticker?.cancel?.();
    ticker = null;
    await $.command.register({ name: "ekip", description: "Ajan ekibi panelini aç", argumentHint: "[sor <soru>]" });
    try { await yukle($, (await aktifEkip($)).ad); } catch (err) { $.ui.toast(`ekip yüklenemedi: ${String(err).slice(0, 80)}`); }
    return r;
  });

  on("command.run", { command: "ekip" }, async ($, e) => {
    const args = String(e.args ?? "").trim();
    await $.ui.open({ id: PANE, title: "Ajan Ekibi", focus: true, closeOnEscape: true });
    if (/^sor\s+/i.test(args)) { void sor($, args.replace(/^sor\s+/i, "")); return { text: "Soru danışmana gitti; cevap panelde." }; }
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
    const ad = kosu.tip.startsWith(`${P}:`) ? kosu.tip.slice(P.length + 1) : kosu.tip;
    $.ui.toast(`${durum === "bitti" ? "✔" : "✖"} ${ad} ${durum} (${sure(kosu.bitis - kosu.baslangic)})`);
    const { value: inc = null } = await $.state.get(INCELEME);
    if (inc === e.agentId) {
      await $.state.set(DANISMAN, { soru: "Ekip çıktılarını incele", cevap: kosu.cikti, durum: durum === "bitti" ? "bitti" : "hata" });
      await $.state.set(INCELEME, null);
    }
    return r;
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input, Select, Markdown } = $.ui.resolve(e);
    const { value: kosular = [] } = await $.state.get(KOSULAR);
    const { value: dan = null } = await $.state.get(DANISMAN);
    const { value: mod = null } = await $.state.get(MOD);
    const { value: frame = 0 } = await $.state.get(FRAME);
    await $.state.get(SURUM);
    const liste = await ekipler($);
    const ekip = await aktifEkip($);
    const genis = (e.props.bodyColumns ?? 80) >= 70;
    const spin = SPIN[frame % SPIN.length];
    const calisan = kosular.filter(k => k.durum === "calisiyor").length;
    const modAyarla = m => void $.state.set(MOD, m);
    const girisVar = Boolean(Input && Select);

    const uyeSatiri = (u, i) => {
      const k = durumu(kosular, u);
      const r = ROLLER[u] ?? { model: "?", rol: "isci" };
      const [ikon, renk, yazi] = !k ? ["·", "gray", "bekliyor"]
        : k.durum === "calisiyor" ? [spin, "cyan", `çalışıyor ${sure(Date.now() - k.baslangic)}`]
        : k.durum === "bitti" ? ["✔", "green", `bitti ${sure(k.bitis - k.baslangic)}`]
        : ["✖", "red", `${k.durum} ${sure((k.bitis ?? k.baslangic) - k.baslangic)}`];
      return Box({
        key: `u-${u}`, flexDirection: "row",
        children: [
          Text({ color: r.rol === "danisman" ? "magenta" : "white", bold: r.rol === "danisman", children: `${r.rol === "danisman" ? "◆" : "▸"} ${u.padEnd(19)}` }),
          Text({ dimColor: true, children: `${kisaModel(r.model).padEnd(10)}` }),
          Text({ color: renk, children: `${ikon} ${yazi}`.padEnd(18) }),
          ...(girisVar && i < 9 ? [Button({ key: `b-${u}`, hotkey: String(i + 1), plain: true, label: "görev ver", onPress: () => modAyarla({ tur: "gorev", uye: u }) })] : []),
        ],
      });
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
