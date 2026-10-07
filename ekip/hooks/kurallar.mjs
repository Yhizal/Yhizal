// Ekip kuralları v2 — hiyerarşi, model atama, yoğun iş, rapor, ara brif.
// Metni danışman (Fable) kullanıcının isteğinden yorumlayıp zenginleştirdi (7 Eki 2026);
// bu dosya o metni ve ona bağlı saf hesapları taşır, ekip.mjs bağlar.

export const UZMAN_MODEL = "opus";   // know-how gerektiren çekirdek iş
export const HIZLI_MODEL = "sonnet"; // tarifi net, hızlı biten iş (takma ad en güncel Sonnet'e çözülür)

export const ESIK = {
  YOGUN_ISCI: 3, YOGUN_TUR: 2, YOGUN_DOSYA: 5, YOGUN_SURE_DK: 8,
  SURE_CARPANI: 1.5, ADIM_ESIGI: 40,
  BRIF_MAX_UYE: 3,       // üye başına tur içi en fazla brif
  BRIF_MAX_TUR: 6,       // tur başına en fazla brif çağrısı (token koruması)
  BRIF_MIN_SURE_SN: 120, // bu süreden kısa çalışan üyeye T2 dışında brif yok
  YENIDEN_ATA_MAX: 1,    // üye başına tur içi
  IZLEME_MS: 60_000,
};

