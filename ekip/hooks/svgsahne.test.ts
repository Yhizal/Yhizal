import { test, expect } from 'claude-code/testing'
import { svgSerit, svgDusunuyor } from './svgsahne.mjs'
import { SAHNE_ADLARI } from './sahne.mjs'

test('her tema: geçerli, sınır içinde, betiksiz SVG; ilerleme yuvarlanır, gereksiz yeniden çizim yok', () => {
  for (const ad of SAHNE_ADLARI) for (const [p, b] of [[0, false], [0.33, false], [0.999, false], [1, true]] as const) {
    const s = svgSerit(ad, p, b)
    expect(s.startsWith('<svg')).toBe(true)
    expect(s.length).toBeLessThan(131072)
    expect(/<script|on[a-z]+=/i.test(s)).toBe(false)
    expect((s.match(/<g/g) ?? []).length).toBe((s.match(/<\/g>/g) ?? []).length)
  }
  expect(svgSerit('Clawd', 0.331, false)).toBe(svgSerit('Clawd', 0.334, false))  // yüzde adımı içinde aynı kaynak
  expect(svgSerit('Clawd', 0.33, false)).not.toBe(svgSerit('Clawd', 0.5, false))
  expect(svgSerit('yarış', 1, true)).not.toContain('repeatCount="indefinite"/></line>')  // bitince yol durur
  expect(svgDusunuyor().length).toBeLessThan(131072)
})
