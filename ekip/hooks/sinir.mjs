// Proje sınırı: ekip hangi projede çalıştığını ve nereye dokunamayacağını bilerek başlar; ajanların komutları çalışmadan
// önce denetlenir. Çıkış noktası 25.11.2026 TankSCADA olayı: "kuru çalıştırma" üyesi görevde adı geçmeyen bir veri betiğini
// (seed_plc_labels.py) çalıştırdı; betiğin varsayılan adresi başka projenin (ILB) yerel veritabanıydı (5433).
// Hepsi saf işlev: dosya okuma ve kanca bağlama ekip.mjs'te.

/** Proje kartı dosyası (proje kökünde). Kullanıcı düzenler; ekip yalnız okur. */
export const KART_DOSYA = ".claude/ekip-proje.json";

/** İşçi ve danışman talimatına giren sınır kuralları. */
export const SINIR_KURALLARI = `PROJE SINIRI (bağlayıcı; ihlal eden komut çalıştırılmadan reddedilir):
1. Yalnız PROJE KARTI'ndaki projede çalış. İşe başlamadan kök dizini ve dalı doğrula; başka projenin dosyasına, veritabanına, konteynerine, kapısına (port) dokunma.
2. Betik/komut çalıştırmadan önce OKU: görevde adı geçen betik mi (tam dosya adı), nereye bağlanıyor (varsayılan adres/kapı), yazıyor mu. Varsayılanı başka bir sisteme gidiyorsa çalıştırma; bağlantıyı açıkça ver (--db/--url/--host) ya da SINIR diye raporla.
3. Veri betikleri (seed, migrate, import, sync, load, restore, reset, apply, backfill…) yalnız görevde TAM ADIYLA yazıyorsa çalışır. Benzer adlı başka betiği "herhalde bu" diye çalıştırma.
4. Önce kuru çalıştırma. Yazma bayrakları (--apply, --commit, --force, --yes) yalnız görev açıkça istiyorsa.
5. Yayın ve uzak sistem (deploy, ssh, git push, prod compose) ekip ajanının işi değildir; görevde açıkça yazmıyorsa yapma, ana oturuma bırak.
6. Yıkıcı işlem (rm -rf, DROP/TRUNCATE, git reset --hard, volume silme) yapma.
7. Bir komut sınır nedeniyle reddedilirse başka yoldan deneme. "SINIR: <ne gerekiyordu, neden>" satırıyla raporla; o adımı YAPILMADI say.
8. Çalıştırdığın her veritabanı/ağ/servis komutunu raporda "ÇALIŞTIRILDI: <komut> → <nereye bağlandı, ne döndü>" diye yaz; bağlantının kurulup kurulmadığını bilmiyorsan öyle yaz.`;

const norm = s => String(s ?? "").replace(/\\/g, "/").replace(/\/+/g, "/").toLowerCase();
const liste = x => (Array.isArray(x) ? x.map(String).map(s => s.trim()).filter(Boolean).slice(0, 40) : []);

/** Kart JSON'unu doğrular ve tamamlar (saf). Geçersizse kökü bilinen boş kart. */
export function kartDogrula(j, kok) {
  const k = j && typeof j === "object" ? j : {};
  return {
    ad: String(k.ad ?? "").trim() || String(kok ?? "").replace(/\\/g, "/").split("/").filter(Boolean).pop() || "bilinmeyen proje",
    kok: String(k.kok ?? kok ?? "").trim(),
    amac: String(k.amac ?? "").slice(0, 300),
    yasak: { uclar: liste(k.yasak?.uclar), dizinler: liste(k.yasak?.dizinler), komutlar: liste(k.yasak?.komutlar) },
    izinli: { uclar: liste(k.izinli?.uclar), disDizinler: liste(k.izinli?.disDizinler) },
    notlar: liste(k.notlar).map(s => s.slice(0, 300)),
    tanimli: Boolean(j && typeof j === "object"),
  };
}

/** Kartın Fable'a ve işçilere giden metni (saf). */
export function kartMetni(kart) {
  if (!kart) return "PROJE KARTI: proje belirlenemedi. İşe başlamadan hangi projede olduğunu doğrula (kök dizin, git dalı); emin değilsen veri/servis komutu çalıştırma.";
  const s = [`PROJE KARTI — ${kart.ad}`, `Kök: ${kart.kok || "?"}`];
  if (kart.amac) s.push(`Amaç: ${kart.amac}`);
  if (kart.izinli.uclar.length) s.push(`Bu projenin uçları (yalnız bunlara bağlan): ${kart.izinli.uclar.join(", ")}`);
  if (kart.yasak.uclar.length) s.push(`YASAK uçlar (başka sistemler): ${kart.yasak.uclar.join(", ")}`);
  if (kart.yasak.dizinler.length) s.push(`YASAK dizinler: ${kart.yasak.dizinler.join(", ")}`);
  if (kart.yasak.komutlar.length) s.push(`YASAK komutlar: ${kart.yasak.komutlar.join(", ")}`);
  for (const n of kart.notlar) s.push(`Not: ${n}`);
  if (!kart.tanimli) s.push(`(Bu proje için ${KART_DOSYA} yok: yalnız genel sınır kuralları geçerli.)`);
  return s.join("\n");
}

