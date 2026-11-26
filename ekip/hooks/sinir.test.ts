import { test, expect } from 'claude-code/testing'
import { SINIR_KURALLARI, kartDogrula, kartMetni, komutDenetle, yazmaDenetle, betikler, ucGeciyor, ustDizinler, envAdlari, yerelImportlar, envDosyasi, envDosyaYollari } from './sinir.mjs'

const TANK = kartDogrula({ ad: 'TankSCADA', amac: 'tank platformu',
  izinli: { uclar: ['127.0.0.1:15433 (verify DB)'] },
  yasak: { uclar: ['5433', '192.168.1.236'], dizinler: [String.raw`C:\Users\yhizal\Projects\ilbplatform`], komutlar: ['guncelle.bat'] },
  notlar: ['Gerçek ILB projesine asla dokunma'] }, 'C:/Users/yhizal/Projects/tankscada')

test('25.11.2026 olayı: görevde adı geçmeyen veri betiği ve varsayılanı yasak uca giden betik çalıştırılmaz', () => {
  const gorev = 'Kuru çalıştırma: scripts/seed_tank_panolar.py betiğini --apply VERMEDEN çalıştır, kaç pano ekleneceğini say'
  // yanlış betik: adı görevde yok
  expect(komutDenetle({ komut: 'python scripts/seed_plc_labels.py', gorev, kart: TANK })).toMatch(/görevde adı geçmeyen veri betiği: seed_plc_labels/)
  expect(komutDenetle({ komut: 'python -m scripts.seed_plc_labels', gorev, kart: TANK })).toMatch(/seed_plc_labels/)
  // doğru betik ama varsayılan bağlantısı ILB'nin kapısı
  const kaynak = 'DB = os.environ.get("DB_URL", "postgresql://ilbadmin@localhost:5433/ilbplatform")'
  expect(komutDenetle({ komut: 'python scripts/seed_tank_panolar.py', gorev, kart: TANK, betikKaynak: kaynak })).toMatch(/bağlantısı yasak uca gidiyor: 5433/)
  // bağlantı açıkça verilmiş ve bu projenin ucu: serbest
  expect(komutDenetle({ komut: 'python scripts/seed_tank_panolar.py --db postgresql://tankverify@127.0.0.1:15433/tankverify', gorev, kart: TANK, betikKaynak: kaynak })).toBeNull()
  // yasak uç komutta açıkça yazılmış
  expect(komutDenetle({ komut: 'psql -h localhost -p 5433 -c "select 1"', gorev, kart: TANK })).toMatch(/yasak uç: 5433/)
  expect(komutDenetle({ komut: 'psql -h 127.0.0.1 -p 15433 -c "select 1"', gorev, kart: TANK })).toBeNull()        // 15433 ≠ 5433
  // yazma bayrağı görevde istenmemiş
  expect(komutDenetle({ komut: 'python scripts/seed_tank_panolar.py --db x://127.0.0.1:15433/t --apply', gorev: 'seed_tank_panolar.py betiğini kuru çalıştır', kart: TANK })).toMatch(/yazma bayrağı/)
  expect(komutDenetle({ komut: 'python scripts/seed_tank_panolar.py --db x://127.0.0.1:15433/t --apply', gorev: 'seed_tank_panolar.py betiğini --apply ile uygula', kart: TANK })).toBeNull()
})

test('genel sınırlar: başka proje dizini, yayın/uzak sistem, yıkıcı işlem; olağan iş serbest', () => {
  const g = 'testleri çalıştır ve raporla'
  expect(komutDenetle({ komut: 'cd C:/Users/yhizal/Projects/ilbplatform && git status', gorev: g, kart: TANK })).toMatch(/yasak dizin/)
  expect(komutDenetle({ komut: 'guncelle.bat', gorev: g, kart: TANK })).toMatch(/yasak komut/)
  expect(komutDenetle({ komut: 'git push origin main', gorev: g, kart: TANK })).toMatch(/yayın ya da uzak sistem/)
  expect(komutDenetle({ komut: 'git push origin main', gorev: 'commit at ve push et', kart: TANK })).toBeNull()                 // görev açıkça istiyor
  expect(komutDenetle({ komut: 'ssh plcreport "docker ps"', gorev: g, kart: TANK })).toMatch(/uzak sistem/)
  expect(komutDenetle({ komut: 'docker compose -f docker-compose.prod.yml up -d', gorev: g, kart: TANK })).toMatch(/yayın/)
  expect(komutDenetle({ komut: 'rm -rf /c/Users/yhizal/Projects/tankscada/app', gorev: g, kart: TANK })).toMatch(/yıkıcı/)
  expect(komutDenetle({ komut: 'git reset --hard HEAD~1', gorev: g, kart: TANK })).toMatch(/yıkıcı/)
  expect(komutDenetle({ komut: 'psql -c "DROP TABLE test_session"', gorev: g, kart: TANK })).toMatch(/yıkıcı/)
  for (const serbest of ['pytest -q', 'python -m pytest tests/test_cycle.py -q', 'git status', 'git diff --stat', 'git commit -m "x"', 'python tools/rapor_olustur.py', 'npm run build', 'docker compose -f docker-compose.verify.yml up -d', 'ls scripts'])
    expect(komutDenetle({ komut: serbest, gorev: g, kart: TANK })).toBeNull()
  // kart yokken de genel kurallar geçerli
  expect(komutDenetle({ komut: 'python scripts/migrate_all.py', gorev: g, kart: null })).toMatch(/veri betiği: migrate_all/)
  expect(komutDenetle({ komut: 'pytest -q', gorev: g, kart: null })).toBeNull()
})

