import { kotaKarti } from "./cam.mjs";

const VISIBLE = { plugin: "kota-cubugu", key: "visible" };
const LIMITS = { plugin: "kota-cubugu", key: "limits" };
const FRAME = { plugin: "kota-cubugu", key: "frame" };
const WARNED = { plugin: "kota-cubugu", key: "warned" };
const CACHE = { plugin: "kota-cubugu", key: "cache" };

const WIN = {
  five_hour: { ms: 5 * 3600_000, icon: "⏳", label: "5 saat " },
  seven_day: { ms: 7 * 86_400_000, icon: "🗓", label: "Haftalık" },
};
const BAR_W = 20;
const HOT = 80;
const WARN_AT = [80, 95];
const TICK_MS = 200;
const IDLE_EVERY = 150; // boştayken ~30 sn'de bir geri sayımı tazele
let ticker;
let busy = false;
let ticks = 0;

export function dur(ms) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m >= 1440) return `${Math.floor(m / 1440)}g ${Math.floor((m % 1440) / 60)}sa`;
  if (m >= 60) return `${Math.floor(m / 60)}sa ${m % 60}dk`;
  return `${m}dk`;
}

// ── Önbellek geri sayımı ──
// Her ana konuşma isteği önbelleği tazeler; süre dolunca sonraki mesaj bütün bağlamı baştan yazar.
// TTL: abonelikte ana konuşma 1 saat, API anahtarında 5 dakika (kota penceresi yoksa abonelik yok sayılır).
export const TTL = { abonelik: 3_600_000, api: 300_000 };
const CACHE_BAR = 12;
export function cacheGuncelle(c, u, now, ttlMs) {
  const yazilan = u.cache_creation_input_tokens ?? 0, okunan = u.cache_read_input_tokens ?? 0, girdi = u.input_tokens ?? 0;
  const ctx = girdi + okunan + yazilan + (u.output_tokens ?? 0);
  const once = c ?? { okunan: 0, toplam: 0, iska: 0 };
  // Iskalama: önceki bağlamın yarısından azı önbellekten geldiyse önbellek kaybedilmiş demektir.
  const iska = once.ctx > 2000 && okunan < once.ctx * 0.5;
  const neden = !iska ? once.neden : once.model && u.model && u.model !== once.model ? "model değişti" : once.son != null && now - once.son > once.ttlMs ? "süre doldu" : "önbellek düştü";
  return {
    son: now, ttlMs, ctx, model: u.model ?? once.model,
    okunan: once.okunan + okunan, toplam: once.toplam + okunan + yazilan + girdi,
    iska: once.iska + (iska ? 1 : 0), ...(neden ? { neden } : {}),
  };
}
export function bin(n) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}
export function cacheDurum(c, now) {
  if (c?.son == null) return null;
  const kalan = c.son + c.ttlMs - now;
  const isabet = c.toplam ? Math.round((c.okunan / c.toplam) * 100) : 0;
  if (kalan <= 0) return { sicak: false, ctx: c.ctx, neden: c.neden, isabet, iska: c.iska };
  return { sicak: true, kalan, oran: kalan / c.ttlMs, ttl: c.ttlMs >= TTL.abonelik ? "1sa" : "5dk", isabet, iska: c.iska, uyari: kalan / c.ttlMs < 0.2 };
}
// Cam kartın önbellek satırı; kalan süre dakikalık yazılır, çubuk arada SMIL ile erir.
export function onbellekVerisi(c, now) {
  const cd = cacheDurum(c, now);
  if (!cd) return null;
  const ozet = `isabet %${cd.isabet} · ıskalama ${cd.iska}${cd.iska && c.neden ? ` (${c.neden})` : ""}`;
  if (!cd.sicak) return { sicak: false, yazi: `sonraki mesaj ${bin(cd.ctx)} token yeniden yazar`, ozet };
  const saniye = cd.kalan >= 120_000 ? Math.ceil(cd.kalan / 60_000) * 60 : Math.ceil(cd.kalan / 1000);
  return {
    sicak: true, ton: cd.uyari ? "sari" : "yesil", ttl: cd.ttl,
    oran: Math.round(saniye * 1000 / c.ttlMs * 300) / 300, saniye,
    kalan: `${sureKisa(saniye * 1000)} kaldı`, kisa: ozet, ozet: `Önbellek ${cd.ttl} · ${ozet}`,
  };
}

