// Pano: ekip panelinin mühendislik şematiği. Swimlane zaman çizelgesi — satır = ajan, yatay eksen = zaman,
// çubuk = çalışma aralığı; danışman satırında olay işaretleri, brif'ler danışmandan işçiye inen ince oklar.
// Tasarım sistemi: nötr gri ölçek + tek vurgu (mavi = çalışıyor); kırmızı yalnız hata, yeşil yalnız ✓, amber yalnız
// bütçe uyarısı. 1 px saç çizgisi, kutu/gölge/gradyan yok; sayı ve saat monospace; durum renkle birlikte yazıyla da verilir.
// Düz resim: animasyon yok. Canlılık içerikten gelir (çubuk uzar, "şimdi" ilerler, oklar düşer, günlük akar).
// Açık/koyu tema prefers-color-scheme ile.

export const SW = 640;
const FONT = "'Segoe UI Variable Text','Segoe UI',system-ui,sans-serif";
const MONO = "ui-monospace,'Cascadia Mono','SF Mono',Consolas,monospace";
// Sütunlar: etiket | zaman çizelgesi | ayrıntı
const X = { ikon: 14, ad: 34, t0: 176, t1: 440, d0: 452, d1: 628 };
const SATIR = 26, SATIR_BOS = 20, BASLIK = 16, DAN = 30;

const STIL = `<style>
  .ink{fill:#1F2328}.mut{fill:#656D76}.acc{fill:#0969DA}.err{fill:#CF222E}.warn{fill:#9A6700}.ok{fill:#1A7F37}.dn{fill:#6E7781}
  .ln{stroke:#D0D7DE}.band{fill:#F6F8FA}.sacc{stroke:#0969DA}.smut{stroke:#656D76}.sink{stroke:#1F2328}.serr{stroke:#CF222E}.sok{stroke:#1A7F37}
  @media (prefers-color-scheme:dark){
    .ink{fill:#E6EDF3}.mut{fill:#8B949E}.acc{fill:#4493F8}.err{fill:#F85149}.warn{fill:#D29922}.ok{fill:#3FB950}.dn{fill:#8B949E}
    .ln{stroke:#30363D}.band{fill:#161B22}.sacc{stroke:#4493F8}.smut{stroke:#8B949E}.sink{stroke:#E6EDF3}.serr{stroke:#F85149}.sok{stroke:#3FB950}
  }
</style>`;

export const k = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kisalt = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

// ── Dinamik ikonlar: 12×12 tek renkli çizgi glifler ──
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
const glif = (key, cx, cy, sinif) =>
  `<g transform="translate(${cx - 6} ${cy - 6})" fill="none" class="${sinif}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="${GLIF[key] ?? GLIF.nokta}"/></g>`;

const DURUM_SINIF = { calisiyor: "acc", bitti: "dn", hata: "err", iptal: "dn", bekliyor: "mut" };
const GLIF_SINIF = { calisiyor: "sacc", bitti: "smut", hata: "serr", iptal: "smut", bekliyor: "smut" };

/** Yüzde 5'lik, süre dakikalık adım: resim yalnız görünen bir şey değişince değişir. */
export const yuzde5 = p => Math.round(Math.min(1, Math.max(0, p)) * 20) * 5;
export function sureKisa(ms, bitti) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (bitti) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return s < 60 ? "<1 dk" : `${Math.floor(s / 60)} dk`;
}