test('dosya yazma: proje kökü dışı reddedilir; kök, geçici dizin ve göreli yol serbest', () => {
  expect(yazmaDenetle(String.raw`C:\Users\yhizal\Projects\tankscada\app\x.py`, TANK)).toBeNull()
  expect(yazmaDenetle('app/x.py', TANK)).toBeNull()
  expect(yazmaDenetle('C:/Users/yhizal/AppData/Local/Temp/claude/x/scratchpad/a.txt', TANK)).toBeNull()
  expect(yazmaDenetle('C:/Users/yhizal/Projects/ilbplatform/app/main.py', TANK)).toMatch(/yasak dizine yazma/)
  expect(yazmaDenetle('C:/Users/yhizal/Desktop/baska/x.py', TANK)).toMatch(/proje kökü .* dışına yazma/)
  expect(yazmaDenetle('C:/her/yer/x.py', null)).toBeNull()                 // proje bilinmiyorsa yazma denetimi yapılamaz
})

test('yardımcılar: betik ayıklama, uç eşleşmesi, üst dizinler, kart metni ve kurallar', () => {
  expect(betikler('cd app; python scripts/seed_a.py --x && bash tools/b.sh').map(b => b.ad)).toEqual(['seed_a', 'b'])
  expect(ucGeciyor('localhost:5433/db', '5433')).toBe(true)
  expect(ucGeciyor('localhost:15433/db', '5433')).toBe(false)
  expect(ucGeciyor('192.168.1.2360', '192.168.1.236')).toBe(false)
  expect(ustDizinler(String.raw`C:\a\b\c.py`)).toEqual(['C:/a/b', 'C:/a', 'C:'])
  expect(ustDizinler('/home/x/p/a.py')).toEqual(['/home/x/p', '/home/x', '/home'])
  const m = kartMetni(TANK)
  expect(m).toMatch(/PROJE KARTI — TankSCADA\nKök: C:\/Users\/yhizal\/Projects\/tankscada/)
  expect(m).toMatch(/YASAK uçlar \(başka sistemler\): 5433, 192\.168\.1\.236/)
  expect(m).toMatch(/Not: Gerçek ILB projesine asla dokunma/)
  expect(kartMetni(null)).toMatch(/proje belirlenemedi/)
  expect(kartMetni(kartDogrula(null, 'C:/x/proje'))).toMatch(/PROJE KARTI — proje[\s\S]*ekip-proje\.json yok/)
  expect(SINIR_KURALLARI).toMatch(/TAM ADIYLA/)
  expect(SINIR_KURALLARI).toMatch(/ÇALIŞTIRILDI: <komut>/)
})

test('yalnız ÇALIŞTIRILAN betik denetlenir: test dosyası, git add, okuma ve kurulum bayrakları engellenmez', () => {
  const g = 'testleri çalıştır, değişiklikleri commit et'
  const TANK2 = kartDogrula({ yasak: { uclar: ['5433'], dizinler: [], komutlar: ['docker-compose.dev.yml', 'guncelle.bat'] } }, 'C:/p/tank')
  for (const serbest of [
    'pytest tests/test_seed_panolar.py -q', 'python -m pytest tests/test_register_template_apply.py',
    'git add scripts/seed_tank_panolar.py', 'git diff scripts/migrate_b199.py', 'cat scripts/seed_plc_labels.py', 'grep -n DB_URL scripts/seed_plc_labels.py',
    'cat deploy/update.sh', 'ls deploy', 'git add deploy/install_offline.sh', 'cat docker-compose.dev.yml', 'git diff docker-compose.dev.yml',
    'pip install --force-reinstall pypdf', 'npx --yes prettier .', 'python -c "print(1)"', 'python -m pip install pypdf', 'python tools/render_frames.py --view elec',
  ]) expect(komutDenetle({ komut: serbest, gorev: g, kart: TANK2 })).toBeNull()
  // yürütülünce engellenir
  expect(komutDenetle({ komut: 'docker compose -f docker-compose.dev.yml up -d', gorev: g, kart: TANK2 })).toMatch(/yasak komut: docker-compose\.dev\.yml/)
  expect(komutDenetle({ komut: 'bash scripts/deploy_prod.sh hedef', gorev: g, kart: TANK2 })).toMatch(/yayın ya da uzak sistem/)
  expect(komutDenetle({ komut: './guncelle.bat', gorev: g, kart: TANK2 })).toMatch(/yasak komut: guncelle\.bat/)
  expect(komutDenetle({ komut: 'docker compose exec backend python -m scripts.migrate_b199_alarm_state_drop', gorev: g, kart: TANK2 })).toMatch(/veri betiği: migrate_b199_alarm_state_drop/)
  expect(komutDenetle({ komut: 'psql -f scripts/reset_db.sql', gorev: g, kart: TANK2 })).toMatch(/veri betiği: reset_db/)
  expect(betikler('git add scripts/seed_a.py && python scripts/seed_b.py; pytest tests/test_seed_c.py').map(b => b.ad)).toEqual(['seed_b'])
})

