import { isKarti } from "./cam.mjs";

const ENABLED = { plugin: "diff-disiplin", key: "enabled" };
const INJECTED = { plugin: "diff-disiplin", key: "injected" };
const TURN = { plugin: "diff-disiplin", key: "turn" };
const BELLEK = { plugin: "diff-disiplin", key: "bellek" };
const KAT = { plugin: "diff-disiplin", key: "kat" };
const FRAME = { plugin: "diff-disiplin", key: "frame" };
const BLOCKED = { plugin: "diff-disiplin", key: "blocked" };
const EDITS = { plugin: "diff-disiplin", key: "edits" };
const ALLOW_WRITE = { plugin: "diff-disiplin", key: "allowWrite" };
const TOAST_MS = 20_000;

const SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const BAR_W = 24;
const DEFAULT_ETA = 30_000;
let ticker;

// ── İş belleği: her işin türü, süresi ve araç adımı saklanır; tahmin bunlardan gelir ──
const ORNEK_MAX = 40;   // kategori başına son 40 iş
const MIN_ORNEK = 3;    // daha azında genel ortalamaya, o da yoksa varsayılana düşer
export const KATEGORILER = [
  ["hata", /(?<!\p{L})(hata|bug|düzelt|fix|çalışmıyor|crash|exception|error|patlıyor)/iu],
  ["test", /(?<!\p{L})(test|unit|unity|pytest|doğrula)/iu],
  ["refactor", /(?<!\p{L})(refactor|sadeleştir|temizle|yeniden düzenle|rename|taşı)/iu],
  ["dokuman", /(?<!\p{L})(readme|doküman|dokuman|belgele|doxygen|yorum satır)/iu],
  ["ozellik", /(?<!\p{L})(ekle|yeni|oluştur|yaz|kur|implement|add|create|build|geliştir)/iu],
  ["analiz", /(\?|(?<!\p{L})(neden|nasıl|açıkla|incele|araştır|analiz|why|how|explain))/iu],
];
export const KAT_AD = { hata: "hata düzeltme", test: "test", refactor: "refactor", dokuman: "doküman", ozellik: "yeni özellik", analiz: "analiz/soru", diger: "diğer" };
export function kategori(text) {
  const t = String(text ?? "");
  for (const [k, re] of KATEGORILER) if (re.test(t)) return k;
  return "diger";
}
// Aritmetik ortalama ve örneklem standart sapması (n-1).
export function istatistik(ornekler, alan) {
  const x = ornekler.map(o => o[alan]).filter(Number.isFinite);
  const n = x.length;
  if (!n) return { n: 0, ort: 0, ss: 0 };
  const ort = x.reduce((a, b) => a + b, 0) / n;
  const ss = n > 1 ? Math.sqrt(x.reduce((a, b) => a + (b - ort) ** 2, 0) / (n - 1)) : 0;
  return { n, ort, ss };
}
// ── Kendini düzelten tahmin ──
// 1) Süreler sağa çarpık (aynı türde 30 sn de olur 1 saat de): log-normal model, ağırlıklı log ortalama/sapma.
// 2) Yeni işler daha ağır basar (yarı ömür 10 iş): alışkanlık değişince tahmin peşinden gelir.
// 3) Her iş başında yapılan tahmin örneğe yazılır (t); biten işlerin gerçek/tahmin oranından türün
//    sistematik sapması öğrenilir ve sonraki tahminlere düzeltme olarak eklenir (az örnekte sıfıra çekilir).
// 4) İş sürerken: geçen süre ve atılan adım bilinince koşullu medyan; adım hızı kalan süreyi canlı düzeltir.
const YARI_OMUR = 10;
const VARSAYILAN = { mu: Math.log(DEFAULT_ETA), sg: 0.8 };
const agirliklar = n => Array.from({ length: n }, (_, i) => 0.5 ** ((n - 1 - i) / YARI_OMUR));
export function logIstatistik(ornekler, alan) {
  const x = ornekler.map(o => o?.[alan]).filter(v => Number.isFinite(v) && v > 0);
  const n = x.length;
  if (!n) return null;
  const w = agirliklar(n), W = w.reduce((a, b) => a + b, 0);
  const mu = x.reduce((a, v, i) => a + w[i] * Math.log(v), 0) / W;
  const varyans = x.reduce((a, v, i) => a + w[i] * (Math.log(v) - mu) ** 2, 0) / W * (n > 1 ? n / (n - 1) : 1);
  return { n, mu, sg: n > 1 ? Math.max(0.25, Math.sqrt(varyans)) : 0.7 };
}
// Türün sistematik sapması: ln(gerçek/tahmin) ağırlıklı ortalaması, n/(n+3) ile küçültülür.
export function duzeltme(ornekler) {
  const r = (ornekler ?? []).filter(o => o?.t > 0 && o.d > 0).map(o => Math.log(o.d / o.t));
  if (r.length < 2) return 0;
  const w = agirliklar(r.length), W = w.reduce((a, b) => a + b, 0);
  return r.reduce((a, v, i) => a + w[i] * v, 0) / W * r.length / (r.length + 3);
}
// Son 20 işte tahminin tuttuğu oran: medyan |gerçek - tahmin| / gerçek.
export function sapma(ornekler) {
  const e = (ornekler ?? []).filter(o => o?.c > 0 && o.d > 0).slice(-20).map(o => Math.abs(o.d - o.c) / o.d).sort((a, b) => a - b);
  return e.length ? e[Math.floor(e.length / 2)] : null;
}
export function tahmin(bellek, kat) {
  const kendi = bellek?.[kat] ?? [];
  const hepsi = Object.values(bellek ?? {}).flat().sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const [ornek, kaynak] = kendi.length >= MIN_ORNEK ? [kendi, kat] : hepsi.length >= MIN_ORNEK ? [hepsi, "genel"] : [null, "varsayılan"];
  const ls = ornek ? logIstatistik(ornek, "d") : null;
  const taban = ls ? { mu: ls.mu, sg: ls.sg } : VARSAYILAN;
  const dz = ornek ? duzeltme(ornek) : 0;
  const mu = taban.mu + dz, sg = taban.sg;
  const adimLs = ornek ? logIstatistik(ornek, "s") : null;
  // ort/ss gösterim için: medyan ve log sapmanın ms karşılığı.
  return {
    kaynak, mu, sg, duzeltme: dz, taban: Math.exp(taban.mu), sapma: ornek ? sapma(ornek) : null,
    sure: { n: ls?.n ?? 0, ort: Math.exp(mu), ss: Math.exp(mu) * (Math.exp(sg) - 1) },
    adim: adimLs ? { n: adimLs.n, mu: adimLs.mu, sg: adimLs.sg, ort: Math.exp(adimLs.mu) } : { n: 0, ort: 0 },
  };
}
// Standart normal: dağılım (Abramowitz-Stegun 7.1.26) ve tersi (Acklam).
function phi(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
function phiTers(p) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
  if (q < 0.02425) { const r = Math.sqrt(-2 * Math.log(q)); return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); }
  if (q > 1 - 0.02425) return -phiTers(1 - q);
  const r = q - 0.5, s = r * r;
  return (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1);
}
// Log-normal X, X > x bilindiğinde koşullu medyan: kalan olasılığın ortasındaki değer. q: x'in yüzdeliği.
export function kosullu(x, mu, sg) {
  const q = x > 0 ? phi((Math.log(x) - mu) / sg) : 0;
  return { q, deger: Math.max(x, Math.exp(mu + sg * phiTers(q + (1 - q) / 2))) };
}
// İlerleme: geçen / beklenen toplam (koşullu); adım verisi varsa adım oranı da katılır. %97'de durur.
export function ilerleme(el, adim, tah) {
  const zaman = el > 0 ? el / kosullu(el, tah.mu, tah.sg).deger : 0;
  const adimli = tah.adim.n >= MIN_ORNEK && adim > 0;
  const frac = adimli ? 0.6 * zaman + 0.4 * (adim / kosullu(adim, tah.adim.mu, tah.adim.sg).deger) : zaman;
  return Math.min(0.97, frac);
}
// Kalan süre: koşullu medyan; 3+ adımda adım hızıyla (geçen/adım × kalan adım) harmanlanır.
// Etiket: süre türün 1σ / 2σ ötesine geçtiyse; 3σ ötesi "tahminden uzun".
export function kalan(el, tah, adim = 0) {
  const { q, deger } = kosullu(el, tah.mu, tah.sg);
  let ms = deger - el;
  if (adim >= 3 && tah.adim.n >= MIN_ORNEK) {
    const kalanAdim = kosullu(adim, tah.adim.mu, tah.adim.sg).deger - adim;
    ms = 0.6 * ms + 0.4 * kalanAdim * (el / adim);
  }
  if (q > 0.99865) return { ms: el - tah.sure.ort, etiket: "", asim: true };
  return { ms, etiket: q > 0.97725 ? " (2σ)" : q > 0.84134 ? " (1σ)" : "", asim: false };
}
export function belleğeEkle(bellek, kat, ornek) {
  return { ...bellek, [kat]: [...(bellek?.[kat] ?? []), ornek].slice(-ORNEK_MAX) };
}

