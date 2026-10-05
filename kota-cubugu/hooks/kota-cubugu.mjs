const VISIBLE = { plugin: "kota-cubugu", key: "visible" };
const LIMITS = { plugin: "kota-cubugu", key: "limits" };
const FRAME = { plugin: "kota-cubugu", key: "frame" };
const WARNED = { plugin: "kota-cubugu", key: "warned" };

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
      if (!busy && !hot && ticks % IDLE_EVERY) return;
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
    const { Box, Text } = $.ui.resolve(e);
    const wide = (e.props.bodyColumns ?? 80) >= 70;
    const now = Date.now();
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
    const band = Box({ flexDirection: "column", children: rows });
    return below ? Box({ flexDirection: "column", children: [below, band] }) : band;
  });
}