test('kör nokta: adres ortam değişkeninden, .env dosyasından ya da içe aktarılan modülden gelirse de yakalanır', () => {
  const T = kartDogrula({ yasak: { uclar: ['5433'], dizinler: [], komutlar: [] } }, 'C:/p/tank')
  const gorev = 'scripts/seed_tank_panolar.py betiğini kuru çalıştır'
  // betik yalnız ortam değişkeni okuyor; adres .env'de
  const betik = 'import os\nfrom app.core.config import settings\nDB = os.environ.get("DB_URL")\nhost = os.getenv("PGHOST")\n'
  expect(envAdlari(betik)).toEqual(['DB_URL', 'PGHOST'])
  expect(yerelImportlar(betik, 'scripts/seed_tank_panolar.py')).toContain('app/core/config.py')
  expect(yerelImportlar(betik, 'scripts/seed_tank_panolar.py')).toContain('app/core/config/settings.py')
  const env = envDosyasi('# yorum\nexport DB_URL="postgresql://ilbadmin@localhost:5433/ilbplatform"\nSECRET=x # not\n')
  expect(env).toEqual({ DB_URL: 'postgresql://ilbadmin@localhost:5433/ilbplatform', SECRET: 'x' })
  const kaynaklar = [{ etiket: 'scripts/seed_tank_panolar.py', metin: betik }, { etiket: '.env → DB_URL', metin: `DB_URL=${env.DB_URL}` }]
  expect(komutDenetle({ komut: 'python scripts/seed_tank_panolar.py', gorev, kart: T, betikKaynak: kaynaklar })).toMatch(/yasak uca gidiyor: 5433 \(kaynak: \.env → DB_URL\)/)
  // adres içe aktarılan yapılandırma modülünde (pydantic Settings varsayılanı)
  const config = 'class Settings(BaseSettings):\n    db_url: str = "postgresql://localhost:5433/ilb"\n'
  expect(envAdlari(config)).toContain('DB_URL')
  expect(komutDenetle({ komut: 'python scripts/seed_tank_panolar.py', gorev, kart: T, betikKaynak: [{ etiket: 'içe aktarılan app/core/config.py', metin: config }] })).toMatch(/kaynak: içe aktarılan app\/core\/config\.py/)
  // süreç ortamından
  expect(komutDenetle({ komut: 'python scripts/seed_tank_panolar.py', gorev, kart: T, betikKaynak: [{ etiket: 'ortam değişkeni DATABASE_URL', metin: 'DATABASE_URL=postgres://h:5433/x' }] })).toMatch(/ortam değişkeni DATABASE_URL/)
  // bağlantı komutta açıkça bu projenin ucuna verilirse serbest
  expect(komutDenetle({ komut: 'DB_URL=postgresql://t@127.0.0.1:15433/t python scripts/seed_tank_panolar.py', gorev, kart: T, betikKaynak: kaynaklar })).toBeNull()
  // diğer yazımlar
  expect(envAdlari('const u = process.env.DATABASE_URL; x = $env:PGPORT; y="${API_URL:-http://a}"; z=os.environ["MQTT_HOST"]')).toEqual(expect.arrayContaining(['DATABASE_URL', 'PGPORT', 'API_URL', 'MQTT_HOST']))
  expect(envDosyaYollari('docker compose --env-file deploy/.env.verify run x && source ./yerel.env')).toEqual(expect.arrayContaining(['deploy/.env.verify', './yerel.env', '.env']))
  expect(yerelImportlar("const c = require('./config'); import x from '../lib/db.js'", 'tools/a.js')).toEqual(expect.arrayContaining(['tools/config.js', 'tools/../lib/db.js']))
  expect(yerelImportlar('cfg = open("settings.ini")', 'a.py')).toContain('settings.ini')
})
