import { test, expect } from 'claude-code/testing'

const ENGINE = (on: any) => {
  on('tool.call', () => ({ result: 'yazildi' }))
  on('prompt.submit', (_$: unknown, e: unknown) => e)
  on('command.run', () => ({ text: '' }))
  on('fs.exists', (_$: unknown, e: any) => ({ value: String(e.path).endsWith('hooks.json') }))
}
const W = (file_path: string) => ({ tool: 'Write', file_path, content: 'x' }) as never

test('var olan dosyaya Write engellenir, yeni dosyaya izin verilir', async ($, on) => {
  ENGINE(on)
  const blocked: any = await $.tool.call(W('hooks/hooks.json'))
  expect(String(blocked.deny ?? blocked.text)).toMatch(/Edit ile/)
  const fresh: any = await $.tool.call(W('yok-boyle-dosya.c'))
  expect(fresh.isError).not.toBe(true)
})

test('/diffmod kapatinca Write serbest', async ($, on) => {
  ENGINE(on)
  const r0: any = await $.command.run({ command: 'diffmod', args: '' } as never)
  expect(r0.text).toMatch(/KAPALI/)
  const r: any = await $.tool.call(W('hooks/hooks.json'))
  expect(r.isError).not.toBe(true)
})

test('prompt "sifirdan" derse Write serbest, revizyon promptuna kural eklenir', async ($, on) => {
  ENGINE(on)
  const p: any = await $.prompt.submit({ text: 'main.c deki ADC okumasını düzelt' } as never)
  expect(p.text).toMatch(/\[diff-disiplin\]/)
  await $.prompt.submit({ text: 'bu dosyayı sıfırdan yaz' } as never)
  const r: any = await $.tool.call(W('hooks/hooks.json'))
  expect(r.isError).not.toBe(true)
})

import { kategori, istatistik, tahmin, ilerleme, kalan, belleğeEkle } from './diff-disiplin.mjs'

test('iş türü sınıflandırma (Türkçe karakterli kelimeler dahil)', () => {
  expect(kategori('UART kesmesi çalışmıyor, düzelt')).toBe('hata')
  expect(kategori('ring buffer için unit test yaz')).toBe('test')
  expect(kategori('ADC modülüne kalibrasyon ekle')).toBe('ozellik')
  expect(kategori('bu fonksiyonu sadeleştir')).toBe('refactor')
  expect(kategori('DMA neden IT den hızlı?')).toBe('analiz')
  expect(kategori('merhaba')).toBe('diger')
})

test('aritmetik ortalama ve örneklem standart sapması', () => {
  const s = istatistik([{ d: 10 }, { d: 20 }, { d: 30 }] as never, 'd')
  expect(s.n).toBe(3)
  expect(s.ort).toBe(20)
  expect(s.ss).toBe(10)
})

test('tahmin: kategori ≥3 örnek → kendi, yoksa genel, yoksa varsayılan', () => {
  let b: any = {}
  expect(tahmin(b, 'hata').kaynak).toBe('varsayılan')
  for (const d of [60_000, 90_000]) b = belleğeEkle(b, 'test', { d, s: 5, z: 0 })
  b = belleğeEkle(b, 'hata', { d: 120_000, s: 12, z: 0 })
  expect(tahmin(b, 'hata').kaynak).toBe('genel')
  for (const d of [100_000, 140_000]) b = belleğeEkle(b, 'hata', { d, s: 12, z: 0 })
  const t = tahmin(b, 'hata')
  expect(t.kaynak).toBe('hata')
  expect(t.sure.ort).toBe(120_000)
  expect(t.sure.ss).toBe(20_000)
})

test('ilerleme hiç geri gitmez, %97 sınırı, adım bilgisi hızlandırır', () => {
  const tah: any = { sure: { n: 5, ort: 60_000, ss: 20_000 }, adim: { n: 5, ort: 10, ss: 3 } }
  let once = 0
  for (let el = 0; el <= 300_000; el += 5000) {
    const f = ilerleme(el, Math.floor(el / 6000), tah)
    expect(f).toBeGreaterThanOrEqual(once)
    expect(f).toBeLessThanOrEqual(0.97)
    once = f
  }
  expect(ilerleme(30_000, 9, tah)).toBeGreaterThan(ilerleme(30_000, 2, tah))
})

test('kalan süre: ortalama → 1σ → 2σ → aşım', () => {
  const tah: any = { sure: { n: 5, ort: 60_000, ss: 20_000 }, adim: { n: 0, ort: 0, ss: 0 } }
  expect(kalan(50_000, tah)).toEqual({ ms: 10_000, etiket: '', asim: false })
  expect(kalan(70_000, tah)).toEqual({ ms: 10_000, etiket: ' (1σ)', asim: false })
  expect(kalan(90_000, tah)).toEqual({ ms: 10_000, etiket: ' (2σ)', asim: false })
  expect(kalan(110_000, tah).asim).toBe(true)
})

test('bellek kategori başına son 40 işi tutar', () => {
  let b: any = {}
  for (let i = 0; i < 45; i++) b = belleğeEkle(b, 'test', { d: i, s: 1, z: 0 })
  expect(b.test.length).toBe(40)
  expect(b.test[0].d).toBe(5)
})
