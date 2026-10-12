// Ekip şeması: uygulama yüzeylerinde (masaüstü, web, VS Code, mobil) paneli bir PC arayüzü gibi çizer —
// başlık çubuğu, en üstte danışman, altında kademe sütunları (Uzman/Hızlı/Hafif) ve her kademenin üye kartları,
// ast-üst bağlantı çizgileriyle. Saf fonksiyon; SVG metni üretir, resim olarak çizilir (animasyon yok).
// Zemin şeffaf değil: kartlar kendi yüzeyinde; renkler prefers-color-scheme ile açık/koyu temaya uyar.
// Kaynak yalnız görünen değer değişince değişsin diye yüzde 5'lik, süre dakikalık adımlara yuvarlanır.

export const SW = 640;
const FONT = "'Segoe UI Variable Text','Segoe UI',system-ui,sans-serif";
export const KADEME_RENK = { danışman: "#C026D3", uzman: "#2563EB", hızlı: "#0891B2", hafif: "#16A34A" };
const DURUM_RENK = { calisiyor: "#0EA5E9", bitti: "#16A34A", hata: "#DC2626", iptal: "#DC2626", bekliyor: "#A1A1AA" };

const STIL = `<style>
  .kart{fill:#FFFFFF;stroke:#E4E4E7}.zemin{fill:#F4F4F5}.yazi{fill:#18181B}.mut{fill:#5B5B65}.cizgi{stroke:#D4D4D8}.trk{fill:#000000;fill-opacity:.08}
  @media (prefers-color-scheme:dark){.kart{fill:#232327;stroke:#3F3F46}.zemin{fill:#1A1A1D}.yazi{fill:#F4F4F5}.mut{fill:#A1A1AA}.cizgi{stroke:#52525B}.trk{fill:#FFFFFF;fill-opacity:.12}}
</style>`;
const k = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kisalt = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

function hap(x, y, yazi, renk, sag = false) {
  const w = Math.round(String(yazi).length * 6.2 + 20);
  const x0 = sag ? x - w : x;
  return { w, svg: `<g transform="translate(${x0} ${y})"><rect width="${w}" height="20" rx="10" fill="${renk}" fill-opacity=".12" stroke="${renk}" stroke-opacity=".45"/>
    <circle cx="10" cy="10" r="3" fill="${renk}"/><text x="17" y="14" font-size="11" font-weight="600" fill="${renk}">${k(yazi)}</text></g>` };
}

// ── Dinamik ikonlar: 12×12 çizgi glifler; beyaz, durum renginde yuvarlağın içinde ──
const GLIF = {
  belge: "M3 1.5h4l2 2v7H3z M7 1.5v2h2",
  ara: "M5 2a3 3 0 1 0 .01 0z M7.3 7.3L10.5 10.5",
  kalem: "M2 10l.8-2.6L8 2.2l1.8 1.8-5.2 5.2z M7 3.2l1.8 1.8",
  terminal: "M2 3l3 3-3 3 M6.5 9.5h3.5",
  test: "M4.5 1.5h3 M5 1.5v3L2.5 9.5a1 1 0 0 0 .9 1.5h5.2a1 1 0 0 0 .9-1.5L7 4.5v-3",
  dal: "M3.5 2v8 M8.5 2.5c0 2.5-2 3.5-5 3.5 M3.5 2h.1 M8.5 2.5h.1 M3.5 10h.1",
  kure: "M6 1.5a4.5 4.5 0 1 0 .01 0z M1.5 6h9 M6 1.5c-2 2.2-2 6.8 0 9 M6 1.5c2 2.2 2 6.8 0 9",
  cark: "M6 4a2 2 0 1 0 .01 0z M6 1v1.5 M6 9.5V11 M1 6h1.5 M9.5 6H11 M2.5 2.5l1 1 M8.5 8.5l1 1 M9.5 2.5l-1 1 M3.5 8.5l-1 1",
  liste: "M4 3h6 M4 6h6 M4 9h6 M2 3h.1 M2 6h.1 M2 9h.1",
  cip: "M3 3h6v6H3z M5 1v2 M7 1v2 M5 9v2 M7 9v2 M1 5h2 M1 7h2 M9 5h2 M9 7h2",
  pencere: "M1.5 2.5h9v7h-9z M1.5 4.5h9",
  yildiz: "M6 1.5l1.4 3 3.1.4-2.3 2.1.6 3.1L6 8.6 3.2 10.1l.6-3.1L1.5 4.9l3.1-.4z",
  ag: "M6 2.5a1.5 1.5 0 1 0 .01 0z M2.5 9.5a1.5 1.5 0 1 0 .01 0z M9.5 9.5a1.5 1.5 0 1 0 .01 0z M6 4.5v2 M6 6.5L3.2 8.2 M6 6.5l2.8 1.7",
  check: "M2.5 6.5l2.5 2.5 4.5-5",
  x: "M3 3l6 6 M9 3l-6 6",
  nokta: "M6 6h.1",
};
const ROL_IKON = { "kod-inceleyici": "ara", "test-yazici": "test", "hizli-isci": "cark", "hafif-isci": "liste", dokumantasyoncu: "belge",
  "firmware-analist": "cip", "arayuz-gelistirici": "pencere", "model-izci": "kure", "general-purpose": "yildiz", denetmen: "ara" };