function sureKisa(ms) {
  const sn = Math.ceil(ms / 1000);
  return sn >= 60 ? `${Math.ceil(sn / 60)}dk` : `${sn}sn`;
}

export function heat(p) {
  return p >= HOT ? "red" : p >= 50 ? "yellow" : "green";
}

// Pencerenin geçen kısmı (0..1) ve tempo: kullanım zamandan ne kadar önde.
export function pace(lim, now) {
  const w = WIN[lim.kind];
  if (!w || !lim.resetsAt) return null;
  const left = Date.parse(lim.resetsAt) - now;
  if (!Number.isFinite(left)) return null;
  const elapsed = Math.min(1, Math.max(0, 1 - left / w.ms));
  const ahead = lim.percentUsed - elapsed * 100;
  const rate = elapsed > 0.02 ? lim.percentUsed / (elapsed * w.ms) : 0; // %/ms
  const fullIn = rate > 0 && lim.percentUsed < 100 ? (100 - lim.percentUsed) / rate : Infinity;
  return { elapsed, left: Math.max(0, left), ahead, runsOut: fullIn < left ? fullIn : null };
}

export function bar(lim, p, frame, animate, Text) {
  const fill = Math.round(Math.min(lim.percentUsed, 100) / 100 * BAR_W);
  const cursor = p ? Math.min(BAR_W - 1, Math.floor(p.elapsed * BAR_W)) : -1;
  const shine = animate ? frame % (BAR_W + 8) : -9;
  const pulse = lim.percentUsed >= HOT && frame % 6 < 3;
  const parts = [];
  for (let i = 0; i < BAR_W; i++) {
    const done = i < fill;
    if (i === cursor) {
      parts.push(Text({ color: "cyan", bold: true, children: done ? "┃" : "│" }));
      continue;
    }
    const color = !done ? "gray" : heat((i + 1) / BAR_W * 100);
    const ch = !done ? "░" : (i === shine || i === shine - 1) ? "▓" : "█";
    parts.push(Text({ color: pulse && done ? "magenta" : color, bold: done && i === shine, children: ch }));
  }
  return parts;
}

export function tempoText(p) {
  if (!p) return null;
  if (p.runsOut !== null) return { color: "red", children: `  ▲ ~${dur(p.runsOut)}'da dolar` };
  if (p.ahead > 10) return { color: "yellow", children: "  ▲ zamandan hızlı" };
  if (p.ahead < -10) return { color: "green", children: "  ▼ rahat" };
  return { dimColor: true, children: "  ● dengeli" };
}

const TON_ISI = { green: "yesil", yellow: "sari", red: "kirmizi" };
const CIP = { five_hour: "5s", seven_day: "7g" };
const ETIKET = { five_hour: "5 SAAT", seven_day: "HAFTALIK" };

