import { test, expect } from 'claude-code/testing'
import { pace, dur, heat } from './kota-cubugu.mjs'

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