/** Üyenin ikonu: bitti ✓, hata ✕, çalışırken o anki araç (Read/Grep/Edit/Bash…), yoksa rolü. */
export function ikonSec(u) {
  if (u.durum === "bitti") return "check";
  if (u.durum === "hata" || u.durum === "iptal") return "x";
  const rol = ROL_IKON[String(u.ad ?? "").replace(/^ekip:/, "")] ?? "nokta";
  if (u.durum !== "calisiyor") return rol;
  const m = String(u.simdi ?? "").match(/^([A-Za-z_]+)\s*(.*)$/);
  if (!m) return rol;
  const [, arac, arg] = m;
  if (/^(Read|NotebookRead)$/i.test(arac)) return "belge";
  if (/^(Grep|Glob|LS)$/i.test(arac)) return "ara";
  if (/^(Edit|Write|NotebookEdit|MultiEdit)$/i.test(arac)) return "kalem";
  if (/^(WebFetch|WebSearch)$/i.test(arac)) return "kure";
  if (/^(Agent|Task)$/i.test(arac)) return "ag";
  if (/^Bash$/i.test(arac)) {
    if (/\b(test|pytest|vitest|jest|unittest)\b/i.test(arg)) return "test";
    if (/^git\b/i.test(arg)) return "dal";
    if (/\b(build|make|tsc|compile|cmake|webpack|vite)\b/i.test(arg)) return "cark";
    return "terminal";
  }
  return rol;
}
/** Durum renginde yuvarlak + beyaz glif; çalışırken (anim) hafif nabız. */
function ikonCiz(cx, cy, r, key, renk, nabiz = false) {
  const g = GLIF[key] ?? GLIF.nokta;
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${renk}">${nabiz ? '<animate attributeName="opacity" values="1;.55;1" dur="1.2s" repeatCount="indefinite"/>' : ""}</circle>
    <g transform="translate(${cx - 6} ${cy - 6})" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="${g}"/></g></g>`;
}

/** Başlık çubuğu: ekip adı, amaç; sağda tur, bütçe ve son kontrol rozetleri. */
function baslik(m) {
  let x = SW - 12, rozet = "";
  for (const r of [m.sonKontrol, m.butce, m.tur].filter(Boolean)) { const h = hap(x, 12, r.yazi, r.renk, true); rozet += h.svg; x -= h.w + 6; }
  return `<rect x=".5" y=".5" width="${SW - 1}" height="43" rx="10" class="kart"/>
    <path d="M18 14 l7 8 -7 8 -7 -8z" fill="${KADEME_RENK.danışman}"/>
    <text x="34" y="21" font-size="14" font-weight="700" class="yazi">${k(kisalt(m.ekip.ad, 28))}</text>
    <text x="34" y="36" font-size="10.5" class="mut">${k(kisalt(m.ekip.amac, Math.max(20, Math.round((x - 40) / 5.6))))}</text>${rozet}`;
}

/** Danışman düğümü: avatar, ad/model, durum ve şu anki işi. */
function danismanKart(d, y) {
  const w = 300, x = (SW - w) / 2, renk = KADEME_RENK.danışman;
  const durumRenk = d.mesgul ? renk : "#16A34A";
  return `<g transform="translate(${x} ${y})">
    <rect x=".5" y=".5" width="${w - 1}" height="57" rx="10" class="kart"/><rect x=".5" y=".5" width="4" height="57" rx="2" fill="${renk}"/>
    <circle cx="30" cy="29" r="17" fill="${renk}"/><text x="30" y="34.5" text-anchor="middle" font-size="15" font-weight="800" fill="#FFFFFF">F</text>
    <text x="56" y="22" font-size="13" font-weight="700" class="yazi">Danışman</text>
    <text x="126" y="22" font-size="11" class="mut">${k(d.model)} · yönetir, denetler</text>
    ${d.mesgul && d.anim ? `<circle cx="60" cy="39" r="3.5" fill="${durumRenk}"><animate attributeName="r" values="3.5;5.5;3.5" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.35;1" dur="1.2s" repeatCount="indefinite"/></circle>` : `<circle cx="60" cy="39" r="3.5" fill="${durumRenk}"/>`}
    <text x="69" y="43" font-size="11" font-weight="600" fill="${durumRenk}">${k(d.durum)}</text>
    <text x="${69 + Math.round(String(d.durum).length * 6.3) + 8}" y="43" font-size="10.5" class="mut">${k(kisalt(d.odak || d.is, 34))}</text></g>`;
}
/** Akan kesikli bağ: iş akışının hangi kola indiğini gösterir (animasyon kapalıysa düz renkli çizgi). */
const akim = (yol, renk, anim) => `<path d="${yol}" stroke="${renk}" stroke-width="2" ${anim ? 'stroke-dasharray="4 4"' : ""} fill="none">${anim ? '<animate attributeName="stroke-dashoffset" from="8" to="0" dur="0.7s" repeatCount="indefinite"/>' : ""}</path>`;

/** Kademe başlığı: renkli şerit, kademe adı, model, hız/fiyat. */
function kademeBaslik(kd, x, y, w) {
  const renk = KADEME_RENK[kd.kademe] ?? "#71717A";
  return `<g transform="translate(${x} ${y})"><rect x=".5" y=".5" width="${w - 1}" height="39" rx="8" class="kart"/>
    <rect x=".5" y=".5" width="${w - 1}" height="4" rx="2" fill="${renk}"/>
    <text x="12" y="22" font-size="12.5" font-weight="700" fill="${renk}">${k(kd.etiket)}</text>
    <text x="${Math.max(64, 12 + Math.round(kd.etiket.length * 8.4) + 8)}" y="22" font-size="11" font-weight="600" class="yazi">${k(kd.modelAd)}</text>
    <text x="12" y="34" font-size="10" class="mut">${k(kisalt(kd.alt, Math.round((w - 20) / 5)))}</text></g>`;
}

/** Üye kartı: durum noktası, ad, yüzde ve süre, ilerleme çubuğu, görev; brif rozeti. */
/** Kart yüksekliği: bekleyen üye tek satırlık çip, işi olan tam kart. */
export const kartYuksekligi = u => (u.durum === "bekliyor" ? 28 : 68);
function uyeKart(u, x, y, w, anim = false) {
  const renk = DURUM_RENK[u.durum] ?? DURUM_RENK.bekliyor;
  if (u.durum === "bekliyor") {
    return `<g transform="translate(${x} ${y})"><rect x=".5" y=".5" width="${w - 1}" height="27" rx="8" class="kart"/>
    ${ikonCiz(16, 14, 8, ikonSec(u), "#A1A1AA")}
    <text x="30" y="18" font-size="11.5" font-weight="600" class="mut">${k(kisalt(u.ad, Math.round((w - 90) / 6.5)))}</text>
    <text x="${w - 10}" y="18" text-anchor="end" font-size="10.5" class="mut">bekliyor</text></g>`;
  }
  const sag = u.durum === "bekliyor" ? "bekliyor" : `${u.yuzde}% · ${u.sure}`;
  const bw = w - 24, dolu = Math.round(bw * Math.min(100, u.yuzde) / 100);
  const calisiyor = u.durum === "calisiyor";
  // Satır 3: çalışırken şu anki eylem, bitince bulgu (ÖZET), yoksa görev.
  const gorevYazi = u.gorev || "görev bekliyor";
  const simdiYazi = calisiyor ? (u.simdi ? `▸ ${u.simdi}` : "▸ başlıyor…") : u.durum === "bitti" && u.ozet ? `✓ ${u.ozet}` : u.durum === "hata" ? "✕ hatayla bitti" : u.durum === "iptal" ? "✕ iptal edildi" : "";
  const nokta = ikonCiz(16, 16, 8.5, ikonSec(u), renk, calisiyor && anim);
  const isilti = calisiyor && anim && dolu > 22 ? `<rect x="12" y="27" width="14" height="4" rx="2" fill="#FFFFFF" fill-opacity=".6"><animate attributeName="x" values="12;${12 + dolu - 14};12" dur="1.8s" repeatCount="indefinite"/></rect>` : "";
  return `<g transform="translate(${x} ${y})"><rect x=".5" y=".5" width="${w - 1}" height="67" rx="8" class="kart"/>
    ${nokta}
    <text x="30" y="20" font-size="11" font-weight="700" class="yazi">${k(kisalt(u.ad, Math.round((w - 88) / 6.1)))}</text>
    <text x="${w - 10}" y="19" text-anchor="end" font-size="10.5" font-weight="600" fill="${u.durum === "bekliyor" ? "#A1A1AA" : renk}">${k(sag)}</text>
    <rect x="12" y="27" width="${bw}" height="4" rx="2" class="trk"/>${dolu > 0 ? `<rect x="12" y="27" width="${Math.max(4, dolu)}" height="4" rx="2" fill="${renk}"/>` : ""}${isilti}
    <text x="12" y="45" font-size="10" class="yazi">${k(kisalt(gorevYazi, Math.round((w - (u.brif ? 60 : 20)) / 5.2)))}</text>
    <text x="12" y="60" font-size="10" ${calisiyor ? `font-weight="600" fill="${renk}"` : 'class="mut"'}>${k(kisalt(simdiYazi, Math.round((w - 20) / 5.2)))}</text>
    ${u.brif ? `<g transform="translate(${w - 50} 36)"><rect width="40" height="13" rx="6.5" fill="${KADEME_RENK.danışman}" fill-opacity=".14"/><text x="20" y="9.5" text-anchor="middle" font-size="8.5" font-weight="700" fill="${KADEME_RENK.danışman}">${u.brif} brif</text></g>` : ""}</g>`;
}

/**
 * m: { ekip:{ad,amac}, tur?:{yazi,renk}, butce?:{yazi,renk}, sonKontrol?:{yazi,renk},
 *      danisman:{model,durum,is,mesgul}, kademeler:[{kademe,etiket,modelAd,alt,uyeler:[{ad,durum,yuzde,sure,gorev,brif}]}] }
 */
export function semaSvg(m) {
  const KY = 72, BUS = 150, KB = 162, UY = 212, UH = 68, UG = 8;
  const n = m.kademeler.length || 1, gap = 10, cw = Math.floor((SW - gap * (n - 1)) / n);
  // Her kartın kendi yüksekliği var (bekleyenler çip): sütun içinde yukarıdan aşağı biriktir.
  const kartYer = m.kademeler.map(kd => { let y = UY; return kd.uyeler.map(u => { const h = kartYuksekligi(u); const r = { y, h }; y += h + UG; return r; }); });
  const enYuksek = Math.max(24, ...kartYer.map(a => (a.length ? a[a.length - 1].y + a[a.length - 1].h - UY : 24)));
  const anim = m.anim !== false;
  const akis = (m.akis ?? []).slice(0, 8);
  const diger = (m.diger ?? []).slice(0, 4);
  const digerY = UY + enYuksek + 6;
  const digerH = diger.length ? 24 + diger.length * 34 : 0;
  const akisY = digerY + digerH + (digerH ? 6 : 0);
  const akisH = akis.length ? 24 + akis.length * 15 : 0;
  const H = akisY + akisH + 26;
  const sx = i => Math.round(i * (cw + gap));
  const orta = i => Math.round(sx(i) + cw / 2);
  const calisanKademe = m.kademeler.map(kd => kd.uyeler.some(u => u.durum === "calisiyor"));
  const aktif = calisanKademe.some(Boolean) || m.danisman.mesgul;
  // Ast-üst bağları: danışmandan veri yoluna, yoldan her kademeye; kademeden üye kartlarına sol ray.
  let cizgiler = `<path d="M${SW / 2} ${KY + 58} V${BUS}" class="cizgi" stroke-width="1.5" fill="none"/>`;
  if (n > 1) cizgiler += `<path d="M${orta(0)} ${BUS} H${orta(n - 1)}" class="cizgi" stroke-width="1.5" fill="none"/>`;
  if (aktif) cizgiler += akim(`M${SW / 2} ${KY + 58} V${BUS}`, KADEME_RENK.danışman, anim);
  m.kademeler.forEach((kd, i) => {
    const renk = KADEME_RENK[kd.kademe] ?? "#71717A";
    cizgiler += `<path d="M${orta(i)} ${BUS} V${KB}" class="cizgi" stroke-width="1.5" fill="none"/>`;
    if (calisanKademe[i]) {
      // Akış danışmandan yola, oradan çalışan kademeye iner.
      cizgiler += akim(`M${SW / 2} ${BUS} H${orta(i)} V${KB}`, renk, anim);
    }
    if (kd.uyeler.length) {
      const rx = sx(i) + 10, son = kartYer[i].at(-1).y + kartYer[i].at(-1).h / 2;
      cizgiler += `<path d="M${rx} ${KB + 40} V${son}" class="cizgi" stroke-width="1.5" fill="none"/>`;
      kd.uyeler.forEach((u, j) => {
        const yy = kartYer[i][j].y + kartYer[i][j].h / 2;
        cizgiler += `<path d="M${rx} ${yy} H${rx + 10}" class="cizgi" stroke-width="1.5" fill="none"/>`;
        if (u.durum === "calisiyor") cizgiler += akim(`M${rx} ${KB + 40} V${yy} H${rx + 10}`, renk, anim);
      });
    }
  });
  const sutunlar = m.kademeler.map((kd, i) =>
    kademeBaslik(kd, sx(i), KB, cw) +
    (kd.uyeler.length ? kd.uyeler.map((u, j) => uyeKart(u, sx(i) + 20, kartYer[i][j].y, cw - 20, anim)).join("")
      : `<text x="${orta(i)}" y="${UY + 20}" text-anchor="middle" font-size="10.5" class="mut">bu kademede üye yok</text>`)).join("");
  const sayim = m.sayim ?? {};
  const lejant = [["calisiyor", "çalışıyor"], ["bitti", "bitti"], ["hata", "hata"], ["bekliyor", "bekliyor"]]
    .map(([d, t], i) => `<circle cx="${14 + i * 104}" cy="${H - 10}" r="4" fill="${DURUM_RENK[d]}"/><text x="${22 + i * 104}" y="${H - 6.5}" font-size="10.5" ${sayim[d] ? 'font-weight="700" class="yazi"' : 'class="mut"'}>${t}${sayim[d] != null ? ` ${sayim[d]}` : ""}</text>`).join("");
  // Ekip dışı çalışan ajanlar (ana oturumun başlattıkları): ad, süre, görev ve şu anki adım.
  const digerSvg = diger.length ? `<g transform="translate(0 ${digerY})"><rect x=".5" y=".5" width="${SW - 1}" height="${digerH - 4}" rx="8" class="kart"/>
    <text x="12" y="16" font-size="11" font-weight="700" class="yazi">Diğer çalışan ajanlar${m.digerFazla ? ` (+${m.digerFazla} daha)` : ""}</text>
    ${diger.map((d, i) => `<g transform="translate(0 ${24 + i * 34})">${ikonCiz(18, 9, 7.5, ikonSec({ ad: d.ad, simdi: d.simdi, durum: "calisiyor" }), DURUM_RENK.calisiyor, anim)}
      <text x="32" y="13" font-size="11" font-weight="700" class="yazi">${k(kisalt(d.ad, 22))}</text>
      <text x="200" y="12" font-size="10" font-weight="600" fill="${DURUM_RENK.calisiyor}">${k(kisalt(d.simdi ? `▸ ${d.simdi}` : "▸ çalışıyor", 52))}</text>
      <text x="${SW - 12}" y="12" text-anchor="end" font-size="10" class="mut">${k(d.sure)}</text>
      <text x="30" y="26" font-size="10" class="mut">${k(kisalt(d.gorev, 96))}</text></g>`).join("")}</g>` : "";
  // Canlı akış: en yeni olay üstte; renk olayı yapan üyenin kademesi (danışman mor).
  const akisSvg = akis.length ? `<g transform="translate(0 ${akisY})"><rect x=".5" y=".5" width="${SW - 1}" height="${akisH - 4}" rx="8" class="kart"/>
    <text x="12" y="16" font-size="11" font-weight="700" class="yazi">Canlı akış</text>
    ${anim ? `<circle cx="84" cy="12.5" r="3" fill="#DC2626"><animate attributeName="opacity" values="1;.2;1" dur="1.4s" repeatCount="indefinite"/></circle>` : ""}
    ${akis.map((a, i) => `<g transform="translate(0 ${24 + i * 15})"><text x="12" y="9" font-size="10" class="mut">${k(a.z)}</text>
      <circle cx="68" cy="6" r="3.5" fill="${KADEME_RENK[a.kademe] ?? KADEME_RENK.danışman}"/>
      <text x="78" y="9" font-size="10.5" font-weight="${i === 0 ? 700 : 600}" class="yazi">${k(kisalt(a.uye, 16))}</text>
      <text x="170" y="9" font-size="10.5" class="${i === 0 ? "yazi" : "mut"}">${k(kisalt(a.metin, 78))}</text></g>`).join("")}</g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${H}" viewBox="0 0 ${SW} ${H}" font-family="${FONT}">${STIL}
    ${baslik(m)}${cizgiler}${danismanKart({ ...m.danisman, anim }, KY)}${sutunlar}${digerSvg}${akisSvg}${lejant}
    <text x="${SW - 4}" y="${H - 6.5}" text-anchor="end" font-size="10" class="mut">ast-üst: danışman → kademe → üye</text></svg>`;
}

/** Yüzde 5'lik, süre dakikalık adım: resim yalnız görünen bir şey değişince değişir. */
export const yuzde5 = p => Math.round(Math.min(1, Math.max(0, p)) * 20) * 5;
export function sureKisa(ms, bitti) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (bitti) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return s < 60 ? "<1 dk" : `${Math.floor(s / 60)} dk`;
}
