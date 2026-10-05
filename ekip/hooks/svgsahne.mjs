// SVG sahne motoru: Claude Code uygulamasında (masaüstü, web, VS Code, mobil) animasyonlu şerit.
// Animasyonu uygulama oynatır (SMIL, isInteractive Svg): mod kare göndermez, hareket ekran hızında akar.
// Kaynak yalnız (tema, ilerleme yüzdesi, bitti) ile değişir: süre sayacı gibi sık değişen şeyler SVG dışında
// kalır, böylece her saniye yeniden çizimde animasyon baştan başlamaz.
import { SAHNELER } from "./sahne.mjs";

export const VB_W = 240; // viewBox genişliği
export const VB_H = 24; // viewBox yüksekliği (6 üyede bile panel kısa kalır)
const PX = 3; // sprite pikseli (viewBox birimi)
const ZEMIN = VB_H - 6; // yer çizgisi

const css = c => "#" + c.toString(16).padStart(6, "0");
const sayi = n => Math.round(n * 100) / 100;

// Sprite: aynı piksel ızgarası, keskin kenarlı dikdörtgenler. Kare dizisi → kesikli opaklık geçişi.
function spriteKare(kare, palet) {
  let r = "";
  kare.forEach((s, y) => [...s].forEach((ch, x) => {
    if (ch !== ".") r += `<rect x="${x * PX}" y="${y * PX}" width="${PX}" height="${PX}" fill="${css(palet[ch])}"/>`;
  }));
  return r;
}
function sprite(s, bitti, dur = "0.33s") {
  if (bitti) return `<g>${spriteKare(s.kare[0], s.palet)}</g>`;
  return s.kare.map((k, i) => `<g opacity="${i ? 0 : 1}"><animate attributeName="opacity" values="${i ? "0;1" : "1;0"}" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/>${spriteKare(k, s.palet)}</g>`).join("");
}
// Sonsuz kayan katman: içerik iki kez çizilir, bir genişlik kadar sola kayar, döner.
const kayan = (icerik, sure, durdur) =>
  `<g>${durdur ? "" : `<animateTransform attributeName="transform" type="translate" from="0 0" to="${-VB_W} 0" dur="${sure}s" repeatCount="indefinite"/>`}<g>${icerik}</g><g transform="translate(${VB_W} 0)">${icerik}</g></g>`;
const yildizlar = (n, tohum, renk, yMax) => Array.from({ length: n }, (_, i) => {
  const x = (i * 53 + tohum * 17) % VB_W, y = (i * 29 + tohum * 7) % yMax, d = 1 + (i % 3) * 0.7;
  return `<rect x="${x}" y="${y}" width="1" height="1" fill="${renk}"><animate attributeName="opacity" values="1;0.2;1" dur="${d}s" begin="${(i % 5) * 0.3}s" repeatCount="indefinite"/></rect>`;
}).join("");

