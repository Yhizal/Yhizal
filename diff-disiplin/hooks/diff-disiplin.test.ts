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
  // log-normal medyan: geometrik ortalamaya yakın (~118 sn), aritmetik 120 sn değil
  expect(Math.abs(t.sure.ort - 118_000)).toBeLessThan(3_000)
})

test('tahmin: yeni işler ağır basar, tek uç değer tahmini uçurmaz', () => {
  let b: any = {}
  for (let i = 0; i < 20; i++) b = belleğeEkle(b, 'ozellik', { d: 30_000, s: 3, z: i })
  b = belleğeEkle(b, 'ozellik', { d: 3_600_000, s: 80, z: 21 })     // bir saatlik tek iş
  const t = tahmin(b, 'ozellik')
  expect(t.sure.ort).toBeLessThan(90_000)                              // aritmetik ortalama ~200 sn olurdu
  for (let i = 0; i < 15; i++) b = belleğeEkle(b, 'ozellik', { d: 120_000, s: 10, z: 30 + i })
  expect(tahmin(b, 'ozellik').sure.ort).toBeGreaterThan(90_000)       // alışkanlık değişti, tahmin peşinden geldi
})

test('kendini düzeltme: tahmin sürekli kısa kalırsa öğrenilen düzeltme tahmini büyütür, sapma ölçülür', () => {
  let b: any = {}
  for (let i = 0; i < 10; i++) b = belleğeEkle(b, 'test', { d: 60_000, s: 5, z: i, t: 30_000, c: 30_000 })
  const t = tahmin(b, 'test')
  expect(t.duzeltme).toBeGreaterThan(0.4)                              // ln 2 ≈ 0.69, n/(n+3) ile küçültülmüş
  expect(t.sure.ort).toBeGreaterThan(t.taban)
  expect(t.sapma).toBe(0.5)                                            // her işte %50 kısa
  let d: any = {}
  for (let i = 0; i < 10; i++) d = belleğeEkle(d, 'test', { d: 60_000, s: 5, z: i, t: 60_000, c: 60_000 })
  expect(Math.abs(tahmin(d, 'test').duzeltme)).toBeLessThan(1e-9)     // tutan tahmin düzeltilmez
})

const TAH = (ort: number, sg: number, adimOrt = 0) => ({
  mu: Math.log(ort), sg, sure: { n: 5, ort, ss: 0 },
  adim: adimOrt ? { n: 5, mu: Math.log(adimOrt), sg: 0.3, ort: adimOrt } : { n: 0, ort: 0 },
}) as any

test('ilerleme hiç geri gitmez, %97 sınırı, adım bilgisi hızlandırır', () => {
  const tah = TAH(60_000, 0.35, 10)
  let once = 0
  for (let el = 0; el <= 300_000; el += 5000) {
    const f = ilerleme(el, Math.floor(el / 6000), tah)
    expect(f).toBeGreaterThanOrEqual(once)
    expect(f).toBeLessThanOrEqual(0.97)
    once = f
  }
  expect(ilerleme(30_000, 9, tah)).toBeGreaterThan(ilerleme(30_000, 2, tah))
})

test('kalan süre: başta medyan; süre uzadıkça koşullu medyan, 1σ → 2σ → aşım', () => {
  const tah = TAH(60_000, 0.35)
  expect(Math.abs(kalan(0, tah).ms - 60_000)).toBeLessThan(500)
  const k1 = kalan(50_000, tah)
  expect(k1.etiket).toBe('')
  expect(k1.ms).toBeGreaterThan(10_000)                                 // medyana 10 sn kaldı ama koşullu kalan daha uzun
  expect(kalan(60_000 * Math.exp(0.35 * 1.2), tah).etiket).toBe(' (1σ)')
  expect(kalan(60_000 * Math.exp(0.35 * 2.2), tah).etiket).toBe(' (2σ)')
  expect(kalan(60_000 * Math.exp(0.35 * 3.2), tah).asim).toBe(true)
  for (const el of [10_000, 40_000, 80_000, 120_000]) expect(kalan(el, tah).ms).toBeGreaterThan(0)
})

test('kalan süre: adım hızı canlı düzeltir (hızlı ilerleyen iş daha az kalır)', () => {
  const tah = TAH(60_000, 0.35, 10)
  expect(kalan(20_000, tah, 8).ms).toBeLessThan(kalan(20_000, tah, 3).ms)
})

test('bellek kategori başına son 40 işi tutar', () => {
  let b: any = {}
  for (let i = 0; i < 45; i++) b = belleğeEkle(b, 'test', { d: i, s: 1, z: 0 })
  expect(b.test.length).toBe(40)
  expect(b.test[0].d).toBe(5)
})
