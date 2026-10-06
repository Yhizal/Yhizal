// Sade çubuklar: Claude Code uygulamasında (masaüstü, web, VS Code, mobil) ince düz çubuklar, satır başına 20px.
// Saf fonksiyonlar; yalnız SVG metni üretir. Zemin şeffaf, renkler prefers-color-scheme ile açık/koyu temaya uyar.
// Resim olarak çizilir (isInteractive yok): her yeni metin resmi değiştirir, o yüzden kaynak yalnız görünen
// değer değişince değişsin diye değerler kaba adımlara yuvarlanır.
// kota-cubugu ve diff-disiplin aynı dosyanın birer kopyasını taşır (eklentiler birbirini içe aktaramaz);
// iki kart aynı sütun ızgarasını kullanır, alt alta hizalı durur.

export const W = 600;
const SH = 20; // satır yüksekliği
const FONT = "'Segoe UI Variable Text','Segoe UI',system-ui,sans-serif";
// Sütunlar: etiket, çubuk, değer (sağa yaslı), açıklama.
const K = { etiket: 0, cubuk: 72, cubukW: 180, deger: 292, yazi: 300 };

// Çubuk rengi (iki temada aynı) ve koyu temada yazı rengi.
export const TON = { yesil: "#16A34A", sari: "#D97706", kirmizi: "#DC2626", mor: "#7C3AED", mavi: "#0891B2", gri: "#71717A" };
const YAZI_KOYU = { yesil: "#4ADE80", sari: "#FBBF24", kirmizi: "#F87171", mor: "#A78BFA", mavi: "#22D3EE", gri: "#A1A1AA" };

// Tema sınıfları: lbl etiket, mut soluk yazı, trk çubuk yolu, im zaman imleci, tx-* tonlu yazı.
const STIL = `<style>
  .lbl{fill:#52525B}.mut{fill:#A1A1AA}.trk{fill:#000000;fill-opacity:.08}.im{fill:#3F3F46}
  ${Object.entries(TON).map(([ad, c]) => `.tx-${ad}{fill:${c}}`).join("")}
  @media (prefers-color-scheme:dark){
    .lbl{fill:#D4D4D8}.mut{fill:#71717A}.trk{fill:#FFFFFF;fill-opacity:.1}.im{fill:#E4E4E7}
    ${Object.entries(YAZI_KOYU).map(([ad, c]) => `.tx-${ad}{fill:${c}}`).join("")}
  }</style>`;

const r1 = n => Math.round(n * 2) / 2;
export const kacis = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Kart: şeffaf zemin; uygulamanın kendi bant rengi görünür.
function kart(satir, icerik) {
  const h = satir * SH + 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" font-family="${FONT}" font-size="12">${STIL}${icerik}</svg>`;
}
// Bir satır: soldaki etiket, ortadaki çubuk, sağa yaslı değer, ardından açıklama parçaları.
// parcalar: [{ yazi, sinif }] boşlukla art arda dizilir; genişlik kabaca kestirilir.
function satir(i, { etiket, etiketSinif = "lbl", cubuk, deger, degerSinif, parcalar = [], ipucu }) {
  const y = i * SH + SH / 2 + 1;
  let x = K.yazi;
  const yazilar = parcalar.filter(p => p?.yazi).map(p => {
    const t = `<text x="${x}" y="${y + 4}" font-size="${p.kucuk ? 11 : 11.5}" class="${p.sinif ?? "mut"}">${kacis(p.yazi)}</text>`;
    x += Math.round(String(p.yazi).length * (p.kucuk ? 5.6 : 6.1)) + 8;
    return t;
  }).join("");
  return `<g>${ipucu ? `<title>${kacis(ipucu)}</title>` : ""}
    <text x="${K.etiket}" y="${y + 4}" class="${etiketSinif}">${kacis(etiket)}</text>
    ${cubuk ? kapsul({ x: K.cubuk, y: y - 3, w: K.cubukW, h: 6, ...cubuk }) : ""}
    ${deger != null ? `<text x="${K.deger}" y="${y + 4}" text-anchor="end" font-weight="600" class="${degerSinif}">${kacis(deger)}</text>` : ""}
    ${yazilar}</g>`;
}