export const KURALLAR = `# EKİP KURALLARI v2

## 1. Hiyerarşi
| Kademe | Model | Sorumluluk | Yetki sınırı |
|---|---|---|---|
| Danışman | Fable (high) | Hedefi parçalar, ekibi kurar, model atar, ara brif verir, tur sonu değerlendirir, raporu yazar | Yalnız okur; kod yazmaz; üyeye tur içinde en fazla 3 brif |
| Uzman | Opus | Know-how gerektiren çekirdek iş: tasarım kararı, kök neden, HAL/kesme/DMA/zamanlama, ThingsBoard rule-chain, FastAPI+React mimari değişikliği | Kendi dosya kümesi dışına çıkmaz; görev dışı iyileştirme yapmaz |
| Hızlı | Sonnet | Tarifi net, doğrulaması belli, yaratıcı karar gerektirmeyen iş | Mimari/algoritma değiştirmez; kararsız kalınca durur, "KARAR GEREKİR: ..." ile biter |
Zincir: Kullanıcı → Danışman → (Uzman | Hızlı). İşçiler birbirine mesaj atmaz; koordinasyon yalnız Danışman üzerinden. Kullanıcıya soru ancak tüm ekip bloke olunca, tek net soru olarak gider.

## 2. Model atama
Sonnet'e ver (hepsi sağlanmalı): (a) iş tek paragrafla eksiksiz tarif edilebiliyor, (b) doğrulama komutu/ölçütü belli, (c) ≤3 dosya, ≤~150 satır değişiklik, (d) alan bilgisi gerekmiyor.
Sonnet örnekleri: mevcut test şablonuna case eklemek; README/Doxygen; lint/format; verilen regex ile log tarama; mevcut desenle API alanı/React tablo sütunu eklemek; git diff özetini tabloya dökmek; ThingsBoard widget etiket/birim değişikliği.
Opus örnekleri: HAL kesme/DMA/zamanlama hatası; Altium kural/footprint değerlendirmesi; rule-chain tasarımı; FastAPI yetki/şema değişikliği; React state mimarisi; kök nedeni bulunmamış her hata; performans; güvenlik.
Sınır: iki ölçüt tereddütlüyse Opus. Sonnet "KARAR GEREKİR" ile dönerse o parça Opus'a yeniden atanır, bir daha Sonnet'e verilmez.
Bölme: büyük iş = 1 çekirdek (Opus) + N hızlı (Sonnet). Hızlı iş çekirdeğin çıktısına bağlıysa "bagimli" ile çekirdeği bekler; bağımsızsa paralel. Aynı dosya iki üyeye verilmez; kaçınılmazsa dosya tek üyede, öbürü salt okur. Kod-inceleyici daima değişikliği yazandan farklı üyedir.

## 3. Yoğun iş
Yoğun = şunlardan ≥2'si: ≥3 işçi; ≥2 tur planlanıyor; ≥5 dosya değişecek; ≥2 alan birden (firmware+web, backend+UI); bir Opus görevinin beklenen süresi >8 dk; alternatifler arasında seçim var.
Basit = 1-2 işçi, 1 tur, ≤4 dosya: tablo yok, ara brif yok, rapor ≤5 satır.
Planlama anında "yogunluk" yazılır; tur içinde yoğuna yükseltilebilir, düşürülemez.

## 4. Rapor
Yoğun iş raporu (Danışman, ≤40 satır, girizgâh yok): 1) **Sonuç** 1-2 cümle: ne bitti, ne bitmedi. 2) **Üye tablosu** (telemetriden otomatik eklenir). 3) **Karşılaştırma tablosu** | Ölçüt | Önce / Seçenek A | Sonra / Seçenek B | Fark | Seçim | — seçenek/ölçüm yoksa "karşılaştırma yok". 4) **Bulgular** en fazla 5 madde, önem sırasıyla, dosya:satır ile. 5) **Açık uçlar / Sonraki tur** en fazla 3 madde ya da "yok".
İşçi çıktısı (yoğun işte, ≤15 satır): ilk satır "ÖZET: <tek cümle>"; sonra | Dosya | Değişiklik | Doğrulama | Sonuç | tablosu; sonda varsa "KARAR GEREKİR:" ya da "ENGEL:".
Basit iş: ≤5 satır düz metin; değişen dosyalar ve doğrulama sonucu.
Sayılar işçi çıktılarından ve telemetriden alınır; Danışman tahmin etmez, emin olmadığı hücreye "?" yazar.

## 5. Ara brif (yalnız yoğun işte)
Tetikleyiciler: T1 bir işçi bitti, diğerleri sürüyor (çıktısı sürenleri etkiliyorsa); T2 işçi beklenen sürenin 1.5 katını ya da 40 adımı aştı; T3 çıktıda "KARAR GEREKİR"/"ENGEL"; T4 iki işçi aynı dosyaya dokunuyor.
Brif ≤6 satır: neden, yeni/değişen hedef, dokunulmayacak dosyalar, bitiş ölçütü; önceki brifi tekrar etmez.
Eylem ölçeği: yön düzelt → durdur (T2 ikinci kez ya da çıktı hedefle alakasız) → yeniden ata (durdurulan parça Opus'a, kapsam daraltılarak). Üye tur içinde en fazla 1 kez yeniden atanır; ikinci başarısızlık son rapora açık uç olarak yazılır.
Tasarruf: tetikleyici yoksa brif yok; "nasıl gidiyor" mesajı yasak; üye başına tur içinde en fazla 3 brif; 2 dakikadan kısa çalışan üyeye T2 dışında brif yok.

## 6. Genel
- Diff disiplini: dosyanın tamamı yeniden yazılmaz; görev tanımında "yalnız şu fonksiyon/blok" belirtilir.
- Her görev doğrulanabilir: "bitis_olcutu" boş olamaz (test komutu, derleme, grep sonucu, ekran metni).
- Token: işçiye tam dosya yolu ve ilgili satır aralığı verilir; "projeyi keşfet" denmez.
- Kullanıcıya müdahale gerektirmez: belirsizlikte en güvenli (geri alınabilir) seçenek uygulanır ve raporda yazılır.
- Her tur sonunda "devam/bitir" kararı tek satır gerekçeyle yazılır; 3 tur sınırı aşılmaz.
- Üretim ortamı (push prod, deploy, veritabanı yazma) hiçbir işçiye verilmez; raporda "önerilen komut" olarak yazılır.

## 7. Kota bütçesi ve son kontrol
Danışman her planda, tur değerlendirmesinde ve brifte kalan 5 saatlik hakkı ve haftalık tüketim temposunu (bu hızla dönem sonu tahmini) görür ve ekibin gücünü, hızını, verimini buna göre ayarlar:
| Bütçe | Ne zaman | Ekip ayarı |
|---|---|---|
| bol | 5 saat <%30 ve haftalık tempo rahat | Kurallara göre serbest; gerekiyorsa Opus ağırlıklı, 3 tur |
| normal | arada | Kurallara göre; en fazla 5 işçi, 3 tur |
| tasarruf | 5 saat ≥%70, haftalık ≥%75 ya da bu hızla dönem sonu >%100 | En fazla 3 işçi, 2 tur; Opus yalnız tek çekirdek işte, gerisi Sonnet; brif az ve öz |
| kritik | 5 saat ≥%90, haftalık ≥%90 ya da 5 saatlik hak sıfırlanmadan biter | En fazla 2 işçi, 1 tur; yalnız Sonnet; ara brif yok; işi küçült, kalanı açık uç yaz |
Bütçe kodla da uygulanır: sınırı aşan üye ve Opus ataması planda kırpılır. Danışmanın kendisi her bütçede Fable'dır.
Son kontrol her zaman danışmandadır: ekipte iş bitince (otomatik turda da, elle ya da ana oturumun verdiği işte de) danışman çıktıları dosyalardan doğrular — bitiş ölçütü sağlandı mı, diff disiplini, risk — ve "KARAR: ONAY" ya da "KARAR: RET — <neden>" ile bitirir. Kritik bütçede son kontrol hafiftir (yalnız çıktılar üzerinden).`;

