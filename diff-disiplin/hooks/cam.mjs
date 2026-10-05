// Cam kart: Claude Code uygulamasında (masaüstü, web, VS Code, mobil) 3D kapsül çubuklar.
// Saf fonksiyonlar; yalnız SVG metni üretir. Kaynak yalnız görünen değer değişince değişsin diye
// tüm koordinatlar yuvarlanır: aynı metin gelirse uygulama çerçeveyi yeniden yüklemez, SMIL akmaya devam eder.
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

const r1 = n => Math.round(n * 2) / 2;
export const kacis = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Ortak tanımlar: kart zemini, oluk, cam parlaması, ışıltı, gölge ve parıltı filtreleri, tonların dolgu ve şerit desenleri.
function tanimlar() {
  const tonlar = Object.entries(TON).map(([ad, [a, b, c]]) => `
    <linearGradient id="d-${ad}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    <linearGradient id="c-${ad}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    <pattern id="s-${ad}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${b}" opacity=".18"/><rect width="2.4" height="6" fill="${a}" opacity=".55"/></pattern>`).join("");
  return `<defs>
    <linearGradient id="kart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E2433"/><stop offset="1" stop-color="#0E121B"/></linearGradient>
    <linearGradient id="kenar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".22"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".04"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".1"/></linearGradient>
    <radialGradient id="isik" cx=".18" cy="0" r=".9"><stop offset="0" stop-color="#7C9CFF" stop-opacity=".18"/><stop offset="1" stop-color="#7C9CFF" stop-opacity="0"/></radialGradient>
    <linearGradient id="oluk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070B"/><stop offset=".55" stop-color="#121722"/><stop offset="1" stop-color="#232A38"/></linearGradient>
    <linearGradient id="cam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".75"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    <linearGradient id="isilti" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    <filter id="golge" x="-5%" y="-30%" width="110%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#000" flood-opacity=".35"/></filter>
    <filter id="parilti" x="-20%" y="-150%" width="140%" height="400%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="ic" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation=".6"/></filter>${tonlar}
  </defs>`;
}

// Kart: gölgeli koyu cam, üstte ince ışık kenarı.
function kart(h, icerik) {
  const H = h + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${tanimlar()}
  <g filter="url(#golge)"><rect x="4" y="2" width="${W - 8}" height="${h}" rx="12" fill="url(#kart)"/></g>
  <rect x="4" y="2" width="${W - 8}" height="${h}" rx="12" fill="url(#isik)"/>
  <rect x="4.5" y="2.5" width="${W - 9}" height="${h - 1}" rx="11.5" fill="none" stroke="url(#kenar)"/>
  ${icerik}</svg>`;
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
    <rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="${R - .5}" fill="none" stroke="#000" stroke-opacity=".7" filter="url(#ic)"/>
    <path d="M${x + R} ${y + h - .5} H${x + w - R}" stroke="#FFFFFF" stroke-opacity=".1"/>`;
  if (hw > fw + 2) {
    const ht = o.hayaletTon ?? ton;
    s += `<rect x="${x + fw - R}" y="${y + 1.5}" width="${hw - fw + R}" height="${h - 3}" rx="${R - 1.5}" fill="url(#s-${ht})"/>
      <rect x="${x + hw - 1}" y="${y - 2}" width="2" height="${h + 4}" rx="1" fill="${TON[ht][0]}" opacity=".8"/>`;
  }
  if (fw > 0) {
    const nabiz = o.nabiz ? `<animate attributeName="opacity" values=".55;1;.55" dur="1.4s" repeatCount="indefinite"/>` : "";
    // erime: dolgu o.erime saniyede sıfıra iner (önbellek geri sayımı); SVG her dakika yeniden çizilse de arada akar.
    const er = o.erime > 0 ? `<animate attributeName="width" from="${fw}" to="0" dur="${Math.round(o.erime)}s" fill="freeze"/>` : "";
    s += `<clipPath id="k-${id}"><rect x="${x}" y="${y}" width="${fw}" height="${h}" rx="${R}">${er}</rect></clipPath>
      <rect x="${x}" y="${y + 1}" width="${fw}" height="${h}" rx="${R}" fill="${TON[ton][1]}" opacity=".7" filter="url(#parilti)">${nabiz}${er}</rect>
      <rect x="${x}" y="${y}" width="${fw}" height="${h}" rx="${R}" fill="url(#d-${ton})">${er}</rect>
      <g clip-path="url(#k-${id})">
        <rect x="${x + 2}" y="${y + 1.5}" width="${Math.max(0, fw - 4)}" height="${r1(h * .42)}" rx="${r1(h * .21)}" fill="url(#cam)" opacity=".85"/>
        ${o.akis === false ? "" : `<rect x="${x - 70}" y="${y}" width="70" height="${h}" fill="url(#isilti)" transform="skewX(-20)"><animateTransform attributeName="transform" type="translate" additive="sum" from="0 0" to="${fw + 110} 0" dur="${Math.max(1.6, r1(fw / 110))}s" repeatCount="indefinite"/></rect>`}
      </g>
      <rect x="${x + .5}" y="${y + .5}" width="${fw - 1}" height="${h - 1}" rx="${R - .5}" fill="none" stroke="#FFFFFF" stroke-opacity=".28">${o.erime > 0 ? `<animate attributeName="width" from="${fw - 1}" to="0" dur="${Math.round(o.erime)}s" fill="freeze"/>` : ""}</rect>`;
  }
  if (o.imlec != null) {
    const cx = r1(x + Math.min(1, Math.max(0, o.imlec)) * w);
    s += `<g><rect x="${cx - 2}" y="${y - 5}" width="4" height="${h + 10}" rx="2" fill="#67E8F9" opacity=".45" filter="url(#parilti)"/>
      <rect x="${cx - 1}" y="${y - 4}" width="2" height="${h + 8}" rx="1" fill="#CFFAFE"/>
      <path d="M${cx - 4} ${y - 8} h8 l-4 4.5 z" fill="#67E8F9"/></g>`;
  }
  return s;
}