export function fmt(ms) {
  const t = Math.max(0, Math.round(ms / 1000));
  return t >= 60 ? `${Math.floor(t / 60)}dk ${t % 60}s` : `${t}s`;
}
export function barParts(frac, frame, Text) {
  const fill = Math.round(Math.min(frac, 1) * BAR_W);
  const shine = frame % (BAR_W + 6);
  const parts = [];
  for (let i = 0; i < BAR_W; i++) {
    const done = i < fill;
    const color = !done ? "gray" : i < BAR_W * 0.5 ? "green" : i < BAR_W * 0.8 ? "yellow" : "magenta";
    const ch = !done ? "░" : (i === shine || i === shine - 1) ? "▓" : "█";
    parts.push(Text({ color, bold: done && i === shine, children: ch }));
  }
  return parts;
}

// Cam kart (uygulama yüzeyleri), resim olarak çizilir: her yeni metin resmi yeniden çizdirir, o yüzden
// ilerleme %2'lik, kalan süre dakika ya da 5 saniyelik adımlarla yazılır.
const kaba = ms => ms >= 60_000 ? `${Math.ceil(ms / 60_000)}dk` : `${Math.max(5, Math.ceil(ms / 5_000) * 5)}s`;
export function isKartiVerisi(t, bellek, durum, now = Date.now()) {
  let is = null;
  if (t) {
    const tah = tahmin(bellek, t.kat ?? "diger");
    const el = now - t.startedAt;
    const frac = ilerleme(el, t.adim ?? 0, tah);
    const k = kalan(el, tah, t.adim ?? 0);
    const ton = k.asim ? "kirmizi" : k.etiket ? "mor" : "mavi";
    const kaynak = tah.kaynak === "varsayılan" ? "varsayılan" : `${tah.kaynak === "genel" ? "genel" : KAT_AD[tah.kaynak]} n=${tah.sure.n}`;
    const yuzde = Math.floor(frac * 50) * 2;
    is = {
      oran: yuzde / 100, yuzde, ton,
      tur: KAT_AD[t.kat ?? "diger"],
      kalan: k.asim ? `tahminden uzun +${kaba(k.ms)}` : `~${kaba(k.ms)} kaldı${k.etiket}`,
      kalanTon: k.asim ? "kirmizi" : k.etiket ? "mor" : "sari",
      detay: `${KAT_AD[t.kat ?? "diger"]} · ${t.adim ?? 0} adım · tipik ${kaba(tah.sure.ort)}`,
      ipucu: `Tahmin kaynağı: ${kaynak}${tah.duzeltme ? ` · öğrenilen düzeltme ×${Math.exp(tah.duzeltme).toFixed(2)}` : ""}${tah.sapma != null ? ` · son işlerde sapma %${Math.round(tah.sapma * 100)}` : ""}`,
    };
  }
  const alt = (is ? `İş tahmini %${is.yuzde}, ${is.kalan}. ` : "") + `diff-only ${durum.acik ? "açık" : "kapalı"}, ${durum.prompt} prompt'a eklendi, ${durum.edit} edit`;
  return { source: isKarti(is, durum), alt };
}

