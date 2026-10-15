// Sade pano: açık, ferah, düz Türkçe cümlelerle. Her ajan tek satır: ikon, ad, ne yaptığı, ilerleme, süre.
// Tasarım: bol boşluk, 12–17 px okunur yazı, yumuşak renkli ikon yuvarlakları, tek vurgu (mavi = çalışıyor),
// yeşil = tamamlandı, kırmızı = hata; tablo, ızgara, monospace ve büyük harf başlık yok.
// Düz resim, animasyon yok; yüzde 5 ve dakika adımıyla yalnız görünen bir şey değişince değişir. Yalnız açık tema (kullanıcının Windows teması açık).

export const SW = 640;
const FONT = "'Segoe UI Variable Text','Segoe UI',system-ui,-apple-system,sans-serif";
const PAD = 16, SATIR = 54;

const STIL = `<style>
  .ink{fill:#1B1F24}.mut{fill:#6B7280}.acc{fill:#2563EB}.ok{fill:#15803D}.err{fill:#DC2626}.warn{fill:#B45309}
  .tacc{fill:rgba(37,99,235,.11)}.tok{fill:rgba(21,128,61,.11)}.terr{fill:rgba(220,38,38,.10)}.tgri{fill:rgba(107,114,128,.12)}.tdan{fill:rgba(37,99,235,.06)}
  .sacc{stroke:#2563EB}.sok{stroke:#15803D}.serr{stroke:#DC2626}.smut{stroke:#6B7280}
  .ln{stroke:rgba(107,114,128,.22)}.trk{fill:rgba(107,114,128,.18)}
</style>`;

export const k = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kisalt = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

// ── İkonlar: 12×12 tek renkli çizgi glifler, yumuşak tonlu yuvarlağın içinde; araca göre değişir ──
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
  "firmware-analist": "cip", "arayuz-gelistirici": "pencere", "model-izci": "kure", "general-purpose": "yildiz", denetmen: "ara",
  "belge-duzen": "belge", envanter: "liste" };
/** Üyenin ikonu: bitti ✓, hata ✕, çalışırken o anki araç, yoksa rolü. */
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

const ARAC_FIIL = [
  [/^(Read|NotebookRead)$/i, "Dosya okuyor"], [/^Grep$/i, "Arıyor"], [/^(Glob|LS)$/i, "Dosyaları listeliyor"],
  [/^(Edit|MultiEdit|NotebookEdit)$/i, "Düzenliyor"], [/^Write$/i, "Dosya yazıyor"], [/^WebFetch$/i, "Sayfa okuyor"],
  [/^WebSearch$/i, "Web'de arıyor"], [/^(Agent|Task)$/i, "Alt ajan çağırıyor"],
];
const sonYol = a => String(a ?? "").split(/[\\/]/).filter(Boolean).slice(-2).join("/");
/** "Read src/app.ts" → "Dosya okuyor · src/app.ts"; "Bash pytest -q" → "Test çalıştırıyor". Okunur Türkçe cümle. */
export function adimCumlesi(simdi) {
  const m = String(simdi ?? "").trim().match(/^([A-Za-z_]+)\s*(.*)$/);
  if (!m) return String(simdi ?? "").trim();
  const [, arac, arg] = m;
  if (/^Bash$/i.test(arac)) {
    if (/\b(test|pytest|vitest|jest|unittest)\b/i.test(arg)) return "Test çalıştırıyor";
    if (/^git\b/i.test(arg)) return `Git · ${kisalt(arg.replace(/^git\s+/i, ""), 28)}`;
    if (/\b(build|make|tsc|compile|cmake|webpack|vite)\b/i.test(arg)) return "Derliyor";
    return `Komut çalıştırıyor · ${kisalt(arg, 30)}`;
  }
  const f = ARAC_FIIL.find(([re]) => re.test(arac));
  if (!f) return String(simdi).trim();
  const hedef = /^(WebFetch|WebSearch)$/i.test(arac) ? arg : sonYol(arg) || arg;
  return hedef ? `${f[1]} · ${kisalt(hedef, 36)}` : f[1];
}

