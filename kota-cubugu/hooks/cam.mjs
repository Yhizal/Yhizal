// Cam çubuklar: Claude Code uygulamasında (masaüstü, web, VS Code, mobil) 3D kapsül çubuklar.
// Saf fonksiyonlar; yalnız SVG metni üretir. Zemin şeffaf, renkler prefers-color-scheme ile açık/koyu temaya uyar.
// Resim olarak çizilir (isInteractive yok): her yeni metin resmi değiştirir, o yüzden kaynak yalnız görünen
// değer değişince değişsin diye değerler kaba adımlara yuvarlanır.
// kota-cubugu ve diff-disiplin aynı dosyanın birer kopyasını taşır (eklentiler birbirini içe aktaramaz).

export const W = 760;
const FONT = "Inter,'Segoe UI Variable Text','Segoe UI',system-ui,sans-serif";

// Ton: [parlak üst, ana, koyu alt]
export const TON = {
  yesil: ["#A7F3D0", "#10B981", "#065F46"],
  sari: ["#FDE68A", "#F59E0B", "#92400E"],
  kirmizi: ["#FECACA", "#EF4444", "#991B1B"],
  mor: ["#DDD6FE", "#8B5CF6", "#5B21B6"],
  mavi: ["#A5F3FC", "#06B6D4", "#155E75"],
  gri: ["#E2E8F0", "#64748B", "#334155"],
};
// Açık temada yazı rengi (koyu temada TON[ad][0]).
const YAZI_ACIK = { yesil: "#047857", sari: "#B45309", kirmizi: "#B91C1C", mor: "#6D28D9", mavi: "#0E7490", gri: "#475569" };

// Tema sınıfları: lbl etiket, mut soluk yazı, o0-o2 oluk, ic oluk iç gölgesi, alt oluk alt ışığı, im zaman imleci, tx-* tonlu yazı.
const STIL = `<style>
  .lbl{fill:#6B7280}.mut{fill:#9CA3AF}.o0{stop-color:#CBD5E1}.o1{stop-color:#E2E8F0}.o2{stop-color:#F8FAFC}
  .ic{stroke:#0F172A;stroke-opacity:.2}.alt{stroke:#FFFFFF;stroke-opacity:.95}.im{fill:#0E7490}.gl{opacity:.32}
  ${Object.entries(YAZI_ACIK).map(([ad, c]) => `.tx-${ad}{fill:${c}}`).join("")}
  @media (prefers-color-scheme:dark){
    .lbl{fill:#A1A1AA}.mut{fill:#71717A}.o0{stop-color:#09090B}.o1{stop-color:#18181B}.o2{stop-color:#2A2A2E}
    .ic{stroke:#000000;stroke-opacity:.7}.alt{stroke:#FFFFFF;stroke-opacity:.08}.im{fill:#CFFAFE}.gl{opacity:.7}
    ${Object.entries(TON).map(([ad, [a]]) => `.tx-${ad}{fill:${a}}`).join("")}
  }</style>`;

const r1 = n => Math.round(n * 2) / 2;
export const kacis = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Ortak tanımlar: kart zemini, oluk, cam parlaması, ışıltı, gölge ve parıltı filtreleri, tonların dolgu ve şerit desenleri.
function tanimlar() {
  const tonlar = Object.entries(TON).map(([ad, [a, b, c]]) => `
    <linearGradient id="d-${ad}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    <linearGradient id="c-${ad}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    <pattern id="s-${ad}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${b}" opacity=".18"/><rect width="2.4" height="6" fill="${a}" opacity=".55"/></pattern>`).join("");
  return `${STIL}<defs>
    <linearGradient id="oluk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="o0"/><stop offset=".55" class="o1"/><stop offset="1" class="o2"/></linearGradient>
    <linearGradient id="cam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".75"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    <linearGradient id="isilti" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    <filter id="parilti" x="-20%" y="-150%" width="140%" height="400%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="ic" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation=".6"/></filter>${tonlar}
  </defs>`;
}