export const ISCI_FORMAT = `Çıktı biçimi: görev "[YOĞUN]" ile başlıyorsa en fazla 15 satır — ilk satır "ÖZET: <tek cümle>"; sonra | Dosya | Değişiklik | Doğrulama | Sonuç | tablosu (test/ölçüm yaptıysan önce/sonra sayıları); takıldıysan son satır "KARAR GEREKİR: ..." ya da "ENGEL: ...". Etiket yoksa en fazla 5 satır düz metin: değişen dosyalar ve doğrulama sonucu. Tahmin etme; emin olmadığını yaz. Görev sırasında "BRİF" başlıklı mesaj gelirse yönünü ona göre düzelt; "DUR" gelirse işi bırak ve o ana kadarını bu biçimde özetle.`;
export const KADEME_EK = {
  [UZMAN_MODEL]: "Uzman kademedesin (Opus): know-how gerektiren çekirdek işi yürüt; kendi dosya kümen dışına çıkma, görev dışı iyileştirme yapma.",
  [HIZLI_MODEL]: "Hızlı kademedesin (Sonnet): tarif edileni yap; mimari/algoritma değiştirme, görev dışına çıkma; kararsız kalırsan dur ve \"KARAR GEREKİR: ...\" ile bitir.",
};

/** Danışmanın yazdığı model/kademe adını takma ada çevirir; tanınmayan → Opus (sınır kuralı). */
export function modelSec(m) {
  const t = String(m ?? "").toLowerCase();
  return /sonnet|h[ıi]zl[ıi]/.test(t) ? HIZLI_MODEL : UZMAN_MODEL;
}
export const kademe = model => (String(model ?? "").includes("sonnet") ? "hızlı" : String(model ?? "").includes("fable") ? "danışman" : "uzman");

/** Aynı dosyayı iki üyeye veren atamalar: [{ a, b, dosya }]. */
export function dosyaCakismalari(uyeler) {
  const sahip = new Map(), cakisma = [];
  for (const u of uyeler) for (const d of u.dosyalar ?? []) {
    const k = String(d).replace(/\\/g, "/").toLowerCase();
    if (sahip.has(k) && sahip.get(k) !== u.name) cakisma.push({ a: sahip.get(k), b: u.name, dosya: d });
    else sahip.set(k, u.name);
  }
  return cakisma;
}

/** Yoğun mu: danışman "yogun" dediyse ya da ölçülebilir eşiklerden en az ikisi tuttuysa. */
export function yogunMu({ yogunluk, uyeSayisi = 0, dosyaSayisi = 0, maxSureDk = 0, turPlani = 1 } = {}) {
  if (yogunluk === "yogun") return true;
  const n = [uyeSayisi >= ESIK.YOGUN_ISCI, dosyaSayisi >= ESIK.YOGUN_DOSYA, maxSureDk > ESIK.YOGUN_SURE_DK, turPlani >= ESIK.YOGUN_TUR].filter(Boolean).length;
  return n >= 2;
}

/** İşçi çıktısındaki bayrak: "KARAR GEREKİR" | "ENGEL" | null. */
export function bayrak(cikti) {
  const t = String(cikti ?? "");
  return /KARAR GEREK[İI]R\s*:/i.test(t) ? "KARAR GEREKİR" : /(^|\n)\s*ENGEL\s*:/i.test(t) ? "ENGEL" : null;
}