/** Araç sayaçlarından okunur özet: { Read: 9, Grep: 2 } → "9 dosya okudu · 2 arama". Boşsa "". */
const EYLEM_GRUP = [["dosya okudu", /^(Read|NotebookRead)$/i], ["arama", /^(Grep|Glob|LS)$/i], ["düzenleme", /^(Edit|Write|NotebookEdit|MultiEdit)$/i],
  ["komut", /^Bash$/i], ["web sayfası", /^(WebFetch|WebSearch)$/i], ["alt ajan", /^(Agent|Task)$/i]];
export function eylemOzeti(sayac) {
  const parcalar = [];
  for (const [etiket, re] of EYLEM_GRUP) {
    const n = Object.entries(sayac ?? {}).filter(([t]) => re.test(t)).reduce((a, [, v]) => a + v, 0);
    if (n) parcalar.push(`${n} ${etiket}`);
  }
  return parcalar.slice(0, 4).join(" · ");
}

const DURUM_RENK = { calisiyor: ["tacc", "sacc", "acc"], bitti: ["tok", "sok", "ok"], hata: ["terr", "serr", "err"], iptal: ["tgri", "smut", "mut"], bekliyor: ["tgri", "smut", "mut"] };
const ikonDaire = (cx, cy, key, durum, r = 16, nabiz = false) => {
  const [tint, strk] = DURUM_RENK[durum] ?? DURUM_RENK.bekliyor;
  // Çalışan işte yumuşak bir halka dışa doğru yayılıp söner (animasyon yalnız çalışırken; hepsi bitince durur).
  const halo = nabiz ? `<circle cx="${cx}" cy="${cy}" r="${r}" class="tacc"><animate attributeName="r" values="${r};${r + 7}" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0" dur="1.8s" repeatCount="indefinite"/></circle>` : "";
  return `${halo}<circle cx="${cx}" cy="${cy}" r="${r}" class="${tint}"/>
    <g transform="translate(${cx - 6.9} ${cy - 6.9}) scale(1.15)" fill="none" class="${strk}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="${GLIF[key] ?? GLIF.nokta}"/></g>`;
};

/** Dönen çalışma göstergesi (Claude Code'un spinner'ı gibi): yarım daire dönüyor. */
const donen = (cx, cy) => `<g transform="translate(${cx} ${cy})"><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.9s" repeatCount="indefinite"/><circle r="5" fill="none" stroke-width="1.7" class="sacc" stroke-dasharray="15 17" stroke-linecap="round"/></g></g>`;
/** Parıltı: koyu yazının üzerinden vurgu renginde bir ışık bandı soldan sağa süpürür (Claude Code'daki shimmer). */
const PARILTI = `<defs><linearGradient id="parilti" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="220" y2="0" spreadMethod="repeat"><stop offset="0" stop-color="#374151"/><stop offset=".42" stop-color="#374151"/><stop offset=".5" stop-color="#2563EB"/><stop offset=".58" stop-color="#374151"/><stop offset="1" stop-color="#374151"/><animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="220 0" dur="2.4s" repeatCount="indefinite"/></linearGradient></defs>`;
/** Dönen durum kelimeleri: danışman çalışırken 2,2 sn'de bir değişir. */
const KELIMELER = ["Düşünüyor", "Değerlendiriyor", "Planlıyor", "Karar veriyor"];
const kelimeDonguSvg = (x, y) => KELIMELER.map((w, i) =>
  `<text x="${x}" y="${y}" font-size="12.5" font-weight="600" class="acc" opacity="0"><animate attributeName="opacity" calcMode="discrete" dur="${KELIMELER.length * 2.2}s" repeatCount="indefinite" keyTimes="${KELIMELER.map((_, j) => (j / KELIMELER.length).toFixed(3)).join(";")}" values="${KELIMELER.map((_, j) => (j === i ? 1 : 0)).join(";")}"/>${w}</text>`).join("");

