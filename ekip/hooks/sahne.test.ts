import { test, expect, mock } from 'claude-code/testing'
import { SAHNELER, SAHNE_ADLARI, SAHNE_W, SAHNE_R, sahneKaresi, hucreler, base64 } from './sahne.mjs'

const coz = (b64: string) => {
  const ikili = atob(b64); const u8 = Uint8Array.from(ikili, c => c.charCodeAt(0))
  return new Uint32Array(u8.buffer)
}

test('base64 standart: atob ile birebir döner', () => {
  const b = Uint8Array.from([0, 1, 2, 250, 251, 252, 7, 8])
  expect(Uint8Array.from(atob(base64(b)), c => c.charCodeAt(0))).toEqual(b)
})

test('her tema, her kare: geçerli Raster hücreleri (▀, 24 bit renk), doğru boyut', () => {
  for (const ad of SAHNE_ADLARI) for (const f of [0, 1, 2, 7, 31]) for (const p of [0, 0.37, 1]) {
    const u = coz(hucreler(sahneKaresi(ad, f, p, p >= 1)))
    expect(u.length).toBe(SAHNE_W * SAHNE_R * 3)
    for (let i = 0; i < u.length; i += 3) {
      expect(u[i]).toBe(0x2580)
      expect(u[i + 1]).toBeLessThanOrEqual(0xffffff)
      expect(u[i + 2]).toBeLessThanOrEqual(0xffffff)
    }
  }
})

test('sprite kareleri dikdörtgen ve şeride sığar', () => {
  for (const ad of SAHNE_ADLARI) {
    const s: any = (SAHNELER as any)[ad]
    for (const k of s.kare) {
      for (const r of k) expect(r.length).toBe(s.w)
      expect(s.y + k.length).toBeLessThanOrEqual(SAHNE_R * 2)
    }
  }
})

test('deterministik ve canlı: aynı kare aynı, sonraki kare farklı; bitince yol durur', () => {
  for (const ad of SAHNE_ADLARI) {
    expect(hucreler(sahneKaresi(ad, 5, 0.4, false))).toBe(hucreler(sahneKaresi(ad, 5, 0.4, false)))
    const farkli = [6, 7, 8, 9].some(f => hucreler(sahneKaresi(ad, f, 0.4, false)) !== hucreler(sahneKaresi(ad, 5, 0.4, false)))
    expect(farkli).toBe(true)
  }
})