const REVISION =/\b(düzelt|değiştir|güncelle|revize|ekle|kaldır|refactor|fix|update|change|modify|patch|edit)\w*/i;
const FRESH = /\b(sıfırdan|baştan yaz|yeni dosya|from scratch|new file)\b/i;
const RULE =
  "\n\n[diff-disiplin] Mevcut kodu değiştiriyorsan dosyanın tamamını yeniden yazma. " +
  "Edit aracıyla sadece değişen bloğu düzenle; cevabında yalnızca unified diff " +
  "(--- / +++ / @@) ve değişikliğin hangi fonksiyona/satıra girdiğini göster.";

export function shouldInject(text) {
  if (typeof text !== "string" || text.includes("[diff-disiplin]")) return false;
  return REVISION.test(text) && !FRESH.test(text);
}

export function register(on) {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    ticker?.cancel?.();
    ticker = $.clock.every(120, async () => {
      const { value: t = null } = await $.state.get(TURN);
      if (!t) return;
      const { value: f = 0 } = await $.state.get(FRAME);
      await $.state.set(FRAME, f + 1);
    });
    await $.command.register({ name: "diffmod", description: "Diff disiplinini aç/kapat" });
    await $.command.register({ name: "tahmin", description: "İş türü başına süre/adım istatistiklerini göster" });
    try {
      const kayit = await $.store.get("bellek");
      if (kayit && typeof kayit === "object") await $.state.set(BELLEK, kayit);
    } catch {}
    return r;
  });

  on("command.run", { command: "tahmin" }, async ($) => {
    const { value: b = {} } = await $.state.get(BELLEK);
    const satir = Object.keys(KAT_AD).filter(k => b[k]?.length).map(k => {
      const t = tahmin(b, k);
      const aralik = `${fmt(Math.exp(t.mu - t.sg))}–${fmt(Math.exp(t.mu + t.sg))}`;
      const dz = t.duzeltme ? `  düzeltme ×${Math.exp(t.duzeltme).toFixed(2)}` : "";
      const sp = t.sapma != null ? `  sapma %${Math.round(t.sapma * 100)}` : "";
      return `${KAT_AD[k].padEnd(14)} n=${String(b[k].length).padStart(2)}  tipik ${fmt(t.sure.ort)} (${aralik})  adım ~${Math.round(t.adim.ort)}${dz}${sp}  [${t.kaynak}]`;
    });
    return { text: satir.length ? `İş belleği (log-normal, yeni işler ağır basar; düzeltme = öğrenilen sistematik sapma, sapma = son 20 işte tahminin medyan hatası):\n${satir.join("\n")}` : `Henüz kayıtlı iş yok; ${MIN_ORNEK} işten sonra tahminler ölçüme dayanır.` };
  });

  on("command.run", { command: "diffmod" }, async ($) => {
    const { value: on_ = true } = await $.state.get(ENABLED);
    await $.state.set(ENABLED, !on_);
    return { text: `Diff disiplini ${!on_ ? "AÇIK" : "KAPALI"}` };
  });

  on("prompt.submit", async ($, e, next) => {
    if (!e.agentId) await $.state.set(KAT, kategori(e.text));
    if (!e.agentId) await $.state.set(ALLOW_WRITE, typeof e.text === "string" && FRESH.test(e.text));
    const { value: enabled = true } = await $.state.get(ENABLED);
    if (!enabled || !shouldInject(e.text)) return next(e);
    const { value: n = 0 } = await $.state.get(INJECTED);
    await $.state.set(INJECTED, n + 1);
    return next({ ...e, text: e.text + RULE });
  });

  on("tool.call", { tool: "Write" }, async ($, e, next) => {
    const { value: enabled = true } = await $.state.get(ENABLED);
    const { value: allow = false } = await $.state.get(ALLOW_WRITE);
    if (!enabled || allow || !(await $.fs.exists(e.file_path))) return next(e);
    const { value: b = 0 } = await $.state.get(BLOCKED);
    await $.state.set(BLOCKED, b + 1);
    return { deny: `[diff-disiplin] ${e.file_path} zaten var; tamamını yeniden yazma, Edit ile sadece değişen bloğu düzenle. (Bilerek sıfırdan yazdırmak için prompt'a "sıfırdan" yaz ya da /diffmod ile kapat.)` };
  });

  on("tool.call", { tool: "Edit" }, async ($, e, next) => {
    const r = await next(e);
    if (r.deny === undefined && !r.isError) {
      const { value: k = 0 } = await $.state.get(EDITS);
      await $.state.set(EDITS, k + 1);
    }
    return r;
  });

  on("turn.start", async ($, e, next) => {
    if (!e.agentId) {
      const { value: kat = "diger" } = await $.state.get(KAT);
      // İş başındaki tahmin örneğe yazılır: t düzeltmesiz taban (sapma öğrenimi), c gösterilen tahmin (isabet ölçümü).
      const { value: b = {} } = await $.state.get(BELLEK);
      const tah = tahmin(b, kat);
      await $.state.set(TURN, { startedAt: Date.now(), kat, adim: 0, t: Math.round(tah.taban), c: Math.round(tah.sure.ort) });
      await $.state.set(KAT, "diger");
    }
    return next(e);
  });

  // Ana iş parçacığının her araç çağrısı bir adım: ilerleme yüzdesini besler.
  on("tool.call", async ($, e, next) => {
    if (!e.agentId) {
      const { value: t = null } = await $.state.get(TURN);
      if (t) await $.state.set(TURN, { ...t, adim: (t.adim ?? 0) + 1 });
    }
    return next(e);
  });

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId) return r;
    const { value: t = null } = await $.state.get(TURN);
    const dur = e.durationMs ?? (t ? Date.now() - t.startedAt : 0);
    if (dur > 1000 && t && !e.isAborted) {
      // Diskteki bellek tazeden okunur: aynı anda açık diğer oturumların öğrendikleri ezilmesin.
      let b = {};
      try { b = (await $.store.get("bellek")) ?? (await $.state.get(BELLEK)).value ?? {}; } catch { b = (await $.state.get(BELLEK)).value ?? {}; }
      const yeni = belleğeEkle(b, t.kat ?? "diger", { d: dur, s: t.adim ?? 0, z: Date.now(), ...(t.t ? { t: t.t, c: t.c } : {}) });
      await $.state.set(BELLEK, yeni);
      await $.store.set("bellek", yeni);
    }
    await $.state.set(TURN, null);
    await $.state.set(ALLOW_WRITE, false);
    if (dur >= TOAST_MS && !e.isAborted) $.ui.toast(`✔ diff-disiplin: tur bitti (${fmt(dur)})`);
    return r;
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const below = await next(e);
    const { value: enabled = true } = await $.state.get(ENABLED);
    const { value: n = 0 } = await $.state.get(INJECTED);
    const { value: t = null } = await $.state.get(TURN);
    const { value: bellek = {} } = await $.state.get(BELLEK);
    const { value: frame = 0 } = await $.state.get(FRAME);
    const { value: edits = 0 } = await $.state.get(EDITS);
    const { value: blocked = 0 } = await $.state.get(BLOCKED);
    const { Box, Text, Svg } = $.ui.resolve(e);
    if (Svg && e.surface !== "terminal") {
      const kart = Svg({ key: "diff-cam", ...isKartiVerisi(t, bellek, { acik: enabled, prompt: n, edit: edits, engel: blocked }) });
      return below ? Box({ flexDirection: "column", children: [below, kart] }) : kart;
    }
    const line = Box({
      flexDirection: "row", paddingX: 1,
      children: [
        Text({ color: enabled ? "green" : "gray", bold: true, children: enabled ? "◆ diff-only" : "◇ diff-only kapalı" }),
        Text({ dimColor: true, children: `  ${n} prompt'a eklendi  ·  ${edits} edit` }),
        ...(blocked ? [Text({ color: "yellow", children: `  ·  ${blocked} Write engellendi` })] : []),
        Text({ dimColor: true, children: "  ·  /diffmod" }),
      ],
    });
    if (t) {
      const tah = tahmin(bellek, t.kat ?? "diger");
      const el = Date.now() - t.startedAt;
      const frac = ilerleme(el, t.adim ?? 0, tah);
      const k = kalan(el, tah, t.adim ?? 0);
      const wide = (e.props.bodyColumns ?? 80) >= 70;
      const kaynak = tah.kaynak === "varsayılan" ? "varsayılan" : `${tah.kaynak === "genel" ? "genel" : KAT_AD[tah.kaynak]} n=${tah.sure.n}`;
      const progress = Box({
        flexDirection: "row", paddingX: 1,
        children: [
          Text({ color: "cyan", bold: true, children: `${SPIN[frame % SPIN.length]} ` }),
          ...barParts(frac, frame, Text),
          Text({ bold: true, children: ` ${Math.round(frac * 100)}%` }),
          Text({ color: k.asim ? "red" : k.etiket ? "magenta" : "yellow", children: k.asim ? `  tahminden uzun (+${fmt(k.ms)})` : `  ~${fmt(k.ms)} kaldı${k.etiket}` }),
          ...(wide ? [Text({ dimColor: true, children: `  · ${KAT_AD[t.kat ?? "diger"]} · ${t.adim ?? 0} adım · ${kaynak} · ort ${fmt(tah.sure.ort)} ± ${fmt(tah.sure.ss)}` })] : []),
        ],
      });
      const both = Box({ flexDirection: "column", children: [progress, line] });
      return below ? Box({ flexDirection: "column", children: [below, both] }) : both;
    }
    return below ? Box({ flexDirection: "column", children: [below, line] }) : line;
  });
}