/** Yüzde 5'lik, süre dakikalık adım: resim yalnız görünen bir şey değişince değişir. */
export const yuzde5 = p => Math.round(Math.min(1, Math.max(0, p)) * 20) * 5;
export function sureKisa(ms, bitti) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (bitti) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return s < 60 ? "<1 dk" : `${Math.floor(s / 60)} dk`;
}
const kisaModel = ad => String(ad ?? "").split(" ")[0];

/**
 * m: { ekip:{ad,amac}, tur?:{yazi}, butce?:{yazi}, sonKontrol?:{yazi}, sayim, brifler,
 *      danisman:{model,durum,is,odak,mesgul},
 *      kademeler:[{etiket,modelAd,uyeler:[{ad,durum,yuzde,sure,gorev,simdi,ozet}]}],
 *      diger:[{ad,gorev,simdi,sure}], digerFazla, akis:[{z,uye,metin}] }
 */
export function sadeSvg(m) {
  const anim = m.anim !== false;
  // ── Ajan listesi: çalışan → hata → biten; bekleyenler tek satırda toplanır ──
  const uyeler = m.kademeler.flatMap(kd => kd.uyeler.map(u => ({ ...u, model: kisaModel(kd.modelAd) })));
  const SIRA = { calisiyor: 0, hata: 1, iptal: 1, bitti: 2 };
  const satirlar = [
    ...uyeler.filter(u => u.durum !== "bekliyor"),
    ...(m.diger ?? []).slice(0, 5).map(d => ({ ad: d.ad, durum: d.durum ?? "calisiyor", yuzde: 0, sure: d.sure, gorev: d.gorev, simdi: d.simdi, ozet: d.ozet, eylem: d.eylem, model: "ekip dışı", dis: true })),
  ].sort((a, b) => (SIRA[a.durum] ?? 3) - (SIRA[b.durum] ?? 3));
  const bekleyen = uyeler.filter(u => u.durum === "bekliyor").map(u => u.ad);
  const akis = (m.akis ?? []).slice(0, 6);

  // ── Üst başlık ──
  const sy = m.sayim ?? {};
  const parca = [["calisiyor", "çalışıyor", "acc"], ["bitti", "tamamlandı", "ok"], ["hata", "hata", "err"], ["bekliyor", "beklemede", "mut"]].filter(([d]) => sy[d]);
  const sayimYazi = parca.length
    ? parca.map(([d, t, c], i) => `${i ? '<tspan class="mut">  ·  </tspan>' : ""}<tspan class="${c}" font-weight="600">${sy[d]} ${t}</tspan>`).join("")
    : '<tspan class="mut">Şu an iş yok</tspan>';
  const butce = m.butce?.yazi?.replace(/^bütçe /, "");
  const butceSinif = /kritik/.test(butce ?? "") ? "err" : /tasarruf/.test(butce ?? "") ? "warn" : "mut";
  const sk = m.sonKontrol?.yazi?.replace(/^son kontrol ?/, "");
  const skYazi = !m.sonKontrol ? "" : /✓/.test(sk) ? "Son kontrol: onaylandı" : /✕/.test(sk) ? "Son kontrol: reddedildi" : "Son kontrol sürüyor";
  const turYazi = m.tur ? String(m.tur.yazi).replace(/^tur /, "Tur ") : "";
  const baslik = `<text x="${PAD}" y="${PAD + 18}" font-size="17" font-weight="650" class="ink">${k(kisalt(m.ekip.ad, 30))}</text>
    <text x="${PAD}" y="${PAD + 38}" font-size="12.5" xml:space="preserve" style="white-space:pre">${sayimYazi}</text>
    <text x="${SW - PAD}" y="${PAD + 18}" text-anchor="end" font-size="12.5" font-weight="600" class="ink">${k(turYazi)}</text>
    <text x="${SW - PAD}" y="${PAD + 38}" text-anchor="end" font-size="12" class="mut">${butce ? `<tspan class="${butceSinif}">Bütçe ${k(butce)}</tspan>` : ""}${skYazi ? `<tspan>${butce ? "  ·  " : ""}${k(skYazi)}</tspan>` : ""}</text>`;

  // ── Danışman: yumuşak şerit; çalışırken odağı, her zaman son ara rapor ──
  const dy = PAD + 54;
  const mesgul = m.danisman.mesgul;
  const brifSay = (m.brifler ?? []).length;
  const sarma = (t, n, maks) => {
    const satir = []; let l = "";
    for (const w of String(t ?? "").split(/\s+/)) { if ((l + " " + w).trim().length > n && l) { satir.push(l); l = w; } else l = (l + " " + w).trim(); }
    if (l) satir.push(l);
    const kesik = satir.length > maks;
    return satir.slice(0, maks).map((x, i) => (kesik && i === maks - 1 ? kisalt(`${x} …`, n) : x));
  };
  const dSatir = [];
  if (mesgul) dSatir.push({ t: kisalt(m.danisman.odak || m.danisman.durum, 76), c: "ink" });
  if (m.danisman.rapor) for (const t of sarma(`Ara rapor · ${m.danisman.raporZ} — ${m.danisman.rapor}`, 78, mesgul ? 2 : 3)) dSatir.push({ t, c: mesgul ? "mut" : "ink" });
  // İş bittiyse bunu açıkça söyle ("Hazır · bekliyor" işin bitip bitmediğini belirsiz bırakıyordu).
  const isBitti = !mesgul && /^tamamlandı/.test(m.tur?.yazi ?? "");
  if (isBitti) dSatir.unshift({ t: `İş bitti${skYazi ? ` · ${skYazi.replace(/^Son kontrol: /, "son kontrol ")}` : ""}`, c: "ok" });
  if (!dSatir.length) dSatir.push({ t: brifSay ? `Hazır · bu işte ${brifSay} brif verdi` : "Hazır · işleri yönlendirmek için bekliyor", c: "mut" });
  const dh = 36 + dSatir.length * 19;
  const hareketVar = anim && (mesgul || satirlar.some(u => u.durum === "calisiyor"));
  // Danışman çalışırken: dönen gösterge + dönen durum kelimeleri (Düşünüyor → Değerlendiriyor → …)
  const durumSvg = mesgul && anim
    ? `${donen(SW - PAD - 138, dy + 20)}${kelimeDonguSvg(SW - PAD - 124, dy + 24)}`
    : `<text x="${SW - PAD - 14}" y="${dy + 24}" text-anchor="end" font-size="12.5" font-weight="600" class="${mesgul ? "acc" : "ok"}">${mesgul ? "Çalışıyor" : isBitti ? "Bitti" : "Hazır"}</text>`;
  const danisman = `<g><title>Danışman: ${k(m.danisman.durum)}</title>
    <rect x="${PAD}" y="${dy}" width="${SW - 2 * PAD}" height="${dh}" rx="12" class="tdan"/>
    ${ikonDaire(PAD + 26, dy + 29, "yildiz", mesgul ? "calisiyor" : "bitti", 17, anim && mesgul)}
    <text x="${PAD + 54}" y="${dy + 24}" font-size="13.5" font-weight="650" class="ink">Danışman <tspan class="mut" font-weight="400" font-size="12">· ${k(m.danisman.model)}</tspan></text>
    ${dSatir.map((l, i) => `<text x="${PAD + 54}" y="${dy + 43 + i * 19}" font-size="12.5" ${i === 0 && mesgul && anim ? 'fill="url(#parilti)"' : `class="${l.c}"`}>${k(l.t)}</text>`).join("")}
    ${durumSvg}</g>`;

  // ── İş akışı: danışmandan işçilere inen yaylar; çalışan işte yay boyunca akan noktalar (iş bitince durur) ──
  let y = dy + dh + 22;
  let akisSema = "";
  const dugumler = [...satirlar.map(u => ({ ad: u.ad, durum: u.durum, ikon: ikonSec(u) })), ...bekleyen.map(ad => ({ ad, durum: "bekliyor", ikon: ikonSec({ ad, durum: "bekliyor" }) }))].slice(0, 6);
  if (dugumler.length) {
    akisSema = `<text x="${PAD}" y="${y + 4}" font-size="13" font-weight="650" class="ink">İş akışı</text>`;
    const yay = 6 + Math.min(dugumler.length, 6) * 8, cy = y + 16 + yay + 18;
    const x0 = PAD + 22, x1 = SW - PAD - 38, adim = dugumler.length > 1 ? (x1 - (x0 + 96)) / (dugumler.length - 1) : 0;
    akisSema += ikonDaire(x0, cy, "yildiz", mesgul ? "calisiyor" : "bitti", 15, anim && mesgul)
      + `<text x="${x0}" y="${cy + 31}" text-anchor="middle" font-size="11.5" class="mut">Danışman</text>`;
    dugumler.forEach((d, i) => {
      const cx = Math.round(dugumler.length > 1 ? x0 + 96 + i * adim : x0 + 96), yk = cy - 15 - (22 + i * 16); // yayın kontrol noktası: uzak işçi daha yüksek yay
      const yol = `M${x0} ${cy - 15} Q${Math.round((x0 + cx) / 2)} ${yk} ${cx} ${cy - 15}`;
      const [, strk] = DURUM_RENK[d.durum] ?? DURUM_RENK.bekliyor;
      const cizgi = d.durum === "bekliyor" ? ' stroke-dasharray="3 4" stroke-opacity=".7"' : d.durum === "calisiyor" ? ' stroke-opacity=".55"' : ' stroke-opacity=".35"';
      const nokta = anim && d.durum === "calisiyor"
        ? [0, 0.9].map(b => `<circle r="3.2" class="acc"><animateMotion dur="1.8s" begin="${b}s" repeatCount="indefinite" path="${yol}"/></circle>`).join("") : "";
      akisSema += `<path d="${yol}" fill="none" class="${strk}" stroke-width="1.6"${cizgi}/>${nokta}`
        + ikonDaire(cx, cy, d.ikon, d.durum, 15, anim && d.durum === "calisiyor")
        + `<text x="${cx}" y="${cy + 31}" text-anchor="middle" font-size="11.5" class="${d.durum === "bekliyor" ? "mut" : "ink"}">${k(kisalt(d.ad, 14))}</text>`;
    });
    y = cy + 44;
  }

  // ── Ajanlar ──
  y += 14;
  let govde = `<text x="${PAD}" y="${y}" font-size="13" font-weight="650" class="ink">Ajanlar</text>`;
  y += 10;
  for (const u of satirlar) {
    const SH = u.eylem ? SATIR + 14 : SATIR;
    const cy = y + SATIR / 2;
    const bitti = u.durum === "bitti", hata = u.durum === "hata" || u.durum === "iptal", calisiyor = u.durum === "calisiyor";
    const ikon = ikonSec(u);
    const cumle = calisiyor ? (u.simdi ? adimCumlesi(u.simdi) : "Başlıyor…")
      : bitti ? (u.ozet || "Tamamlandı") : u.durum === "hata" ? "Hata ile sona erdi" : "İptal edildi";
    const durumYazi = calisiyor ? (u.dis ? u.sure : `%${u.yuzde} · ${u.sure}`) : bitti ? `Tamamlandı · ${u.sure}` : hata ? (u.durum === "hata" ? "Hata" : "İptal") : "";
    const durumSinif = calisiyor ? "acc" : bitti ? "ok" : hata && u.durum === "hata" ? "err" : "mut";
    const bx = SW - PAD - 80, dolu = Math.max(4, Math.round(80 * u.yuzde / 100));
    // Çalışırken: ilerleme çubuğunda kayan ışık; yüzdesi bilinmeyen (ekip dışı) işte gidip gelen belirsiz çubuk.
    const cubuk = !calisiyor ? "" : u.dis
      ? `<rect x="${bx}" y="${cy + 8}" width="80" height="4" rx="2" class="trk"/>${anim ? `<rect x="${bx}" y="${cy + 8}" width="28" height="4" rx="2" class="acc"><animate attributeName="x" values="${bx};${bx + 52};${bx}" dur="1.8s" repeatCount="indefinite"/></rect>` : ""}`
      : `<rect x="${bx}" y="${cy + 8}" width="80" height="4" rx="2" class="trk"/><rect x="${bx}" y="${cy + 8}" width="${dolu}" height="4" rx="2" class="acc"/>${anim && dolu > 30 ? `<rect x="${bx}" y="${cy + 8}" width="22" height="4" rx="2" fill="#FFFFFF" fill-opacity=".55"><animate attributeName="x" values="${bx};${bx + dolu - 22};${bx}" dur="1.6s" repeatCount="indefinite"/></rect>` : ""}`;
    govde += `<g><title>${k(`${u.ad}: ${u.gorev || ""}`)}</title>
      ${ikonDaire(PAD + 18, cy, ikon, u.durum, 16, anim && calisiyor)}
      <text x="${PAD + 46}" y="${cy - 3}" font-size="13.5" font-weight="650" class="ink">${k(kisalt(u.ad, 24))} <tspan class="mut" font-weight="400" font-size="12">${k(u.model ?? "")}</tspan></text>
      <text x="${PAD + 46}" y="${cy + 15}" font-size="12.5" ${calisiyor && anim ? 'fill="url(#parilti)"' : `class="${calisiyor ? "ink" : "mut"}"`}>${k(kisalt(cumle, bitti ? 66 : 50))}</text>
      <text x="${SW - PAD}" y="${cy - 3}" text-anchor="end" font-size="12.5" font-weight="600" class="${durumSinif}">${k(durumYazi)}</text>${calisiyor && anim ? donen(Math.round(SW - PAD - durumYazi.length * 6.9 - 13), cy - 7) : ""}${cubuk}
      ${u.eylem ? `<text x="${PAD + 46}" y="${cy + 32}" font-size="11.5" class="mut">${k(kisalt(u.eylem, 70))}</text>` : ""}
      <path d="M${PAD + 46} ${y + SH + 0.5} H${SW - PAD}" class="ln" stroke-width="1" fill="none"/></g>`;
    y += SH;
  }
  if (!satirlar.length) { govde += `<text x="${PAD}" y="${y + 24}" font-size="12.5" class="mut">Henüz çalışan ajan yok. /ekip kur … ile ekip bir iş alınca burada görünür.</text>`; y += 40; }
  if (bekleyen.length) {
    govde += `<text x="${PAD}" y="${y + 24}" font-size="12.5" class="mut">Beklemede (${bekleyen.length}): ${k(kisalt(bekleyen.join(", "), 78))}</text>`;
    y += 36;
  }

  // ── Son olaylar: saat + cümle, tablo yok ──
  let olaylar = "";
  if (akis.length) {
    y += 14;
    olaylar = `<text x="${PAD}" y="${y}" font-size="13" font-weight="650" class="ink">Son olaylar</text>`;
    y += 10;
    for (const a of akis) {
      const cumle = /^[A-Za-z_]+\s/.test(a.metin) || /^(Read|Grep|Glob|Edit|Write|Bash|WebFetch|WebSearch|Agent|Task)$/i.test(a.metin) ? adimCumlesi(a.metin) : a.metin;
      olaylar += `<g><text x="${PAD}" y="${y + 19}" font-size="11.5" class="mut">${k(a.z)}</text>
        <text x="${PAD + 64}" y="${y + 19}" font-size="12.5" class="ink"><tspan font-weight="600">${k(kisalt(a.uye === "danisman" ? "Danışman" : a.uye, 20))}</tspan> <tspan class="mut">${k(kisalt(cumle, 62))}</tspan></text></g>`;
      y += 27;
    }
  }
  const H = y + 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${H}" viewBox="0 0 ${SW} ${H}" font-family="${FONT}">${STIL}${hareketVar ? PARILTI : ""}
    ${baslik}${danisman}${akisSema}${govde}${olaylar}</svg>`;
}
