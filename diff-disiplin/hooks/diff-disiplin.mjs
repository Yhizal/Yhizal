const ENABLED = { plugin: "diff-disiplin", key: "enabled" };
const INJECTED = { plugin: "diff-disiplin", key: "injected" };
const TURN = { plugin: "diff-disiplin", key: "turn" };
const DURS = { plugin: "diff-disiplin", key: "durations" };
const FRAME = { plugin: "diff-disiplin", key: "frame" };
const BLOCKED = { plugin: "diff-disiplin", key: "blocked" };
const EDITS = { plugin: "diff-disiplin", key: "edits" };
const ALLOW_WRITE = { plugin: "diff-disiplin", key: "allowWrite" };
const TOAST_MS = 20_000;

const SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const BAR_W = 24;
const DEFAULT_ETA = 30_000;
let ticker;

export function estimate(durs) {
  if (!durs.length) return DEFAULT_ETA;
  const s = [...durs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
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

const REVISION = /\b(düzelt|değiştir|güncelle|revize|ekle|kaldır|refactor|fix|update|change|modify|patch|edit)\w*/i;
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
    return r;
  });

  on("command.run", { command: "diffmod" }, async ($) => {
    const { value: on_ = true } = await $.state.get(ENABLED);
    await $.state.set(ENABLED, !on_);
    return { text: `Diff disiplini ${!on_ ? "AÇIK" : "KAPALI"}` };
  });

  on("prompt.submit", async ($, e, next) => {
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
    if (!e.agentId) await $.state.set(TURN, { startedAt: Date.now() });
    return next(e);
  });

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId) return r;
    const { value: t = null } = await $.state.get(TURN);
    const dur = e.durationMs ?? (t ? Date.now() - t.startedAt : 0);
    if (dur > 1000) {
      const { value: d = [] } = await $.state.get(DURS);
      await $.state.set(DURS, [...d, dur].slice(-15));
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
    const { value: durs = [] } = await $.state.get(DURS);
    const { value: frame = 0 } = await $.state.get(FRAME);
    const { value: edits = 0 } = await $.state.get(EDITS);
    const { value: blocked = 0 } = await $.state.get(BLOCKED);
    const { Box, Text } = $.ui.resolve(e);
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
      const eta = estimate(durs);
      const el = Date.now() - t.startedAt;
      const over = el > eta;
      const frac = over ? 0.95 : el / eta;
      const wide = (e.props.bodyColumns ?? 80) >= 70;
      const progress = Box({
        flexDirection: "row", paddingX: 1,
        children: [
          Text({ color: "cyan", bold: true, children: `${SPIN[frame % SPIN.length]} ` }),
          ...barParts(frac, frame, Text),
          Text({ bold: true, children: ` ${Math.round(frac * 100)}%` }),
          Text({ color: over ? "red" : "yellow", children: over ? `  tahminden uzun (+${fmt(el - eta)})` : `  ~${fmt(eta - el)} kaldı` }),
          ...(wide ? [Text({ dimColor: true, children: `  · geçen ${fmt(el)} / tahmin ${fmt(eta)}${durs.length ? "" : " (varsayılan)"}` })] : []),
        ],
      });
      const both = Box({ flexDirection: "column", children: [progress, line] });
      return below ? Box({ flexDirection: "column", children: [below, both] }) : both;
    }
    return below ? Box({ flexDirection: "column", children: [below, line] }) : line;
  });
}
