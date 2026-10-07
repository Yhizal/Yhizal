import { test, expect } from 'claude-code/testing'
import { ESIK, modelSec, kademe, dosyaCakismalari, yogunMu, bayrak, t2Mi, brifIzinli, uyeTablosu, brifDogrula, brifMetni, KURALLAR } from './kurallar.mjs'

test('kademe seçimi: sonnet/hızlı → Sonnet, gerisi (sınır kuralı) → Opus', () => {
  expect(modelSec('sonnet')).toBe('sonnet')
  expect(modelSec('Hızlı')).toBe('sonnet')
  expect(modelSec('opus')).toBe('opus')
  expect(modelSec('bilinmiyor')).toBe('opus')
  expect(modelSec(undefined)).toBe('opus')
  expect(kademe('claude-sonnet-5-5')).toBe('hızlı')
  expect(kademe('claude-opus-5-5')).toBe('uzman')
})

test('aynı dosya iki üyede çakışma sayılır (yol ayırıcı ve büyük harf fark etmez)', () => {
  const c = dosyaCakismalari([
    { name: 'a', dosyalar: ['src/Uart.c', 'x.h'] },
    { name: 'b', dosyalar: ['src\\uart.c'] },
    { name: 'c', dosyalar: ['y.c'] },
  ])
  expect(c).toEqual([{ a: 'a', b: 'b', dosya: 'src\\uart.c' }])
})

test('yoğun iş: danışman derse ya da ölçülebilir eşiklerden ikisi tutarsa', () => {
  expect(yogunMu({ yogunluk: 'yogun' })).toBe(true)
  expect(yogunMu({ uyeSayisi: 2, dosyaSayisi: 3 })).toBe(false)
  expect(yogunMu({ uyeSayisi: 3, dosyaSayisi: 4 })).toBe(false)               // tek eşik yetmez
  expect(yogunMu({ uyeSayisi: 3, dosyaSayisi: 5 })).toBe(true)
  expect(yogunMu({ uyeSayisi: 1, maxSureDk: 10, turPlani: 2 })).toBe(true)
})

test('bayrak: KARAR GEREKİR / ENGEL satırı', () => {
  expect(bayrak('ÖZET: x\nKARAR GEREKİR: hangi baud?')).toBe('KARAR GEREKİR')
  expect(bayrak('ÖZET: x\nENGEL: derleyici yok')).toBe('ENGEL')
  expect(bayrak('engel yok, her şey iyi')).toBeNull()
})

test('ara brif sınırları: T2 süre/adım aşımı, en kısa süre, üye başına sınır', () => {
  const now = 1_000_000
  const kosu = { durum: 'calisiyor', baslangic: now - 60_000, adim: 10, beklenenDk: 0.5 }
  expect(t2Mi(kosu as never, { now })).toBe('T2')                              // 1 dk > 0.5 dk × 1.5
  expect(t2Mi({ ...kosu, beklenenDk: 5 } as never, { now })).toBeNull()
  expect(t2Mi({ ...kosu, beklenenDk: 0, adim: 41 } as never, { now })).toBe('T2')
  expect(t2Mi(kosu as never, { now, t2Gitti: true })).toBeNull()             // aynı turda ikinci T2 yok
  expect(brifIzinli(kosu as never, 'T1', { now })).toBe(false)               // 2 dk'dan kısa: yalnız T2
  expect(brifIzinli(kosu as never, 'T2', { now })).toBe(true)
  expect(brifIzinli({ ...kosu, baslangic: now - 130_000 } as never, 'T1', { now })).toBe(true)
  expect(brifIzinli(kosu as never, 'T2', { now, brifSayisi: ESIK.BRIF_MAX_UYE })).toBe(false)
  expect(brifIzinli({ ...kosu, durum: 'bitti' } as never, 'T2', { now })).toBe(false)
})

test('brif doğrulama ve metin: yalnız koşan üyeye, ≤6 satır; yeniden atamada model', () => {
  expect(brifDogrula({ brif: false }, ['a'])).toBeNull()
  expect(brifDogrula({ brif: true, hedef_uye: 'yok', neden: 'x' }, ['a'])).toBeNull()
  const b: any = brifDogrula({ brif: true, hedef_uye: 'a', eylem: 'yon', neden: 'API değişti', yeni_hedef: 'yalnız parse()', dokunma: ['b.c'], bitis_olcutu: 'pytest -k parse' }, ['a'])
  const m = brifMetni(2, b)
  expect(m.split('\n').length).toBeLessThanOrEqual(6)
  expect(m).toMatch(/^BRİF #2 → a/)
  expect(m).toMatch(/Dokunma: b\.c/)
  const y: any = brifDogrula({ brif: true, hedef_uye: 'a', eylem: 'yeniden_ata', neden: 'KARAR GEREKİR', yeni_model: 'opus', yeni_gorev: 'kök nedeni bul' }, ['a'])
  expect(y.yeniModel).toBe('opus')
  expect(brifMetni(3, y)).toMatch(/^DUR — BRİF #3/)
})

test('üye tablosu telemetriden: kademe, durum, bayrak, brif sayısı', () => {
  const t = uyeTablosu([
    { tip: 'ekip:cekirdek', model: 'claude-opus-5-5', aciklama: 'DMA | kesme', durum: 'bitti', adim: 12, baslangic: 0, bitis: 90_000, cikti: 'ÖZET: tamam' },
    { tip: 'ekip:hizli', model: 'claude-sonnet-5-5', aciklama: 'README', durum: 'bitti', adim: 3, baslangic: 0, bitis: 20_000, cikti: 'KARAR GEREKİR: dil?' },
  ] as never, [{ uye: 'cekirdek' }, { uye: 'cekirdek' }] as never)
  const s = t.split('\n')
  expect(s[0]).toBe('| Üye | Kademe | Görev | Durum | Adım | Süre | Brif |')
  expect(s[2]).toBe('| cekirdek | uzman | DMA / kesme | bitti | 12 | 1:30 | 2 |')
  expect(s[3]).toMatch(/\| hizli \| hızlı \| README \| bitti ⚑KARAR GEREKİR \|/)
  expect(uyeTablosu([], [])).toBe('')
})

test('kural metni altı bölümü taşır', () => {
  for (const b of ['Hiyerarşi', 'Model atama', 'Yoğun iş', 'Rapor', 'Ara brif', 'Genel']) expect(KURALLAR).toMatch(new RegExp(`## \\d\\. ${b}`))
})