// Hap: tonlu yarı saydam rozet. Genişlik yazı uzunluğundan kestirilir.
export function hap(x, yOrta, yazi, ton) {
  const g = Math.round(String(yazi).length * 6.3 + 22);
  return `<g transform="translate(${x} ${yOrta - 11})">
    <rect width="${g}" height="22" rx="11" fill="${TON[ton][1]}" fill-opacity=".16"/>
    <rect x=".5" y=".5" width="${g - 1}" height="21" rx="10.5" fill="none" stroke="${TON[ton][0]}" stroke-opacity=".45"/>
    <circle cx="11" cy="11" r="3" fill="${TON[ton][0]}"/>
    <text x="19" y="15" font-size="11.5" font-weight="600" fill="${TON[ton][0]}">${kacis(yazi)}</text></g>`;
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
      <text x="50" y="${orta + 4}" font-size="10.5" font-weight="700" letter-spacing="1.3" fill="#94A3B8">${kacis(r.etiket)}</text>
      ${kapsul({ id: r.kind, x: 132, y: orta - 7, w: 300, h: 14, oran: r.yuzde / 100, ton: r.ton, hayalet: r.hayalet, hayaletTon: r.hayaletTon, imlec: r.imlec, nabiz: r.nabiz })}
      <text x="492" y="${orta + 6}" text-anchor="end" font-size="17" font-weight="800" fill="${TON[r.ton][0]}">${Math.round(r.yuzde)}<tspan font-size="11" font-weight="700" fill="#94A3B8">%</tspan></text>
      <text x="508" y="${orta + 4}" font-size="11.5" fill="#94A3B8">↻ ${kacis(r.sifirlanma)}</text>
      ${r.durum ? hap(592, orta, r.durum.yazi, r.durum.ton) : ""}</g>`;
  }).join("");
  if (onbellek) {
    const o = onbellek, orta = 9 + satirlar.length * SH + SH / 2;
    const ton = o.sicak ? o.ton : "kirmizi";
    const halka = `<g transform="translate(12 12)" fill="none" stroke="#FFFFFF" stroke-width="2"><circle r="6"${o.sicak ? "" : ` stroke-dasharray="2.5 2.5"`}/><circle r="2" fill="#FFFFFF" stroke="none"/></g>`;
    govde += `<g><title>${kacis(o.ozet)}</title>
      ${cip(16, orta - 12, ton, halka)}
      <text x="50" y="${orta + 4}" font-size="10.5" font-weight="700" letter-spacing="1.3" fill="#94A3B8">ÖNBELLEK</text>
      ${kapsul({ id: "onbellek", x: 132, y: orta - 7, w: 300, h: 14, oran: o.sicak ? o.oran : 0, ton, erime: o.sicak ? o.saniye : 0, akis: false })}
      ${o.sicak
        ? `<text x="492" y="${orta + 5}" text-anchor="end" font-size="13" font-weight="800" fill="${TON[ton][0]}">${kacis(o.ttl)}</text>
           ${hap(508, orta, o.kalan, ton)}
           <text x="${508 + Math.round(o.kalan.length * 6.3 + 22) + 10}" y="${orta + 4}" font-size="10.5" fill="#64748B">${kacis(o.kisa)}</text>`
        : `${hap(442, orta, "soğuk", "kirmizi")}<text x="514" y="${orta + 4}" font-size="11" fill="#FCA5A5">${kacis(o.yazi)}</text>`}</g>`;
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
      <text x="50" y="${orta - 2}" font-size="10.5" font-weight="700" letter-spacing="1.3" fill="#94A3B8">TAHMİN</text>
      <text x="50" y="${orta + 11}" font-size="9.5" fill="#64748B">${kacis(is.tur)}</text>
      ${kapsul({ id: "is", x: 132, y: orta - 7, w: 300, h: 14, oran: is.oran, ton: is.ton, akis: false })}
      <text x="492" y="${orta + 6}" text-anchor="end" font-size="17" font-weight="800" fill="${TON[is.ton][0]}">${is.yuzde}<tspan font-size="11" font-weight="700" fill="#94A3B8">%</tspan></text>
      ${hap(508, orta, is.kalan, is.kalanTon)}
      <text x="132" y="${orta + 22}" font-size="10" fill="#64748B">${kacis(is.detay)}</text>`;
    y += 48;
  }
  const orta = y + 16;
  const ton = durum.acik ? "yesil" : "gri";
  const elmas = `<path d="M12 5 L19 12 L12 19 L5 12 Z" fill="#FFFFFF" fill-opacity="${durum.acik ? .95 : .5}"/>`;
  const parca = [`${durum.prompt} prompt'a eklendi`, `${durum.edit} edit`];
  govde += `${cip(16, orta - 12, ton, elmas)}
    <text x="50" y="${orta + 4}" font-size="12.5" font-weight="700" fill="${TON[ton][0]}">${durum.acik ? "diff-only" : "diff-only kapalı"}</text>
    <text x="132" y="${orta + 4}" font-size="11.5" fill="#94A3B8">${kacis(parca.join("  ·  "))}</text>
    ${durum.engel ? hap(400, orta, `${durum.engel} Write engellendi`, "sari") : ""}
    <text x="${W - 22}" y="${orta + 4}" text-anchor="end" font-size="11" fill="#64748B" font-family="ui-monospace,Consolas,monospace">/diffmod</text>`;
  return kart(y + 34, govde);
}
