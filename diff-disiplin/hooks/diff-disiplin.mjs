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
export function tahmin(bellek, kat) {
  const kendi = bellek?.[kat] ?? [];
  const hepsi = Object.values(bellek ?? {}).flat();
  const [ornek, kaynak] = kendi.length >= MIN_ORNEK ? [kendi, kat] : hepsi.length >= MIN_ORNEK ? [hepsi, "genel"] : [null, "varsayılan"];
  if (!ornek) return { kaynak, sure: { n: 0, ort: DEFAULT_ETA, ss: DEFAULT_ETA / 2 }, adim: { n: 0, ort: 0, ss: 0 } };
  return { kaynak, sure: istatistik(ornek, "d"), adim: istatistik(ornek, "s") };
}
// Ortalamaya kadar %0-85; aşınca standart sapma ölçeğinde %97'ye yaklaşır: hiç geri gitmez, takılmaz.
function egri(x, ort, ss) {
  if (ort <= 0) return 0;
  return x <= ort ? 0.85 * x / ort : 0.85 + 0.12 * (1 - Math.exp(-(x - ort) / Math.max(ss, ort * 0.15)));
}
export function ilerleme(el, adim, tah) {
  const zaman = egri(el, tah.sure.ort, tah.sure.ss);
  const frac = tah.adim.n >= MIN_ORNEK && tah.adim.ort > 0 ? 0.6 * zaman + 0.4 * egri(adim, tah.adim.ort, tah.adim.ss) : zaman;
  return Math.min(0.97, frac);
}
// Kalan süre: ortalama, sonra ort+1σ, ort+2σ hedefleri.
export function kalan(el, tah) {
  const { ort, ss } = tah.sure;
  for (const [k, etiket] of [[0, ""], [1, " (1σ)"], [2, " (2σ)"]]) if (el < ort + k * ss) return { ms: ort + k * ss - el, etiket, asim: false };
  return { ms: el - ort, etiket: "", asim: true };
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
    const k = kalan(el, tah);
    const ton = k.asim ? "kirmizi" : k.etiket ? "mor" : "mavi";
    const kaynak = tah.kaynak === "varsayılan" ? "varsayılan" : `${tah.kaynak === "genel" ? "genel" : KAT_AD[tah.kaynak]} n=${tah.sure.n}`;
    const yuzde = Math.floor(frac * 50) * 2;
    is = {
      oran: yuzde / 100, yuzde, ton,
      tur: KAT_AD[t.kat ?? "diger"],
      kalan: k.asim ? `tahminden uzun +${kaba(k.ms)}` : `~${kaba(k.ms)} kaldı${k.etiket}`,
      kalanTon: k.asim ? "kirmizi" : k.etiket ? "mor" : "sari",
      detay: `${t.adim ?? 0} adım  ·  ${kaynak}  ·  ort ${fmt(tah.sure.ort)} ± ${fmt(tah.sure.ss)}`,
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
      const d = istatistik(b[k], "d"), a = istatistik(b[k], "s");
      return `${KAT_AD[k].padEnd(14)} n=${String(d.n).padStart(2)}  süre ${fmt(d.ort)} ± ${fmt(d.ss)}  adım ${a.ort.toFixed(1)} ± ${a.ss.toFixed(1)}`;
    });
    return { text: satir.length ? `İş belleği (ortalama ± standart sapma):\n${satir.join("\n")}` : `Henüz kayıtlı iş yok; ${MIN_ORNEK} işten sonra tahminler ölçüme dayanır.` };
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
      await $.state.set(TURN, { startedAt: Date.now(), kat, adim: 0 });
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
      const { value: b = {} } = await $.state.get(BELLEK);
      const yeni = belleğeEkle(b, t.kat ?? "diger", { d: dur, s: t.adim ?? 0, z: Date.now() });
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
      const k = kalan(el, tah);
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