// ── Tema arka planları ve parçacıklar (sx: sprite x, sw/sh: sprite boyu) ──
const TEMA = {
  Clawd: {
    zemin: d => `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7EC8F2"/><stop offset="1" stop-color="#CBEBFB"/></linearGradient>
      <rect width="${VB_W}" height="${VB_H}" fill="url(#g)"/><circle cx="${VB_W - 22}" cy="6" r="4" fill="#FFE27A"/>
      <rect y="${ZEMIN - 8}" width="${VB_W}" height="4" fill="#3B9BD8"/>
      ${kayan(Array.from({ length: 12 }, (_, i) => `<rect x="${i * 20 + 4}" y="${ZEMIN - 8}" width="6" height="1.4" fill="#E8F6FF"/>`).join(""), 7, d)}
      <rect y="${ZEMIN - 4}" width="${VB_W}" height="${VB_H}" fill="#EBCB8E"/>
      ${kayan(Array.from({ length: 16 }, (_, i) => `<rect x="${i * 15 + 3}" y="${ZEMIN + 1 + (i % 3) * 2}" width="1.5" height="1" fill="#D4B072"/>`).join(""), 5, d)}`,
    iz: (sx, sh) => Array.from({ length: Math.min(6, Math.floor(sx / 8)) }, (_, i) => `<rect x="${sx - 6 - i * 8}" y="${ZEMIN + 3}" width="3" height="1" fill="#C9A365" opacity="${sayi(1 - i / 6)}"/>`).join(""),
  },
  yarış: {
    zemin: d => `<rect width="${VB_W}" height="${VB_H}" fill="#2E7D32"/>
      ${kayan(Array.from({ length: 24 }, (_, i) => `<rect x="${i * 10}" y="${ZEMIN - 13}" width="5" height="2" fill="${i % 2 ? "#B71C1C" : "#EEEEEE"}"/>`).join(""), 3, d)}
      <rect y="${ZEMIN - 11}" width="${VB_W}" height="${VB_H}" fill="#3A3D42"/>
      <line x1="0" y1="${ZEMIN - 5}" x2="${VB_W}" y2="${ZEMIN - 5}" stroke="#F2F2F2" stroke-width="1" stroke-dasharray="8 8">${d ? "" : `<animate attributeName="stroke-dashoffset" from="0" to="16" dur="0.2s" repeatCount="indefinite"/>`}</line>`,
    iz: (sx, sh) => [0, 1, 2].map(i => `<circle cx="${sx - 3}" cy="${ZEMIN - 1}" r="1.5" fill="#C9CDD2"><animate attributeName="cx" from="${sx - 2}" to="${sx - 22}" dur="0.9s" begin="${i * 0.3}s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.8" to="0" dur="0.9s" begin="${i * 0.3}s" repeatCount="indefinite"/><animate attributeName="r" from="1" to="3" dur="0.9s" begin="${i * 0.3}s" repeatCount="indefinite"/></circle>`).join(""),
    // vektör tekerlekler: dönen jant
    ust: (sx, sy, d) => [1.5, 8.5].map(cx => `<g transform="translate(${cx * PX} ${2.5 * PX})"><circle r="${PX * 0.95}" fill="#0A0A0A"/><g>${d ? "" : `<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.25s" repeatCount="indefinite"/>`}<rect x="-0.4" y="${-PX * 0.6}" width="0.8" height="${PX * 1.2}" fill="#A0A0A0"/><rect y="-0.4" x="${-PX * 0.6}" height="0.8" width="${PX * 1.2}" fill="#A0A0A0"/></g></g>`).join(""),
    gizle: ["K", "k"],
  },
  yelken: {
    zemin: d => `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB37A"/><stop offset="1" stop-color="#9FD3F0"/></linearGradient>
      <rect width="${VB_W}" height="${VB_H}" fill="url(#g)"/><circle cx="46" cy="${ZEMIN - 4}" r="6" fill="#FFE08A" opacity="0.9"/>
      <g fill="none" stroke="#3A3A3A" stroke-width="0.8"><path d="M0 0 l2 -1.5 l2 1.5"><animate attributeName="d" values="M0 0 l2 -1.5 l2 1.5;M0 0 l2 1 l2 -1;M0 0 l2 -1.5 l2 1.5" dur="0.5s" repeatCount="indefinite"/></path>${d ? "" : `<animateTransform attributeName="transform" type="translate" from="${VB_W} 6" to="-10 4" dur="14s" repeatCount="indefinite"/>`}</g>
      <rect y="${ZEMIN - 2}" width="${VB_W}" height="${VB_H}" fill="#1E6FB8"/>
      ${kayan(`<path d="${Array.from({ length: 12 }, (_, i) => `M${i * 20} ${ZEMIN - 2} q5 -2.5 10 0 q5 2.5 10 0`).join(" ")}" fill="none" stroke="#E6F4FF" stroke-width="1"/>`, 4, d)}
      ${kayan(`<path d="${Array.from({ length: 8 }, (_, i) => `M${i * 30 + 8} ${ZEMIN + 3} q4 -1.5 8 0`).join(" ")}" fill="none" stroke="#2B86D1" stroke-width="1"/>`, 2.5, d)}`,
    iz: (sx, sh) => `<path d="M${sx - 2} ${ZEMIN - 1} L${Math.max(0, sx - 30)} ${ZEMIN - 3} M${sx - 2} ${ZEMIN} L${Math.max(0, sx - 30)} ${ZEMIN + 2}" stroke="#FFFFFF" stroke-width="0.8" opacity="0.7"/>`,
    sallanma: true,
  },
  uçuş: {
    zemin: d => `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3F8FD6"/><stop offset="1" stop-color="#A8D8F5"/></linearGradient>
      <rect width="${VB_W}" height="${VB_H}" fill="url(#g)"/>
      ${kayan([[20, 6, 1], [120, 3, 1.3], [190, 9, 0.9]].map(([x, y, s]) => `<g fill="#E4EEF6" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="6" cy="3" rx="6" ry="2.5"/><ellipse cx="10" cy="1.5" rx="4" ry="2.5"/></g>`).join(""), 16, d)}
      ${kayan([[60, 18, 1.4], [170, 21, 1.1]].map(([x, y, s]) => `<g fill="#FFFFFF" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="6" cy="3" rx="7" ry="3"/><ellipse cx="11" cy="1.5" rx="4.5" ry="3"/></g>`).join(""), 7, d)}`,
    izIc: sx => `<line x1="${-Math.min(40, sx)}" y1="${3.5 * PX}" x2="0" y2="${3.5 * PX}" stroke="#D9E6F2" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/>`,
    ust: (sx, sy, d) => `<g transform="translate(${12 * PX} ${1.5 * PX})"><ellipse rx="0.8" ry="${PX * 1.4}" fill="#C8C8C8">${d ? "" : `<animate attributeName="ry" values="${PX * 1.4};0.3;${PX * 1.4}" dur="0.12s" repeatCount="indefinite"/>`}</ellipse></g>`,
    gizle: ["p"],
    sallanma: true,
  },
  roket: {
    zemin: d => `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1026"/><stop offset="1" stop-color="#1A1F4A"/></linearGradient>
      <rect width="${VB_W}" height="${VB_H}" fill="url(#g)"/>
      ${kayan(yildizlar(18, 3, "#5C648C", VB_H), 10, d)}${kayan(yildizlar(8, 9, "#FFFFFF", VB_H), 4, d)}`,
    izIc: sx => `<g transform="translate(0 ${1.5 * PX})"><path d="M0 -3 L-14 0 L0 3 Z" fill="#FF6D00"><animateTransform attributeName="transform" type="scale" values="1 1;1.4 0.8;0.9 1.1;1 1" dur="0.2s" repeatCount="indefinite"/></path><path d="M0 -1.8 L-8 0 L0 1.8 Z" fill="#FFF59D"><animateTransform attributeName="transform" type="scale" values="1 1;0.7 1.2;1.2 0.9;1 1" dur="0.15s" repeatCount="indefinite"/></path></g>`,
    sallanma: true,
  },
};

const bayrak = bitti => {
  const kareler = Array.from({ length: 6 }, (_, y) => [0, 1].map(x => `<rect x="${x * 2.5}" y="${y * 2.5}" width="2.5" height="2.5" fill="${(x + y) % 2 ? "#111111" : "#FFFFFF"}"/>`).join("")).join("");
  return `<g transform="translate(${VB_W - 9} 2)"><rect x="-1" width="1" height="${ZEMIN}" fill="#DDDDDD"/><g>${kareler}${bitti ? "" : `<animateTransform attributeName="transform" type="skewY" values="0;-6;0;5;0" dur="0.9s" repeatCount="indefinite"/>`}</g></g>`;
};
const konfeti = x => ["#FFD54F", "#4FC3F7", "#F06292", "#81C784", "#FFB74D", "#BA68C8"].map((c, i) =>
  `<g transform="translate(${x + i * 5} 0)"><g><animateTransform attributeName="transform" type="translate" from="0 -2" to="0 ${VB_H + 2}" dur="${1.2 + (i % 3) * 0.3}s" begin="${i * 0.15}s" repeatCount="indefinite"/>` +
  `<rect x="-0.8" y="-0.8" width="1.6" height="1.6" fill="${c}"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${0.8 + (i % 2) * 0.4}s" repeatCount="indefinite"/></rect></g></g>`).join("");

// Bir üyenin şeridi: tam SVG belgesi. ilerleme 0..1 (yüzde adımlarına yuvarlanır: gereksiz yeniden çizim yok).
// Bir üyenin şeridi: tam SVG belgesi. İlerleme %4 adımlarla değişir (yol boyunca 25 hamle): kaynak seyrek
// değişir, döngüler (bulut, dalga, yıldız) sık sık baştan başlamaz. onceki: bir önceki ilerleme; araç oradan
// yeni konuma 0.6 sn'de kayar, zıplamaz.
export const ADIM = 25;
export const yuvarla = il => Math.round(Math.max(0, Math.min(1, il)) * ADIM) / ADIM;
export function svgSerit(ad, ilerleme, bitti, kimlik = "s", onceki) {
  const s = SAHNELER[ad] ?? SAHNELER.Clawd;
  const t = TEMA[ad] ?? TEMA.Clawd;
  const p = bitti ? 1 : yuvarla(ilerleme);
  const p0 = onceki === undefined ? p : bitti ? Math.min(p, onceki) : yuvarla(onceki);
  const sw = s.w * PX, sh = s.kare[0].length * PX;
  const sy = ZEMIN - sh + (ad === "yelken" ? 3 : ad === "uçuş" || ad === "roket" ? -5 : 0);
  const yol = VB_W - 16 - sw;
  const sx = sayi(p * yol), sx0 = sayi(p0 * yol);
  const gizli = new Set(t.gizle ?? []);
  const sp = { ...s, kare: s.kare.map(k => k.map(r => [...r].map(ch => (gizli.has(ch) ? "." : ch)).join(""))) };
  const kay = sx0 !== sx ? `<animateTransform attributeName="transform" type="translate" from="${sx0} ${sy}" to="${sx} ${sy}" dur="0.6s" fill="freeze"/>` : "";
  const sallan = t.sallanma && !bitti ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0" dur="${ad === "yelken" ? 1.6 : 0.8}s" repeatCount="indefinite"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" width="${VB_W * 4}" height="${VB_H * 4}" shape-rendering="crispEdges">` +
    `<defs/>${t.zemin(bitti).replace(/id="g"/g, `id="${kimlik}-g"`).replace(/url\(#g\)/g, `url(#${kimlik}-g)`)}` +
    (bitti ? konfeti(VB_W - 40) : "") +
    (bitti || !t.iz ? "" : t.iz(sx, sh)) +
    `<g transform="translate(${sx} ${sy})">${kay}<g>${sallan}` +
    (bitti || !t.izIc ? "" : t.izIc(sx)) +
    `${sprite(sp, bitti)}${t.ust ? t.ust(sx, sy, bitti) : ""}</g></g>` +
    bayrak(bitti) + `</svg>`;
}

// Fable düşünürken: nabız gibi atan mor halkalar ve kayan ışık.
export function svgDusunuyor() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} 12" width="${VB_W * 4}" height="48">` +
    `<rect width="${VB_W}" height="12" rx="2" fill="#9B59D0" opacity="0.14"/>` +
    [0, 1, 2].map(i => `<circle cx="10" cy="6" r="2" fill="none" stroke="#9B59D0" stroke-width="0.9"><animate attributeName="r" from="1" to="6" dur="1.5s" begin="${i * 0.5}s" repeatCount="indefinite"/><animate attributeName="opacity" from="1" to="0" dur="1.5s" begin="${i * 0.5}s" repeatCount="indefinite"/></circle>`).join("") +
    `<rect x="24" y="5.5" width="${VB_W - 30}" height="1" fill="#9B59D0" opacity="0.3"/>` +
    `<rect y="4.5" width="30" height="3" rx="1.5" fill="#B36BE8"><animate attributeName="x" values="24;${VB_W - 36};24" dur="2.4s" repeatCount="indefinite"/></rect></svg>`;
}