// Cam kartın satırları: dönem sonu tahmini (bugünkü hızla) çubukta çizgili gölge olarak görünür.
// Değerler yuvarlanır ki SVG metni yalnız görünen bir şey değişince değişsin.
export function kotaSatirlari(limits, now) {
  return limits.map(l => {
    const p = pace(l, now);
    const t = tempoText(p);
    const proj = p && p.elapsed > 0.05 ? Math.round(l.percentUsed / p.elapsed) : null;
    const durum = !t ? null
      : p.runsOut !== null ? { yazi: `~${dur(p.runsOut)}'da dolar`, ton: "kirmizi" }
      : p.ahead > 10 ? { yazi: "zamandan hızlı", ton: "sari" }
      : p.ahead < -10 ? { yazi: "rahat", ton: "yesil" }
      : { yazi: "dengeli", ton: "gri" };
    return {
      kind: l.kind, cip: CIP[l.kind], etiket: ETIKET[l.kind],
      yuzde: Math.round(Math.min(l.percentUsed, 100)), ton: TON_ISI[heat(l.percentUsed)],
      imlec: p ? Math.round(p.elapsed * 300) / 300 : null,
      hayalet: proj !== null && proj > l.percentUsed ? Math.min(100, proj) / 100 : null,
      hayaletTon: proj !== null ? TON_ISI[heat(proj)] : null,
      sifirlanma: p ? dur(p.left) : "?",
      durum, nabiz: l.percentUsed >= HOT,
      ipucu: `${ETIKET[l.kind]}: %${Math.round(l.percentUsed)} kullanıldı · pencerenin %${p ? Math.round(p.elapsed * 100) : "?"}'i geçti${proj !== null ? ` · bu hızla dönem sonu ~%${proj}` : ""}`,
    };
  });
}

function pick(limits) {
  return (limits ?? [])
    .filter(l => WIN[l.kind])
    .map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, ...(resetsAt ? { resetsAt } : {}) }));
}

async function store($, rateLimits) {
  const limits = pick(rateLimits);
  if (!limits.length) return;
  await $.state.set(LIMITS, limits);
  const { value: warned = {} } = await $.state.get(WARNED);
  const next = { ...warned };
  for (const l of limits) {
    const crossed = WARN_AT.filter(t => l.percentUsed >= t).pop() ?? 0;
    const was = warned[l.kind] ?? 0;
    if (crossed > was) $.ui.toast(`${WIN[l.kind].icon} ${WIN[l.kind].label.trim()} kota %${l.percentUsed} — sıfırlanma: ${l.resetsAt ? dur(Date.parse(l.resetsAt) - Date.now()) : "?"}`);
    next[l.kind] = crossed; // pencere sıfırlanınca eşik düşer, uyarı yeniden kurulur
  }
  await $.state.set(WARNED, next);
}