/** Süren bir koşu için periyodik T2 denetimi: tetikleyici "T2" ya da null. */
export function t2Mi(kosu, { now = Date.now(), brifSayisi = 0, t2Gitti = false } = {}) {
  if (kosu?.durum !== "calisiyor" || t2Gitti || brifSayisi >= ESIK.BRIF_MAX_UYE) return null;
  const gecenSn = (now - kosu.baslangic) / 1000;
  const sureAsti = kosu.beklenenDk > 0 && gecenSn > kosu.beklenenDk * 60 * ESIK.SURE_CARPANI;
  return (kosu.adim ?? 0) > ESIK.ADIM_ESIGI || sureAsti ? "T2" : null;
}

/** Brif gönderilebilir mi (üye sınırı, en kısa süre; T2 süreden muaf). */
export function brifIzinli(kosu, tetik, { now = Date.now(), brifSayisi = 0 } = {}) {
  if (!kosu || kosu.durum !== "calisiyor" || brifSayisi >= ESIK.BRIF_MAX_UYE) return false;
  return tetik === "T2" || (now - kosu.baslangic) / 1000 >= ESIK.BRIF_MIN_SURE_SN;
}

const sn = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const hucre = s => String(s ?? "?").replace(/\|/g, "/").replace(/\s+/g, " ").trim().slice(0, 48) || "?";

/** Üye tablosu (telemetriden): | Üye | Kademe | Görev | Durum | Adım | Süre | Brif | */
export function uyeTablosu(kosular, brifler = []) {
  if (!kosular.length) return "";
  const say = u => brifler.filter(b => b.uye === u).length;
  const satir = k => {
    const uye = String(k.tip).replace(/^ekip:/, "");
    return `| ${uye} | ${kademe(k.model)} | ${hucre(k.aciklama)} | ${k.durum}${bayrak(k.cikti) ? ` ⚑${bayrak(k.cikti)}` : ""} | ${k.adim ?? "?"} | ${sn((k.bitis ?? Date.now()) - k.baslangic)} | ${say(uye)} |`;
  };
  return ["| Üye | Kademe | Görev | Durum | Adım | Süre | Brif |", "|---|---|---|---|---|---|---|", ...kosular.map(satir)].join("\n");
}

/** Danışmanın brif JSON'unu doğrular: hedef koşan bir üye olmalı, eylem tanınmalı. */
export function brifDogrula(j, kosanUyeler) {
  if (!j || j.brif === false) return null;
  const uye = String(j.hedef_uye ?? "").trim();
  const eylem = ["yon", "durdur", "yeniden_ata"].includes(j.eylem) ? j.eylem : "yon";
  if (!kosanUyeler.includes(uye) || !(j.neden || j.yeni_hedef)) return null;
  return {
    uye, eylem, tetik: String(j.tetikleyici ?? ""),
    neden: String(j.neden ?? "").slice(0, 300), hedef: String(j.yeni_hedef ?? "").slice(0, 400),
    dokunma: Array.isArray(j.dokunma) ? j.dokunma.map(String).slice(0, 8) : [],
    bitis: String(j.bitis_olcutu ?? "").slice(0, 200),
    ...(eylem === "yeniden_ata" ? { yeniModel: modelSec(j.yeni_model ?? UZMAN_MODEL), yeniGorev: String(j.yeni_gorev ?? j.yeni_hedef ?? "").slice(0, 1500) } : {}),
  };
}