// İnce düz çubuk: yol, dolgu; isteğe bağlı tahmin gölgesi (aynı tonun açığı) ve zaman imleci (ince çizgi).
// o: { x, y, w, h, oran 0..1, ton, hayalet? 0..1 (tahmin ucu), hayaletTon?, imlec? 0..1 }
export function kapsul(o) {
  const { x, y, w, h, ton } = o;
  const R = h / 2;
  const fw = o.oran > 0 ? Math.max(h, r1(Math.min(1, o.oran) * w)) : 0;
  const hw = o.hayalet != null ? r1(Math.min(1, o.hayalet) * w) : 0;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${R}" class="trk"/>`;
  if (hw > fw + 2) s += `<rect x="${x}" y="${y}" width="${hw}" height="${h}" rx="${R}" fill="${TON[o.hayaletTon ?? ton]}" opacity=".25"/>`;
  if (fw > 0) s += `<rect x="${x}" y="${y}" width="${fw}" height="${h}" rx="${R}" fill="${TON[ton]}"/>`;
  if (o.imlec != null) {
    const cx = r1(x + Math.min(1, Math.max(0, o.imlec)) * w);
    s += `<rect x="${cx - .75}" y="${y - 3}" width="1.5" height="${h + 6}" rx=".75" class="im"/>`;
  }
  return s;
}

// ── Kota kartı ──
// satirlar: [{ kind, cip, etiket, yuzde, ton, imlec, hayalet, hayaletTon, sifirlanma, durum:{yazi,ton}, ipucu, nabiz }]
// onbellek: null | { sicak, ton, ttl, oran, saniye, kalan, ozet } | { sicak:false, yazi, ozet }
export function kotaKarti(satirlar, onbellek = null) {
  let govde = satirlar.map((r, i) => satir(i, {
    etiket: r.etiket, ipucu: r.ipucu,
    cubuk: { oran: r.yuzde / 100, ton: r.ton, hayalet: r.hayalet, hayaletTon: r.hayaletTon, imlec: r.imlec },
    deger: `${Math.round(r.yuzde)}%`, degerSinif: `tx-${r.ton}`,
    parcalar: [{ yazi: `↻ ${r.sifirlanma}` }, r.durum && { yazi: r.durum.yazi, sinif: `tx-${r.durum.ton}` }],
  })).join("");
  if (onbellek) {
    const o = onbellek;
    govde += satir(satirlar.length, o.sicak
      ? { etiket: "Önbellek", ipucu: o.ozet, cubuk: { oran: o.oran, ton: o.ton }, deger: o.kalan.replace(/ kaldı$/, ""), degerSinif: `tx-${o.ton}`,
          parcalar: [{ yazi: "kaldı" }, { yazi: o.kisa, kucuk: true }] }
      : { etiket: "Önbellek", ipucu: o.ozet, cubuk: { oran: 0, ton: "kirmizi" }, deger: "soğuk", degerSinif: "tx-kirmizi",
          parcalar: [{ yazi: o.yazi }] });
  }
  return kart(satirlar.length + (onbellek ? 1 : 0), govde);
}

// ── İş kartı (diff-disiplin): üstte tahmin çubuğu (iş sürerken), altta diff-only durumu ──
// is: null | { oran, ton, yuzde, kalan, kalanTon, detay }
// durum: { acik, prompt, edit, engel }
export function isKarti(is, durum) {
  let govde = "", i = 0;
  if (is) govde += satir(i++, {
    etiket: "Tahmin", ipucu: is.ipucu,
    cubuk: { oran: is.oran, ton: is.ton },
    deger: `${is.yuzde}%`, degerSinif: `tx-${is.ton}`,
    parcalar: [{ yazi: is.kalan, sinif: `tx-${is.kalanTon}` }, { yazi: is.detay, kucuk: true }],
  });
  // diff-only satırı çubuksuz: sayaçlar çubuk sütununda başlar.
  const y = i * SH + SH / 2 + 1;
  const parca = `${durum.prompt} prompt'a eklendi · ${durum.edit} edit`;
  govde += `<g><text x="${K.etiket}" y="${y + 4}" font-weight="600" class="tx-${durum.acik ? "yesil" : "gri"}">${durum.acik ? "diff-only" : "diff kapalı"}</text>
    <text x="${K.cubuk}" y="${y + 4}" font-size="11.5" class="mut">${kacis(parca)}${durum.engel ? `<tspan class="tx-sari"> · ${durum.engel} Write engellendi</tspan>` : ""}</text>
    <text x="${W - 2}" y="${y + 4}" text-anchor="end" font-size="11" class="mut" font-family="ui-monospace,Consolas,monospace">/diffmod</text></g>`;
  return kart(i + 1, govde);
}