export function register(on) {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    ticker?.cancel?.();
    ticks = 0;
    ticker = $.clock.every(TICK_MS, async () => {
      ticks++;
      const { value: limits = [] } = await $.state.get(LIMITS);
      const hot = limits.some(l => l.percentUsed >= HOT);
      const { value: c = null } = await $.state.get(CACHE);
      const kalan = c?.son != null ? c.son + c.ttlMs - Date.now() : -1;
      const yakin = kalan > -1000 && kalan < 120_000 ? ticks % 5 === 0 : false; // son 2 dk: saniyelik
      if (!busy && !hot && !yakin && ticks % IDLE_EVERY) return;
      const { value: f = 0 } = await $.state.get(FRAME);
      await $.state.set(FRAME, f + 1);
    });
    await $.command.register({ name: "kota", description: "Kota çubuğunu göster/gizle" });
    try {
      await store($, (await $.session.usage()).rateLimits);
    } catch {}
    return r;
  });

  on("session.measure", async ($, e, next) => {
    if (e.changed.includes("rateLimits")) await store($, e.rateLimits);
    return next(e);
  });

  on("command.run", { command: "kota" }, async ($) => {
    const { value: v = true } = await $.state.get(VISIBLE);
    await $.state.set(VISIBLE, !v);
    return { text: `Kota çubuğu ${!v ? "AÇIK" : "KAPALI"}` };
  });

  on("turn.step", async function* ($, e, next) {
    const r = yield* next(e);
    if (!e.agentId && r?.usage) {
      const { value: c = null } = await $.state.get(CACHE);
      const { value: limits = [] } = await $.state.get(LIMITS);
      await $.state.set(CACHE, cacheGuncelle(c, r.usage, Date.now(), limits.length ? TTL.abonelik : TTL.api));
    }
    return r;
  });

  on("turn.start", async ($, e, next) => {
    if (!e.agentId) busy = true;
    return next(e);
  });

  on("turn.complete", async ($, e, next) => {
    if (!e.agentId) busy = false;
    return next(e);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const below = await next(e);
    const { value: visible = true } = await $.state.get(VISIBLE);
    if (!visible) return below;
    const { value: limits = [] } = await $.state.get(LIMITS);
    const { value: frame = 0 } = await $.state.get(FRAME);
    const { Box, Text, Svg } = $.ui.resolve(e);
    const now = Date.now();
    const { value: c = null } = await $.state.get(CACHE);
    const ob = onbellekVerisi(c, now);
    if (Svg && e.surface !== "terminal" && (limits.length || ob)) {
      const satirlar = kotaSatirlari(limits, now);
      const alt = [...satirlar.map(r => r.ipucu), ...(ob ? [ob.sicak ? `${ob.ozet}, ${ob.kalan}` : `Önbellek soğuk, ${ob.yazi}`] : [])].join(" — ");
      const kart = Svg({ key: "kota-cam", source: kotaKarti(satirlar, ob), alt, isInteractive: true });
      return below ? Box({ flexDirection: "column", children: [below, kart] }) : kart;
    }
    const wide = (e.props.bodyColumns ?? 80) >= 70;
    const rows = limits.length
      ? limits.map(l => {
          const p = pace(l, now);
          const t = wide ? tempoText(p) : null;
          return Box({
            key: l.kind, flexDirection: "row", paddingX: 1,
            children: [
              Text({ children: `${WIN[l.kind].icon} ` }),
              Text({ dimColor: true, children: `${WIN[l.kind].label} ` }),
              ...bar(l, p, frame, busy, Text),
              Text({ color: heat(l.percentUsed), bold: true, children: ` ${Math.round(l.percentUsed)}%`.padEnd(5) }),
              Text({ dimColor: true, children: p ? `  ⟳ ${dur(p.left)}` : "" }),
              ...(t ? [Text(t)] : []),
            ],
          });
        })
      : [Box({ key: "bekle", paddingX: 1, children: [Text({ dimColor: true, children: "⏳ kota: ilk yanıttan sonra görünür (yalnızca Pro/Max abonelikte)" })] })];
    const cd = cacheDurum(c, now);
    if (cd) {
      const renk = !cd.sicak ? "red" : cd.uyari ? "yellow" : "green";
      const dolu = cd.sicak ? Math.max(1, Math.round(cd.oran * CACHE_BAR)) : 0;
      const ozet = `  ·  isabet %${cd.isabet}  ·  ıskalama ${cd.iska}${cd.iska && c.neden ? ` (${c.neden})` : ""}`;
      rows.push(Box({ key: "cache", flexDirection: "row", paddingX: 1, children: cd.sicak
        ? [Text({ color: renk, children: "◉ önbellek " }), Text({ color: renk, bold: true, children: `${cd.ttl} ` }),
           Text({ color: renk, children: "█".repeat(dolu) }), Text({ dimColor: true, children: "░".repeat(CACHE_BAR - dolu) }),
           Text({ color: renk, bold: true, children: ` ${sureKisa(cd.kalan)} kaldı` }), ...(wide ? [Text({ dimColor: true, children: ozet })] : [])]
        : [Text({ color: "red", children: "○ önbellek soğuk" }), Text({ color: "red", dimColor: true, children: `  ·  sonraki mesaj ${bin(cd.ctx)} token'ı yeniden önbelleğe alır` }),
           ...(wide && cd.iska ? [Text({ dimColor: true, children: ozet })] : [])] }));
    }
    const band = Box({ flexDirection: "column", children: rows });
    return below ? Box({ flexDirection: "column", children: [below, band] }) : band;
  });
}