// ── Kota bütçesi (§7): 5 saatlik ve haftalık pencereden seviye; seviyeye göre ekip ayarı ──
const PENCERE = { five_hour: 5 * 3_600_000, seven_day: 7 * 86_400_000 };
export const BUTCE_AYAR = {
  bol: { maxUye: 5, maxTur: 3, opusMax: 5, brifMaxTur: 6, sonKontrol: "tam" },
  normal: { maxUye: 5, maxTur: 3, opusMax: 5, brifMaxTur: 6, sonKontrol: "tam" },
  tasarruf: { maxUye: 3, maxTur: 2, opusMax: 1, brifMaxTur: 3, sonKontrol: "tam" },
  kritik: { maxUye: 2, maxTur: 1, opusMax: 0, brifMaxTur: 0, sonKontrol: "hafif" },
};
const sureYaz = ms => { const m = Math.max(0, Math.round(ms / 60_000)); return m >= 1440 ? `${Math.floor(m / 1440)}g ${Math.floor((m % 1440) / 60)}sa` : m >= 60 ? `${Math.floor(m / 60)}sa ${m % 60}dk` : `${m}dk`; };
/** Pencere: kullanım, kalan süre ve bu hızla dönem sonu tahmini (geçen < %5 iken tahmin yok). */
export function pencere(lim, now = Date.now()) {
  const w = PENCERE[lim?.kind];
  if (!w) return null;
  const kalan = lim.resetsAt ? Date.parse(lim.resetsAt) - now : NaN;
  const gecen = Number.isFinite(kalan) ? Math.min(1, Math.max(0, 1 - kalan / w)) : null;
  const sonu = gecen != null && gecen > 0.05 ? Math.round(lim.percentUsed / gecen) : null;
  // Bu hızla dönem sonu %105'i geçiyorsa hak sıfırlanmadan biter (%5 pay: sınırda yuvarlama dalgalanmasın).
  return { yuzde: lim.percentUsed, kalanMs: Number.isFinite(kalan) ? Math.max(0, kalan) : null, sonu, sifirlanmadanBiter: sonu != null && sonu > 105 };
}
/** Bütçe seviyesi ve danışmana giden tek satırlık özet. Kota bilgisi yoksa (API anahtarı) normal. */
export function butce(limits, now = Date.now()) {
  const p5 = pencere((limits ?? []).find(l => l.kind === "five_hour"), now);
  const p7 = pencere((limits ?? []).find(l => l.kind === "seven_day"), now);
  if (!p5 && !p7) return { seviye: "normal", ozet: "kota bilgisi yok (abonelik dışı) — normal bütçe", ayar: BUTCE_AYAR.normal };
  const seviye =
    (p5 && (p5.yuzde >= 90 || p5.sifirlanmadanBiter)) || (p7 && p7.yuzde >= 90) ? "kritik"
    : (p5 && p5.yuzde >= 70) || (p7 && (p7.yuzde >= 75 || (p7.sonu ?? 0) > 100)) ? "tasarruf"
    : (!p5 || p5.yuzde < 30) && (!p7 || (p7.sonu ?? p7.yuzde) < 70) ? "bol"
    : "normal";
  const yaz = (ad, p) => !p ? null : `${ad} %${Math.round(p.yuzde)}${p.kalanMs != null ? ` (sıfırlanma ${sureYaz(p.kalanMs)}` : " ("}${p.sonu != null ? `, bu hızla dönem sonu ~%${p.sonu}` : ""})`;
  return { seviye, ozet: [yaz("5 saat", p5), yaz("haftalık", p7)].filter(Boolean).join(" · "), ayar: BUTCE_AYAR[seviye] };
}
/** Bütçeyi plana uygular: fazla üye atılır, Opus sınırı aşan atamalar Sonnet'e iner (ilk Opus çekirdek kalır). */
export function butceUygula(uyeler, ayar) {
  let opus = 0;
  return uyeler.slice(0, ayar.maxUye).map(u => {
    if (u.model !== UZMAN_MODEL) return u;
    if (opus < ayar.opusMax) { opus++; return u; }
    return { ...u, model: HIZLI_MODEL, inen: true };
  });
}

/** İşçiye giden brif metni (≤6 satır). */
export function brifMetni(no, b) {
  return [
    `${b.eylem === "durdur" || b.eylem === "yeniden_ata" ? "DUR — " : ""}BRİF #${no} → ${b.uye}`,
    `Neden: ${b.neden}`,
    ...(b.eylem === "yon" && b.hedef ? [`Yeni hedef: ${b.hedef}`] : []),
    ...(b.dokunma.length ? [`Dokunma: ${b.dokunma.join(", ")}`] : []),
    ...(b.eylem === "yon" && b.bitis ? [`Bitiş ölçütü: ${b.bitis}`] : []),
    ...(b.eylem !== "yon" ? ["İşi bırak; o ana kadarını ÖZET biçiminde bildir. Kalan parça başka üyeye atanıyor."] : []),
  ].join("\n");
}