const VERI_BETIGI = /(seed|migrat|import|sync|load|restore|reset|drop|truncate|purge|apply|backfill|bootstrap|init_db|initdb)/i;
const BETIK_UZANTI = /\.(py|sh|ps1|bat|cmd|js|mjs|sql)$/i;
const YORUMLAYICI = /^(.*[\\/])?(python[\d.]*|py|node|bash|sh|zsh|pwsh|powershell|psql|sqlcmd)(\.exe)?$/i;
const tabanAd = y => String(y).replace(/\\/g, "/").split("/").pop().replace(/\.[a-z0-9]+$/i, "");
const parcala = k => String(k ?? "").split(/&&|\|\||[;|\n]/).map(s => s.trim()).filter(Boolean);
const sozcukler = s => (s.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(t => t.replace(/^["']|["']$/g, ""));
/**
 * Komutun ÇALIŞTIRDIĞI betikler (saf): [{ yol, ad }]. Yalnız yürütülenler sayılır — `python x.py`, `python -m paket.modul`,
 * `bash x.sh`, `./x.sh`, `x.bat`, `psql -f x.sql`, `docker compose exec backend python -m scripts.x`. Betik adının yalnız
 * geçtiği komutlar (git add, cat, grep, pytest tests/test_x.py) sayılmaz.
 */
export function betikler(komut) {
  const out = [];
  for (const seg of parcala(komut)) {
    const ts = sozcukler(seg);
    const ilk = ts[0] === "&" || ts[0] === "call" ? ts[1] : ts[0];
    if (ilk && BETIK_UZANTI.test(ilk) && !YORUMLAYICI.test(ilk)) out.push({ yol: ilk, ad: tabanAd(ilk) });
    for (let i = 0; i < ts.length; i++) {
      if (!YORUMLAYICI.test(ts[i])) continue;
      for (let j = i + 1; j < ts.length; j++) {
        const t = ts[j];
        if (t === "-c" || t === "-Command" || t === "-e") break;                       // satır içi kod: betik dosyası yok
        if (t === "-m" && ts[j + 1]) { if (!/^(pytest|pip|venv|unittest|http\.server|ensurepip)$/.test(ts[j + 1])) out.push({ yol: `${ts[j + 1].replace(/\./g, "/")}.py`, ad: ts[j + 1].split(".").pop() }); break; }
        if ((t === "-f" || t === "-File" || t === "-i") && ts[j + 1]) { out.push({ yol: ts[j + 1], ad: tabanAd(ts[j + 1]) }); break; }
        if (t.startsWith("-")) continue;
        if (BETIK_UZANTI.test(t)) out.push({ yol: t, ad: tabanAd(t) });
        break;
      }
    }
  }
  return out.filter((b, i, a) => !/^(test_|conftest)/i.test(b.ad) && a.findIndex(x => x.yol === b.yol) === i).slice(0, 6);
}
/** Uç (kapı/adres) metinde geçiyor mu: "5433" → 15433 ya da 54330 ile eşleşmez (saf). */
export const ucGeciyor = (metin, uc) => new RegExp(`(?<![\\d.])${String(uc).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d])`, "i").test(String(metin ?? ""));

const YIKICI = /\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|[a-z]:|\.\.)|Remove-Item\b[^\n|;]*-Recurse|\bDROP\s+(TABLE|DATABASE|SCHEMA)\b|\bTRUNCATE\s+|git\s+reset\s+--hard|git\s+clean\s+-[a-z]*f|git\s+push\b[^\n|;]*--force|docker\s+volume\s+(rm|prune)|docker\s+system\s+prune|compose\b[^\n|;]*\bdown\b[^\n|;]*\s-v\b/i;
const YAYIN = /\bssh(\.exe)?\s|\bscp\s|\brsync\s[^\n|;]*:|git\s+push\b|compose\b[^\n|;]*prod[^\n|;]*\b(up|build|run|down|restart)\b/i;
const YAYIN_BETIGI = /deploy|guncelle|yayin|release|publish/i;
const YAZMA_BAYRAGI = /(^|\s)--(apply|commit|force|no-dry-run|yes|write|execute)(?=\s|=|$)/i;
const SALT_OKUR = /^(cat|type|less|more|head|tail|grep|rg|findstr|ls|dir|wc|file|stat|Get-Content|Select-String|git\s+(diff|log|show|status|blame|add|commit|ls-files))\b/i;
const BAGLANTI_VERILMIS = /--(db|url|dsn|host|port|database)[=\s]|\b(DB_URL|DATABASE_URL|PGHOST|PGPORT)=/i;

/**
 * Bir ajan komutu sınırı aşıyor mu (saf)? Aşıyorsa neden (metin), aşmıyorsa null.
 * gorev: üyenin görev metni + kullanıcının hedefi (açık izinler buradan okunur). betikKaynak: komuttaki betiklerin içeriği
 * (okunabildiyse) — varsayılan bağlantı adresi yasak uca gidiyor mu diye bakılır.
 */
export function komutDenetle({ komut, gorev = "", kart, betikKaynak = "" }) {
  const k = String(komut ?? "");
  if (!k.trim()) return null;
  const kn = norm(k), g = String(gorev ?? ""), gn = g.toLowerCase();
  const y = kart?.yasak ?? { uclar: [], dizinler: [], komutlar: [] };
  for (const d of y.dizinler) if (kn.includes(norm(d))) return `yasak dizin: ${d} (başka proje)`;
  // Yasak komut: yalnız yürüten parçalarda aranır (dosyayı okumak/commit'lemek yasak değildir).
  const yuruten = parcala(k).filter(s => !SALT_OKUR.test(s)).join("\n").toLowerCase();
  for (const c of y.komutlar) if (yuruten.includes(c.toLowerCase())) return `yasak komut: ${c}`;
  for (const u of y.uclar) if (ucGeciyor(k, u)) return `yasak uç: ${u} (başka sisteme ait)`;
  if (YIKICI.test(k)) return "yıkıcı işlem (silme / DROP / reset --hard / zorla push); ekip ajanı yapmaz";
  const bs = betikler(k);
  const yayinIstendi = /yay[ıi]n|deploy|sunucu|push|ssh/i.test(g);
  if (!yayinIstendi && (YAYIN.test(k) || bs.some(b => YAYIN_BETIGI.test(b.ad)))) return "yayın ya da uzak sistem komutu (deploy / ssh / git push / prod compose); görevde açıkça istenmemiş";
  for (const b of bs) if (VERI_BETIGI.test(b.ad) && !gn.includes(b.ad.toLowerCase())) return `görevde adı geçmeyen veri betiği: ${b.ad} (görev hangi betiği istiyorsa tam adıyla onu çalıştır)`;
  if (bs.length && YAZMA_BAYRAGI.test(k) && !/apply|uygula|kal[ıi]c[ıi]|yaz(s[ıi]n|[ıi]lsın)?\b|commit|force/i.test(g)) return "yazma bayrağı (--apply / --force / --yes) görevde istenmemiş; önce kuru çalıştır";
  if (betikKaynak && !BAGLANTI_VERILMIS.test(k)) for (const u of y.uclar) if (ucGeciyor(betikKaynak, u)) return `betiğin varsayılan bağlantısı yasak uca gidiyor: ${u}. Bağlantıyı açıkça ver (--db / --url / --host) ya da çalıştırma`;
  return null;
}

/** Ajanın dosya yazması proje sınırında mı (saf)? Kök dışı yazma reddedilir; geçici dizinler ve izinli dış dizinler serbest. */
export function yazmaDenetle(yol, kart) {
  const y = norm(yol);
  if (!y || !kart?.kok) return null;
  for (const d of kart.yasak?.dizinler ?? []) if (y.startsWith(norm(d))) return `yasak dizine yazma: ${d}`;
  if (y.startsWith(norm(kart.kok))) return null;
  if (/\/(temp|tmp)\//.test(y) || /\/\.claude\//.test(y)) return null;
  if (!/^([a-z]:)?\//.test(y)) return null; // göreli yol: ajanın çalışma dizininde
  for (const d of kart.izinli?.disDizinler ?? []) if (y.startsWith(norm(d))) return null;
  return `proje kökü (${kart.kok}) dışına yazma`;
}

/** Değişen/okunan dosya yollarından proje kökü adayları (saf): her yolun üst dizinleri, en derinden başlayarak. */
export function ustDizinler(yol, en = 8) {
  const duz = String(yol ?? "").replace(/\\/g, "/");
  const on = duz.startsWith("/") ? "/" : "";
  const p = duz.split("/").filter(Boolean);
  const out = [];
  for (let i = p.length - 1; i >= 1 && out.length < en; i--) out.push(on + p.slice(0, i).join("/"));
  return out;
}