// Kart: şeffaf zemin; uygulamanın kendi bant rengi görünür.
function kart(h, icerik) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" font-family="${FONT}">${tanimlar()}${icerik}</svg>`;
}

// Simge çipi: tonlu kabartma kare, üstünde kısa yazı ya da hazır şekil.
function cip(x, y, ton, ic) {
  return `<g transform="translate(${x} ${y})">
    <rect width="24" height="24" rx="7" fill="url(#c-${ton})"/>
    <rect x=".5" y=".5" width="23" height="23" rx="6.5" fill="none" stroke="#FFFFFF" stroke-opacity=".35"/>
    <rect x="3" y="2" width="18" height="8" rx="4" fill="url(#cam)" opacity=".45"/>${ic}</g>`;
}
const cipYazi = s => `<text x="12" y="16.2" text-anchor="middle" font-size="10.5" font-weight="800" fill="#FFFFFF" style="paint-order:stroke" stroke="#000" stroke-opacity=".25" stroke-width="1.5">${kacis(s)}</text>`;

// 3D kapsül: gömük oluk, parlayan dolgu, cam yansıması, kayan ışıltı; isteğe bağlı tahmin gölgesi ve zaman imleci.
// o: { id, x, y, w, h, oran 0..1, ton, hayalet? 0..1 (tahmin ucu), hayaletTon?, imlec? 0..1, nabiz?, akis? }
export function kapsul(o) {
  const { id, x, y, w, h, ton } = o;
  const R = h / 2;
  const fw = o.oran > 0 ? Math.max(h, r1(Math.min(1, o.oran) * w)) : 0;
  const hw = o.hayalet != null ? r1(Math.min(1, o.hayalet) * w) : 0;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${R}" fill="url(#oluk)"/>
    <rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="${R - .5}" fill="none" class="ic" filter="url(#ic)"/>
    <path d="M${x + R} ${y + h - .5} H${x + w - R}" class="alt"/>`;
  if (hw > fw + 2) {
    const ht = o.hayaletTon ?? ton;
    s += `<rect x="${x + fw - R}" y="${y + 1.5}" width="${hw - fw + R}" height="${h - 3}" rx="${R - 1.5}" fill="url(#s-${ht})"/>
      <rect x="${x + hw - 1}" y="${y - 2}" width="2" height="${h + 4}" rx="1" fill="${TON[ht][1]}" opacity=".8"/>`;
  }
  if (fw > 0) {
    const nabiz = o.nabiz ? `<animate attributeName="opacity" values=".55;1;.55" dur="1.4s" repeatCount="indefinite"/>` : "";
    // erime: dolgu o.erime saniyede sıfıra iner (önbellek geri sayımı); SVG her dakika yeniden çizilse de arada akar.
    const er = o.erime > 0 ? `<animate attributeName="width" from="${fw}" to="0" dur="${Math.round(o.erime)}s" fill="freeze"/>` : "";
    s += `<clipPath id="k-${id}"><rect x="${x}" y="${y}" width="${fw}" height="${h}" rx="${R}">${er}</rect></clipPath>
      <rect x="${x}" y="${y + 1}" width="${fw}" height="${h}" rx="${R}" fill="${TON[ton][1]}" class="gl" filter="url(#parilti)">${nabiz}${er}</rect>
      <rect x="${x}" y="${y}" width="${fw}" height="${h}" rx="${R}" fill="url(#d-${ton})">${er}</rect>
      <g clip-path="url(#k-${id})">
        <rect x="${x + 2}" y="${y + 1.5}" width="${Math.max(0, fw - 4)}" height="${r1(h * .42)}" rx="${r1(h * .21)}" fill="url(#cam)" opacity=".85"/>
        ${o.akis === false ? "" : `<rect x="${x - 70}" y="${y}" width="70" height="${h}" fill="url(#isilti)" transform="skewX(-20)"><animateTransform attributeName="transform" type="translate" additive="sum" from="0 0" to="${fw + 110} 0" dur="${Math.max(1.6, r1(fw / 110))}s" repeatCount="indefinite"/></rect>`}
      </g>
      <rect x="${x + .5}" y="${y + .5}" width="${fw - 1}" height="${h - 1}" rx="${R - .5}" fill="none" stroke="#FFFFFF" stroke-opacity=".28">${o.erime > 0 ? `<animate attributeName="width" from="${fw - 1}" to="0" dur="${Math.round(o.erime)}s" fill="freeze"/>` : ""}</rect>`;
  }
  if (o.imlec != null) {
    const cx = r1(x + Math.min(1, Math.max(0, o.imlec)) * w);
    s += `<g><rect x="${cx - 2}" y="${y - 5}" width="4" height="${h + 10}" rx="2" fill="#22D3EE" opacity=".45" filter="url(#parilti)"/>
      <rect x="${cx - 1}" y="${y - 4}" width="2" height="${h + 8}" rx="1" class="im"/>
      <path d="M${cx - 4} ${y - 8} h8 l-4 4.5 z" fill="#06B6D4"/></g>`;
  }
  return s;
}

// Hap: tonlu yarı saydam rozet. Genişlik yazı uzunluğundan kestirilir.
export function hap(x, yOrta, yazi, ton) {
  const g = Math.round(String(yazi).length * 6.3 + 22);
  return `<g transform="translate(${x} ${yOrta - 11})">
    <rect width="${g}" height="22" rx="11" fill="${TON[ton][1]}" fill-opacity=".14"/>
    <rect x=".5" y=".5" width="${g - 1}" height="21" rx="10.5" fill="none" stroke="${TON[ton][1]}" stroke-opacity=".45"/>
    <circle cx="11" cy="11" r="3" fill="${TON[ton][1]}"/>
    <text x="19" y="15" font-size="11.5" font-weight="600" class="tx-${ton}">${kacis(yazi)}</text></g>`;
}

// ── Kota kartı ──
// satirlar: [{ kind, cip, etiket, yuzde, ton, imlec, hayalet, hayaletTon, sifirlanma, durum:{yazi,ton}, ipucu, nabiz }]
// onbellek: null | { sicak, ton, ttl, oran, saniye, kalan, ozet } | { sicak:false, yazi, ozet }
export function kotaKarti(satirlar, onbellek = null) {
  const SH = 36;
  const h = (satirlar.length + (onbellek ? 1 : 0)) * SH + 14;
  let govde = satirlar.map((r, i) => {
    const y = 9 + i * SH, orta = y + SH / 2;
    return `<g><title>${kacis(r.ipucu)}</title>
      ${cip(16, orta - 12, r.ton, cipYazi(r.cip))}
      <text x="50" y="${orta + 4}" font-size="10.5" font-weight="700" letter-spacing="1.3" class="lbl">${kacis(r.etiket)}</text>
      ${kapsul({ id: r.kind, x: 132, y: orta - 7, w: 300, h: 14, oran: r.yuzde / 100, ton: r.ton, hayalet: r.hayalet, hayaletTon: r.hayaletTon, imlec: r.imlec, nabiz: r.nabiz })}
      <text x="492" y="${orta + 6}" text-anchor="end" font-size="17" font-weight="800" class="tx-${r.ton}">${Math.round(r.yuzde)}<tspan font-size="11" font-weight="700" class="lbl">%</tspan></text>
      <text x="508" y="${orta + 4}" font-size="11.5" class="lbl">↻ ${kacis(r.sifirlanma)}</text>
      ${r.durum ? hap(592, orta, r.durum.yazi, r.durum.ton) : ""}</g>`;
  }).join("");
  if (onbellek) {
    const o = onbellek, orta = 9 + satirlar.length * SH + SH / 2;
    const ton = o.sicak ? o.ton : "kirmizi";
    const halka = `<g transform="translate(12 12)" fill="none" stroke="#FFFFFF" stroke-width="2"><circle r="6"${o.sicak ? "" : ` stroke-dasharray="2.5 2.5"`}/><circle r="2" fill="#FFFFFF" stroke="none"/></g>`;
    govde += `<g><title>${kacis(o.ozet)}</title>
      ${cip(16, orta - 12, ton, halka)}
      <text x="50" y="${orta + 4}" font-size="10.5" font-weight="700" letter-spacing="1.3" class="lbl">ÖNBELLEK</text>
      ${kapsul({ id: "onbellek", x: 132, y: orta - 7, w: 300, h: 14, oran: o.sicak ? o.oran : 0, ton, erime: o.sicak ? o.saniye : 0, akis: false })}
      ${o.sicak
        ? `<text x="492" y="${orta + 5}" text-anchor="end" font-size="13" font-weight="800" class="tx-${ton}">${kacis(o.ttl)}</text>
           ${hap(508, orta, o.kalan, ton)}
           <text x="${508 + Math.round(o.kalan.length * 6.3 + 22) + 10}" y="${orta + 4}" font-size="10.5" class="mut">${kacis(o.kisa)}</text>`
        : `${hap(442, orta, "soğuk", "kirmizi")}<text x="514" y="${orta + 4}" font-size="11" class="tx-kirmizi">${kacis(o.yazi)}</text>`}</g>`;
  }
  return kart(h, govde);
}

// ── İş kartı (diff-disiplin): üstte tahmin çubuğu (iş sürerken), altta diff-only durumu ──
// is: null | { oran, ton, yuzde, kalan, kalanTon, detay }
// durum: { acik, prompt, edit, engel }
export function isKarti(is, durum) {
  let y = 9, govde = "";
  if (is) {
    const orta = y + 20;
    // Kart her saniye yeniden çizildiği için (kalan süre) SMIL yok: çipteki halka ilerlemeyi gösterir.
    const a = Math.min(0.999, Math.max(0.01, is.oran)) * 2 * Math.PI;
    const donen = `<g transform="translate(12 12)"><circle r="6.5" fill="none" stroke="#FFFFFF" stroke-opacity=".3" stroke-width="2"/><path d="M0 -6.5 A6.5 6.5 0 ${a > Math.PI ? 1 : 0} 1 ${r1(6.5 * Math.sin(a))} ${r1(-6.5 * Math.cos(a))}" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/></g>`;
    govde += `${cip(16, orta - 12, is.ton, donen)}
      <text x="50" y="${orta - 2}" font-size="10.5" font-weight="700" letter-spacing="1.3" class="lbl">TAHMİN</text>
      <text x="50" y="${orta + 11}" font-size="9.5" class="mut">${kacis(is.tur)}</text>
      ${kapsul({ id: "is", x: 132, y: orta - 7, w: 300, h: 14, oran: is.oran, ton: is.ton, akis: false })}
      <text x="492" y="${orta + 6}" text-anchor="end" font-size="17" font-weight="800" class="tx-${is.ton}">${is.yuzde}<tspan font-size="11" font-weight="700" class="lbl">%</tspan></text>
      ${hap(508, orta, is.kalan, is.kalanTon)}
      <text x="132" y="${orta + 22}" font-size="10" class="mut">${kacis(is.detay)}</text>`;
    y += 48;
  }
  const orta = y + 16;
  const ton = durum.acik ? "yesil" : "gri";
  const elmas = `<path d="M12 5 L19 12 L12 19 L5 12 Z" fill="#FFFFFF" fill-opacity="${durum.acik ? .95 : .5}"/>`;
  const parca = [`${durum.prompt} prompt'a eklendi`, `${durum.edit} edit`];
  govde += `${cip(16, orta - 12, ton, elmas)}
    <text x="50" y="${orta + 4}" font-size="12.5" font-weight="700" class="tx-${ton}">${durum.acik ? "diff-only" : "diff-only kapalı"}</text>
    <text x="132" y="${orta + 4}" font-size="11.5" class="lbl">${kacis(parca.join("  ·  "))}</text>
    ${durum.engel ? hap(400, orta, `${durum.engel} Write engellendi`, "sari") : ""}
    <text x="${W - 22}" y="${orta + 4}" text-anchor="end" font-size="11" class="mut" font-family="ui-monospace,Consolas,monospace">/diffmod</text>`;
  return kart(y + 34, govde);
}
