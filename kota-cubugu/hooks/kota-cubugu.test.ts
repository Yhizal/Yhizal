import { test, expect } from 'claude-code/testing'
import { pace, dur, heat, kotaSatirlari } from './kota-cubugu.mjs'
import { kotaKarti } from './cam.mjs'

const H = 3600_000
const NOW = Date.parse('2026-10-05T12:00:00Z')
const at = (ms: number) => new Date(NOW + ms).toISOString()

test('süre biçimi: dk, sa, gün', () => {
  expect(dur(45 * 60_000)).toBe('45dk')
  expect(dur(2 * H + 13 * 60_000)).toBe('2sa 13dk')
  expect(dur(4 * 24 * H + 6 * H)).toBe('4g 6sa')
})

test('renk eşikleri', () => {
  expect(heat(30)).toBe('green')
  expect(heat(60)).toBe('yellow')
  expect(heat(85)).toBe('red')
})

test('5 saatlik pencere: 1 saat geçti, %60 kullanıldı → bitiş tahmini', () => {
  const p: any = pace({ kind: 'five_hour', percentUsed: 60, resetsAt: at(4 * H) }, NOW)
  expect(Math.round(p.elapsed * 100)).toBe(20)
  expect(p.ahead).toBeGreaterThan(10)
  expect(Math.round(p.runsOut / 60_000)).toBe(40) // %60/saat → kalan %40 = 40 dk
})

test('haftalık pencere: zamanın gerisinde → dolmaz', () => {
  const p: any = pace({ kind: 'seven_day', percentUsed: 10, resetsAt: at(3.5 * 24 * H) }, NOW)
  expect(p.ahead).toBeLessThan(-10)
  expect(p.runsOut).toBeNull()
})

test('resetsAt yoksa tempo hesaplanmaz', () => {
  expect(pace({ kind: 'five_hour', percentUsed: 50 }, NOW)).toBeNull()
})

test('%80 geçilince bir kez uyarı verir', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', (_$: unknown, e: any) => (toasts.push(String(e.text)), { value: undefined }) as never)
  on('session.measure', (_$: unknown, e: any) => ({ changed: e.changed }) as never)
  const m = (p: number) => $.session.measure({
    context: {} as never, changed: ['rateLimits'],
    rateLimits: [{ kind: 'five_hour', percentUsed: p, resetsAt: new Date(Date.now() + H).toISOString() }],
  } as never)
  await m(50); await m(82); await m(84)
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toMatch(/%82/)
})

import { cacheGuncelle, cacheDurum, bin, TTL } from './kota-cubugu.mjs'

const U = (okunan: number, yazilan: number, girdi = 50, model = 'claude-opus-5-5') =>
  ({ cache_read_input_tokens: okunan, cache_creation_input_tokens: yazilan, input_tokens: girdi, output_tokens: 500, model })

test('önbellek: ilk istek yazar, sonrakiler okur; isabet oranı birikimli', () => {
  let c: any = cacheGuncelle(null, U(0, 40_000), 0, TTL.abonelik)
  expect(c.ctx).toBe(40_550)
  expect(c.iska).toBe(0)
  c = cacheGuncelle(c, U(40_000, 2_000), 60_000, TTL.abonelik)
  expect(c.iska).toBe(0)
  expect(Math.round((c.okunan / c.toplam) * 100)).toBe(49) // 40k / (40k+2k+40k+100)
})

test('önbellek: süre dolunca ıskalama ve nedeni; model değişince ayrı neden', () => {
  let c: any = cacheGuncelle(null, U(0, 80_000), 0, TTL.api)
  c = cacheGuncelle(c, U(0, 82_000), 400_000, TTL.api)          // 6.6 dk sonra: 5 dk TTL geçti
  expect(c.iska).toBe(1)
  expect(c.neden).toBe('süre doldu')
  c = cacheGuncelle(c, U(0, 83_000, 50, 'claude-fable-5-1'), 410_000, TTL.api)
  expect(c.iska).toBe(2)
  expect(c.neden).toBe('model değişti')
})

test('önbellek durumu: sıcak → %20 altında uyarı → soğuk; soğukta yeniden yazılacak token', () => {
  const c: any = cacheGuncelle(null, U(0, 81_600), 0, TTL.abonelik)
  const s1: any = cacheDurum(c, 10 * 60_000)
  expect(s1.sicak).toBe(true); expect(s1.ttl).toBe('1sa'); expect(s1.uyari).toBe(false)
  expect(cacheDurum(c, 50 * 60_000)!.uyari).toBe(true)
  const s3: any = cacheDurum(c, 61 * 60_000)
  expect(s3.sicak).toBe(false)
  expect(bin(s3.ctx)).toBe('82k')
  expect(cacheDurum(null, 0)).toBeNull()                              // ilk yanıttan önce hiçbir şey gösterme
})

test('cam kart: dönem sonu tahmini gölgesi ve dakika içinde değişmeyen SVG metni', () => {
  const lim = [{ kind: 'five_hour', percentUsed: 20, resetsAt: at(3 * H) }]
  const [r] = kotaSatirlari(lim, NOW)
  expect(r.hayalet).toBe(0.5) // 2 saatte %20 → 5 saatte ~%50
  expect(r.durum?.ton).toBe('yesil')
  expect(kotaKarti(kotaSatirlari(lim, NOW + 5_000))).toBe(kotaKarti(kotaSatirlari(lim, NOW)))
})