const NICE_DK = [2, 3, 5, 10, 15, 20, 30, 45, 60];
/** Zaman penceresi: en erken olay + %8 pay, "güzel" bir dakika değerine yukarı yuvarlanır. */
export function zamanPenceresi(now, bas) {
  const ham = Math.max(60_000, (now - (bas ?? now - 5 * 60_000)) * 1.08);
  const w = (NICE_DK.map(d => d * 60_000).find(n => n >= ham)) ?? 60 * 60_000;
  return { bas: now - w, w };
}
const eksenEtiket = (kalanMs, w) => {
  if (kalanMs <= 0) return "şimdi";
  const s = Math.round(kalanMs / 1000);
  return w <= 5 * 60_000 ? `−${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `−${Math.round(s / 60)} dk`;
};

/**
 * m: { ekip:{ad,amac}, tur?:{yazi}, butce?:{yazi}, sonKontrol?:{yazi}, sayim, zaman:{now,bas},
 *      danisman:{model,durum,is,odak,mesgul,olaylar:[{t,metin}]}, brifler:[{t,uye}],
 *      kademeler:[{kademe,etiket,modelAd,alt,uyeler:[{ad,durum,yuzde,sure,gorev,simdi,ozet,brif,aralik:[{b,e,durum}]}]}],
 *      diger:[{ad,gorev,simdi,sure,b}], digerFazla, akis:[{z,uye,metin,kademe}] }
 */
export function panoSvg(m) {
  // Zaman 5 sn'lik adımlara yuvarlanır: çubuklar 5 sn'de bir uzar, aradaki tazelemelerde çizim değişmez (kırpışma yok).
  const now = Math.floor((m.zaman?.now ?? Date.now()) / 5000) * 5000;
  const { bas: tBas, w: W } = zamanPenceresi(now, m.zaman?.bas);
  const tx = t => Math.round((X.t0 + ((Math.min(Math.max(t, tBas), now) - tBas) / W) * (X.t1 - X.t0)) * 10) / 10;

  // ── Düzen: önce satırları yerleştir, sonra çiz (ızgara en alta) ──
  let y = 0;
  const ust = { y0: 0 };
  y = 30;                                    // araç çubuğu
  const serit = { y };                       // durum şeridi
  y += 20;
  const ekseny = y + 2;                      // eksen başlığı
  y = ekseny + 20;
  const govdeBas = y;
  const satirlar = [];                       // { tip, y, h, ... }
  const baslikEkle = (yazi, sag) => { satirlar.push({ tip: "baslik", y, h: BASLIK, yazi, sag }); y += BASLIK; };
  baslikEkle(`DANIŞMAN · ${m.danisman.model}`, "yönetir · denetler");
  const danY = y; satirlar.push({ tip: "dan", y, h: DAN }); y += DAN;
  const uyeY = new Map();                    // ad → satır ortası (brif okları için)
  for (const kd of m.kademeler) {
    if (!kd.uyeler.length) continue;
    baslikEkle(`${kd.etiket.toUpperCase()} · ${kd.modelAd}`, kd.alt);
    for (const u of kd.uyeler) {
      const h = u.durum === "bekliyor" ? SATIR_BOS : SATIR;
      satirlar.push({ tip: "uye", y, h, u }); uyeY.set(u.ad, y + h / 2); y += h;
    }
  }
  const diger = (m.diger ?? []).slice(0, 4);
  if (diger.length) {
    baslikEkle(`DİĞER AJANLAR${m.digerFazla ? ` (+${m.digerFazla})` : ""}`, "ekip dışı");
    for (const d of diger) satirlar.push({ tip: "diger", y, h: SATIR, d }), y += SATIR;
  }
  const govdeSon = y;
  const akis = (m.akis ?? []).slice(0, 8);
  y += 14;
  const gunY = y;
  const gunH = akis.length ? 20 + akis.length * 16 : 0;
  const H = gunY + gunH + 10;

  // ── Izgara: dikey saç çizgileri + eksen etiketleri + şimdi çizgisi ──
  const N = 5;
  let izgara = "";
  for (let i = 0; i <= N; i++) {
    const t = tBas + (W * i) / N, x = tx(t), son = i === N;
    izgara += `<path d="M${x} ${ekseny + 14} V${govdeSon}" class="${son ? "sacc" : "ln"}" stroke-width="1" ${son ? "" : 'stroke-dasharray="1 3"'} fill="none"/>`;
    izgara += `<text x="${x}" y="${ekseny + 9}" text-anchor="${son ? "end" : i === 0 ? "start" : "middle"}" font-family="${MONO}" font-size="9" class="${son ? "acc" : "mut"}">${eksenEtiket(now - t, W)}</text>`;
  }
  const kolonBasi = `<text x="${X.ikon}" y="${ekseny + 9}" font-size="9.5" letter-spacing=".08em" class="mut">AJAN</text>
    <text x="${X.d0}" y="${ekseny + 9}" font-size="9.5" letter-spacing=".08em" class="mut">ŞU AN</text>
    <path d="M0 ${ekseny + 14.5} H${SW}" class="ln" stroke-width="1" fill="none"/>`;

  // ── Araç çubuğu + durum şeridi ──
  const sy = m.sayim ?? {};
  const sayimYazi = [["calisiyor", "ÇALIŞIYOR"], ["bitti", "BİTTİ"], ["hata", "HATA"], ["bekliyor", "BEKLİYOR"]]
    .filter(([d]) => sy[d]).map(([d, t]) => `<tspan class="${sy[d] && d === "calisiyor" ? "acc" : d === "hata" ? "err" : "ink"}" font-weight="600">${sy[d]}</tspan> <tspan class="mut">${t}</tspan>`).join('<tspan class="mut">  ·  </tspan>');
  const arac = `<text x="${X.ikon}" y="19" font-size="13" font-weight="600" class="ink">${k(kisalt(m.ekip.ad, 26))}</text>
    <text x="${X.ikon + Math.min(26, m.ekip.ad.length) * 7.4 + 10}" y="19" font-size="10.5" class="mut">${k(kisalt(m.ekip.amac, 40))}</text>
    <text x="${SW - 12}" y="19" text-anchor="end" font-family="${MONO}" font-size="9.5" xml:space="preserve" style="white-space:pre">${sayimYazi}</text>`;
  const butceDeger = m.butce?.yazi?.replace(/^bütçe /, "");
  const skDeger = m.sonKontrol?.yazi?.replace(/^son kontrol ?/, "") || "";
  const butceSinif = /kritik/.test(butceDeger ?? "") ? "err" : /tasarruf/.test(butceDeger ?? "") ? "warn" : "ink";
  const skSinif = /✕/.test(skDeger) ? "err" : /✓/.test(skDeger) ? "ok" : "mut";
  const seritYazi = [
    m.tur ? `<tspan class="mut">TUR</tspan> <tspan class="ink" font-weight="600">${k(String(m.tur.yazi).replace(/^tur /, ""))}</tspan>` : "",
    butceDeger ? `<tspan class="mut">BÜTÇE</tspan> <tspan class="${butceSinif}" font-weight="600">${k(butceDeger)}</tspan>` : "",
    m.sonKontrol ? `<tspan class="mut">SON KONTROL</tspan> <tspan class="${skSinif}" font-weight="600">${k(skDeger || "…")}</tspan>` : "",
  ].filter(Boolean).join('<tspan class="mut">     </tspan>');
  const seritSvg = `<text x="${X.ikon}" y="${serit.y + 13}" font-family="${MONO}" font-size="9.5" letter-spacing=".04em" xml:space="preserve" style="white-space:pre">${seritYazi}</text>
    <path d="M0 ${serit.y + 19.5} H${SW}" class="ln" stroke-width="1" fill="none"/>`;

  // ── Brif okları: danışman satırından işçi satırına, brif anında; saç çizgisi + ok ucu ──
  let oklar = "";
  for (const b of m.brifler ?? []) {
    const hy = uyeY.get(b.uye);
    if (hy == null || b.t < tBas) continue;
    const x = tx(b.t);
    oklar += `<path d="M${x} ${danY + DAN / 2 + 5} V${hy - 4}" class="smut" stroke-width="1" fill="none"/><path d="M${x - 3} ${hy - 7} L${x} ${hy - 3} L${x + 3} ${hy - 7}" class="smut" stroke-width="1" fill="none"/>`;
  }

  // ── Satırlar ──
  let satirSvg = "", seriNo = 0, kademeBas = null;
  for (const s of satirlar) {
    if (s.tip === "baslik") {
      satirSvg += `<path d="M0 ${s.y + 0.5} H${SW}" class="ln" stroke-width="1" fill="none"/>
        <text x="${X.ikon}" y="${s.y + 12}" font-size="9.5" letter-spacing=".08em" font-weight="600" class="mut">${k(s.yazi)}</text>
        <text x="${X.d0}" y="${s.y + 12}" font-family="${MONO}" font-size="9" class="mut">${k(kisalt(s.sag ?? "", 30))}</text>`;
      continue;
    }
    const cy = s.y + s.h / 2;
    if (s.tip === "dan") {
      const mesgul = m.danisman.mesgul;
      const olaylar = (m.danisman.olaylar ?? []).filter(o => o.t >= tBas);
      const isaret = olaylar.map(o => { const x = tx(o.t); return `<path d="M${x} ${cy - 4} l4 4 -4 4 -4 -4z" class="smut" fill="none" stroke-width="1.2"><title>${k(o.metin)}</title></path>`; }).join("");
      const simdi = mesgul ? `<path d="M${tx(now)} ${cy - 5} l5 5 -5 5 -5 -5z" class="acc"/>` : "";
      satirSvg += `<g><title>Danışman: ${k(m.danisman.durum)}</title>
        <path d="M${X.ikon + 6} ${cy - 5} l5 5 -5 5 -5 -5z" class="ink"/>
        <text x="${X.ad}" y="${cy + 4}" font-size="11" font-weight="600" class="ink">Danışman</text>
        <path d="M${X.t0} ${cy} H${X.t1}" class="ln" stroke-width="1" fill="none"/>${isaret}${simdi}
        <text x="${X.d0}" y="${cy + 3.5}" font-family="${MONO}" font-size="10" class="${mesgul ? "acc" : "mut"}">${k(kisalt(m.danisman.odak || m.danisman.durum, 26))}</text></g>`;
      continue;
    }
    const band = seriNo++ % 2 ? `<rect x="0" y="${s.y}" width="${SW}" height="${s.h}" class="band" opacity=".55"/>` : "";
    if (s.tip === "diger") {
      const d = s.d, b = d.b ?? now - 30_000;
      const x0 = tx(b);
      satirSvg += `${band}<g><title>${k(`${d.ad}: ${d.gorev}`)}</title>${glif(ikonSec({ ad: d.ad, simdi: d.simdi, durum: "calisiyor" }), X.ikon + 6, cy, "sacc")}
        <text x="${X.ad}" y="${cy + 4}" font-size="11" font-weight="600" class="ink">${k(kisalt(d.ad, 18))}</text>
        <rect x="${x0}" y="${cy - 4}" width="${Math.max(3, tx(now) - x0)}" height="8" rx="1.5" class="acc"/>
        <text x="${X.d0}" y="${cy + 3.5}" font-family="${MONO}" font-size="10" class="ink">${k(kisalt(d.simdi || d.gorev, 21))}</text>
        <text x="${X.d1}" y="${cy + 3.5}" text-anchor="end" font-family="${MONO}" font-size="10" class="acc">${k(d.sure)}</text></g>`;
      continue;
    }
    const u = s.u, bos = u.durum === "bekliyor";
    const sinif = DURUM_SINIF[u.durum] ?? "mut";
    const cubuklar = (u.aralik ?? []).map(a => {
      const sonu = a.e ?? now;
      if (sonu < tBas) return "";
      const x0 = tx(a.b), w = Math.max(3, tx(sonu) - x0);
      const kls = DURUM_SINIF[a.durum] ?? "dn";
      const sol = a.b < tBas ? `<path d="M${X.t0 + 5} ${cy - 3} l-3.5 3 3.5 3" class="${GLIF_SINIF[a.durum] ?? "smut"}" fill="none" stroke-width="1.2"/>` : "";
      return `<rect x="${x0}" y="${cy - 4}" width="${w}" height="8" rx="1.5" class="${kls}" ${a.durum === "iptal" ? 'opacity=".5"' : ""}/>${sol}`;
    }).join("");
    const gorevIpucu = `${u.ad}: ${u.gorev || "görev yok"}${u.ozet ? ` — ${u.ozet}` : ""}`;
    let ayrinti, sag;
    if (u.durum === "calisiyor") { ayrinti = `<text x="${X.d0}" y="${cy + 3.5}" font-family="${MONO}" font-size="10" class="ink">${k(kisalt(u.simdi || "başlıyor…", 21))}</text>`; sag = `<text x="${X.d1}" y="${cy + 3.5}" text-anchor="end" font-family="${MONO}" font-size="10" class="acc">${k(u.sure)}</text>`; }
    else if (u.durum === "bitti") { ayrinti = `<text x="${X.d0}" y="${cy + 3.5}" font-family="${MONO}" font-size="10" class="mut">${k(kisalt(u.ozet || "tamamlandı", 21))}</text>`; sag = `<text x="${X.d1}" y="${cy + 3.5}" text-anchor="end" font-family="${MONO}" font-size="10" class="mut">${k(u.sure)}</text>`; }
    else if (u.durum === "hata" || u.durum === "iptal") { ayrinti = `<text x="${X.d0}" y="${cy + 3.5}" font-family="${MONO}" font-size="10" class="err">${u.durum === "hata" ? "hata ile bitti" : "iptal edildi"}</text>`; sag = `<text x="${X.d1}" y="${cy + 3.5}" text-anchor="end" font-family="${MONO}" font-size="10" class="mut">${k(u.sure)}</text>`; }
    else { ayrinti = `<text x="${X.d0}" y="${cy + 3.5}" font-family="${MONO}" font-size="10" class="mut" opacity=".8">bekliyor</text>`; sag = ""; }
    satirSvg += `${band}<g${bos ? ' opacity=".75"' : ""}><title>${k(gorevIpucu)}</title>${glif(ikonSec(u), X.ikon + 6, cy, GLIF_SINIF[u.durum] ?? "smut")}
      <text x="${X.ad}" y="${cy + 4}" font-size="${bos ? 10.5 : 11}" font-weight="${bos ? 400 : 600}" class="${bos ? "mut" : "ink"}">${k(kisalt(u.ad, 21))}</text>
      ${bos ? `<path d="M${X.t0} ${cy} H${X.t1}" class="ln" stroke-width="1" stroke-dasharray="1 3" fill="none"/>` : cubuklar}${ayrinti}${sag}</g>`;
    void sinif;
  }

  // ── Olay günlüğü: tablo hizalı, saç çizgili ──
  const gunluk = akis.length ? `<g transform="translate(0 ${gunY})">
    <path d="M0 .5 H${SW}" class="ln" stroke-width="1" fill="none"/>
    <text x="${X.ikon}" y="13" font-size="9.5" letter-spacing=".08em" font-weight="600" class="mut">OLAY GÜNLÜĞÜ</text>
    ${akis.map((a, i) => `<g transform="translate(0 ${20 + i * 16})"><path d="M${X.ikon} .5 H${SW - 12}" class="ln" stroke-width="1" opacity=".6" fill="none"/>
      <text x="${X.ikon}" y="12" font-family="${MONO}" font-size="9.5" class="mut">${k(a.z)}</text>
      <text x="${X.ikon + 60}" y="12" font-size="10.5" font-weight="600" class="${i === 0 ? "ink" : "mut"}">${k(kisalt(a.uye, 18))}</text>
      <text x="${X.ikon + 168}" y="12" font-family="${MONO}" font-size="10" class="${i === 0 ? "ink" : "mut"}">${k(kisalt(a.metin, 72))}</text></g>`).join("")}</g>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${H}" viewBox="0 0 ${SW} ${H}" font-family="${FONT}">${STIL}
    ${izgara}${arac}${seritSvg}${kolonBasi}${satirSvg}${oklar}${gunluk}</svg>`;
}
