import { test, expect, mock } from 'claude-code/testing'
import { ROLLER, SABLON_EKIPLER, DANISMAN_MODEL, ISCI_MODEL, spec, durumu, incelemePrompt, sure, planDogrula, atamalar, jsonAl, ilerleme, temaSec, TEMALAR, serit, piksel, SERIT_W } from './ekip.mjs'

test('her şablon ekibin başında Fable danışman var ve tüm üyeler tanımlı', () => {
  for (const e of SABLON_EKIPLER) {
    expect(e.uyeler[0]).toBe('danisman')
    for (const u of e.uyeler) expect(ROLLER[u as keyof typeof ROLLER]).toBeDefined()
  }
  expect(spec('danisman').model).toBe(DANISMAN_MODEL)
  expect((spec('danisman') as any).rol).toBeUndefined()
})

test('inceleme promptu yalnız aktif ekibin bitmiş işçi çıktılarını alır', () => {
  const ekip = SABLON_EKIPLER[0]
  const k = [
    { id: 'a', tip: 'ekip:test-yazici', aciklama: 'uart testi', baslangic: 0, bitis: 58_000, durum: 'bitti', cikti: '7 test, 1 fail' },
    { id: 'b', tip: 'ekip:dokumantasyoncu', aciklama: 'readme', baslangic: 0, bitis: 1, durum: 'bitti', cikti: 'x' },
    { id: 'c', tip: 'ekip:kod-inceleyici', aciklama: 'diff', baslangic: 0, durum: 'calisiyor' },
  ]
  const p = incelemePrompt(ekip, k as never)!
  expect(p).toMatch(/test-yazici \(bitti, 0:58\)/)
  expect(p).not.toMatch(/dokumantasyoncu/)
  expect(p).not.toMatch(/kod-inceleyici/)
  expect(incelemePrompt(ekip, [])).toBeNull()
  expect(durumu(k as never, 'test-yazici')?.id).toBe('a')
  expect(sure(75_000)).toBe('1:15')
})

test('oturum açılınca aktif ekibin üyeleri kaydedilir; ekip dışı tip gizlenir', async ($, on) => {
  mock.store(on, { aktif: 'Arayüz ekibi' })
  const kayit: string[] = []
  on('agent.register', (_$: unknown, e: any) => (kayit.push(e.name), { value: { agent: `ekip:${e.name}` } }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('agent.offer', () => ({ isOffered: true }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  expect(kayit).toEqual(['danisman', 'arayuz-gelistirici', 'dokumantasyoncu'])
  const ic: any = await $.agent.offer({ agent: 'ekip:dokumantasyoncu', description: '', source: 'plugin', provider: {} } as never)
  const dis: any = await $.agent.offer({ agent: 'ekip:firmware-analist', description: '', source: 'plugin', provider: {} } as never)
  expect(ic.isOffered).toBe(true)
  expect(dis.isOffered).toBe(false)
})

test('ajan koşusu izlenir ve bitince bildirim verir', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', (_$: unknown, e: any) => (toasts.push(String(e.text)), { value: undefined }) as never)
  mock.clock(on)
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'a1' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await $.agent.spawn({ prompt: 'UART DMA testi yaz', subagentType: 'ekip:test-yazici' } as never)
  await $.turn.complete({ agentId: 'a1', answer: '7 test eklendi', durationMs: 58_000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  expect(toasts.some(t => /✔ test-yazici bitti/.test(t))).toBe(true)
})

test('panelden görev ver: tuş → görev kutusu → doğru ajan tipi başlar; terminal ve masaüstü', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', (_$: unknown, e: any) => (toasts.push(String(e.text)), { value: undefined }) as never)
  mock.clock(on)
  mock.store(on, {})
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  const spawned: any[] = []
  on('agent.spawn', (_$: unknown, e: any) => (spawned.push(e), { model: 'claude-fable-5-1', agentId: `d${spawned.length}` }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'ekip', surface, component: 'Pane', requestId: 'ekip',
      props: { title: 'Ajan Ekibi', isFocused: true, bodyColumns: 100, placement: 'dock' } as never })
    expect(await ui.find({ type: 'Text', text: /Firmware ekibi/ })).toBeDefined()
    await ui.press({ key: 'b-danisman' })
    await ui.input({ key: 'gorev', text: 'mimariyi değerlendir' })
    expect(spawned.at(-1).subagent_type).toBe('ekip:danisman')
    expect(spawned.at(-1).prompt).toBe('mimariyi değerlendir')
    expect(toasts.some(x => /başlatılamadı/.test(x))).toBe(false)
    await ui.unmount()
  }
})

test('modeller takma adla: danışman en güncel Fable, işçiler en güncel Opus', () => {
  expect(DANISMAN_MODEL).toBe('fable')
  expect(ISCI_MODEL).toBe('opus')
  for (const [ad, r] of Object.entries(ROLLER)) if (ad !== 'danisman') expect((r as any).model).toBe('opus')
})

test('Fable planı: JSON ayıklanır, ad temizlenir, izinsiz araç ve fazla üye atılır', () => {
  const metin = 'Plan şöyle:\n' + JSON.stringify({ ad: 'UART Ekibi', amac: 'DMA sürücüsü', uyeler: [
    { ad: 'Sürücü Yazıcı', aciklama: 'kod', talimat: 'HAL ile yaz', araclar: ['Read', 'Edit', 'Rm -rf'], gorev: 'uart_dma.c yaz' },
    { ad: 'danisman', gorev: 'x' },
    { ad: 'test', gorev: '' },
    ...Array.from({ length: 6 }, (_, i) => ({ ad: `u${i}`, gorev: 'g' })),
  ] })
  const p: any = planDogrula(jsonAl(metin))
  expect(p.ad).toBe('UART Ekibi')
  expect(p.uyeler[0].name).toBe('surucu-yazici')
  expect(p.uyeler[0].tools).toEqual(['Read', 'Edit'])
  expect(p.uyeler[0].permissionMode).toBe('acceptEdits')
  expect(p.uyeler[0].model).toBe('opus')
  expect(p.uyeler.some((u: any) => u.name === 'danisman' || u.name === 'test')).toBe(false)
  expect(p.uyeler.length).toBeLessThanOrEqual(5)
  expect(planDogrula(jsonAl('json yok'))).toBeNull()
})

test('Fable atamaları yalnız ekip üyelerine gider', () => {
  const ekip = { uyeler: ['danisman', 'surucu-yazici', 'testci'] }
  const a = atamalar({ sonraki: [{ uye: 'Sürücü Yazıcı', gorev: 'IDLE kesmesini ekle' }, { uye: 'yabanci', gorev: 'x' }, { uye: 'danisman', gorev: 'y' }] }, ekip)
  expect(a).toEqual([{ uye: 'surucu-yazici', gorev: 'IDLE kesmesini ekle' }])
})

test('ilerleme ve temalı pist: bitmeden %95 sınırı, tema döner, genişlik sabit', () => {
  expect(ilerleme({ durum: 'calisiyor', adim: 0 } as never)).toBe(0.04)
  expect(ilerleme({ durum: 'calisiyor', adim: 100 } as never)).toBeLessThanOrEqual(0.95)
  const st = { n: 5, ort: 10, ss: 3 }
  let once = 0
  for (let a = 0; a < 60; a++) { const f = ilerleme({ durum: 'calisiyor', adim: a } as never, st); expect(f).toBeGreaterThanOrEqual(once); once = f }
  expect(ilerleme({ durum: 'calisiyor', adim: 10 } as never, st)).toBe(0.85)
  expect(ilerleme({ durum: 'bitti' } as never)).toBe(1)
  expect(temaSec(0, 0).ad).not.toBe(temaSec(0, 45_000).ad)
  expect(new Set(TEMALAR.map((_, i) => temaSec(i, 0).ad)).size).toBe(TEMALAR.length)
  const metin = (p: any[]) => p.map((x: any) => x.children).join('')
  for (const t of TEMALAR) for (const adim of [0, 3, 8, 20, 60]) for (const f of [0, 1, 2, 3]) {
    const { ust, alt } = serit({ durum: 'calisiyor', adim } as never, t, f)
    for (const m of [metin(ust), metin(alt)]) {
      expect([...m].length).toBe(SERIT_W + 2)                     // iki satır da hep aynı genişlikte
      expect(/\p{Extended_Pictographic}/u.test(m)).toBe(false)     // emoji yok
    }
  }
  for (const t of TEMALAR) for (const k of t.kare) expect(k.length).toBe(4)   // 4 piksel yükseklik
  expect(piksel(['#.', '##', '.#', '..'])).toEqual(['█▄', ' ▀'])
  const son = serit({ durum: 'bitti' } as never, TEMALAR[0], 0)
  expect(metin(son.ust).endsWith(piksel(TEMALAR[0].kare[0])[0] + '▀▄')).toBe(true) // bitince araç bayrakta
  expect(son.ust.find((x: any) => x.children.includes('█'))?.color).toBe(TEMALAR[0].renk)   // bitişte kimlik korunur
  expect(son.ust.at(-1)?.color).toBe('green')                                                 // yeşil yalnız bayrakta
  const sabit = (f: number) => metin(serit({ durum: 'bitti' } as never, TEMALAR[1], f).alt)
  expect(sabit(0)).toBe(sabit(6))                                                              // duran aracın önünde yol akmaz
  for (const t of TEMALAR) for (const ch of [...t.gok, ...t.zemin, t.izUst, t.izAlt])           // genişlik tuzağı yok
    expect(/^[\x20-\x7e\u2500-\u259f]$/.test(ch)).toBe(true)
  expect(temaSec(2, 1000).ad).toBe(temaSec(2, 1000).ad)
})

test('/ekip kur: Fable planı panelde, onayla → her üye görevle başlar', async ($, on) => {
  mock.clock(on)
  mock.store(on, {})
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  const reg: string[] = []
  on('agent.register', (_$: unknown, e: any) => (reg.push(e.name), { value: { agent: `ekip:${e.name}` } }) as never)
  const modeller: string[] = []
  on('model.complete', (_$: unknown, e: any) => (modeller.push(e.model), { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ad: 'UART Ekibi', amac: 'DMA', uyeler: [
    { ad: 'surucu', talimat: 't', araclar: ['Read', 'Edit'], gorev: 'uart_dma.c yaz' },
    { ad: 'testci', talimat: 't', araclar: ['Read', 'Bash'], gorev: 'test yaz' },
  ] }) } }) as never)
  const spawned: any[] = []
  on('agent.spawn', (_$: unknown, e: any) => (spawned.push(e), { model: 'opus' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'kur STM32 UART DMA sürücüsü', origin: 'user' } as never)
  await new Promise(r => setTimeout(r, 50))
  expect(modeller[0]).toBe('fable')
  const ui = await $.ui.mount({ plugin: 'ekip', surface: 'terminal', component: 'Pane', requestId: 'ekip',
    props: { title: 'Ajan Ekibi', isFocused: true, bodyColumns: 100, placement: 'dock' } as never })
  expect(await ui.find({ type: 'Text', text: /Fable'ın planı: UART Ekibi/ })).toBeDefined()
  await ui.press({ key: 'onay' })
  expect(reg).toEqual(expect.arrayContaining(['surucu', 'testci']))
  expect(spawned.map(x => x.subagent_type)).toEqual(['ekip:surucu', 'ekip:testci'])
  expect(spawned[0].prompt).toBe('uart_dma.c yaz')
  expect(await ui.find({ type: 'Text', text: /Fable atıyor, Opus yürütüyor/ })).toBeDefined()
  await ui.unmount()
})

test('hex renk (Clawd turuncusu) motor tarafından kabul edilir', { plugins: [{ name: 'renk', register: (on: any) => {
  on('ui.render', { component: 'AbovePrompt' }, async ($: any, e: any) => { const { Text } = $.ui.resolve(e); return Text({ key: 'c', color: '#D97757', children: '▄█▀███▀█▄' }) })
} }] } as never, async ($) => {
  const ui = await $.ui.mount({ plugin: 'renk', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 100 } as never })
  expect(await ui.find({ type: 'Text', text: /▄█▀███▀█▄/ })).toBeDefined()
  await ui.unmount()
})

test('şeridin iki satırı aynı sütundan başlar (piksel hizası)', async ($, on) => {
  mock.clock(on); mock.store(on, {})
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  on('agent.spawn', () => ({ model: 'opus', agentId: 'h1' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.agent.spawn({ prompt: 'x', subagentType: 'ekip:test-yazici' } as never)
  const ui = await $.ui.mount({ plugin: 'ekip', surface: 'terminal', component: 'Pane', requestId: 'ekip',
    props: { title: 'Ajan Ekibi', isFocused: true, bodyColumns: 120, placement: 'dock' } as never })
  const satirlar = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text as string)
  const ad = satirlar.find(t => t.startsWith('▸ test-yazici'))!
  const model = satirlar.find(t => /^  opus · /.test(t))!
  expect([...ad].length).toBe([...model].length)
  await ui.unmount()
})

test('terminalde çalışan üye Raster sahnesiyle çizilir ve saat blit ile canlandırır; masaüstünde yazılı şerit', async ($, on) => {
  const saat = mock.clock(on); mock.store(on, {})
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  on('agent.spawn', () => ({ model: 'opus', agentId: 'z1' }) as never)
  const blitler: any[] = []
  on('ui.blit', (_$: unknown, e: any) => (blitler.push(e), { value: {} }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.agent.spawn({ prompt: 'x', subagentType: 'ekip:test-yazici' } as never)
  const props = { title: 'Ajan Ekibi', isFocused: true, bodyColumns: 120, placement: 'dock' } as never
  const ui = await $.ui.mount({ plugin: 'ekip', surface: 'terminal', component: 'Pane', requestId: 'ekip', props })
  expect(await ui.find({ type: 'Raster', key: 'r-test-yazici' } as never)).toBeDefined()
  await saat.advance(400)
  expect(blitler.length).toBeGreaterThan(0)
  expect(blitler.at(-1).key).toBe('r-test-yazici')
  await ui.unmount()
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui2 = await $.ui.mount({ plugin: 'ekip', surface, component: 'Pane', requestId: 'ekip', props })
    expect(await ui2.find({ type: 'Raster' } as never)).toBeUndefined()
    const svg: any = await ui2.find({ type: 'Svg' } as never)
    expect(svg).toBeDefined()
    await ui2.unmount()
  }
  const ui3 = await $.ui.mount({ plugin: 'ekip', surface: 'desktop', component: 'Pane', requestId: 'ekip', props: { ...(props as any), bodyColumns: 50 } as never })
  expect(await ui3.find({ type: 'Svg' } as never)).toBeDefined()   // dar panelde de vektör şerit (ölçeklenir)
  const ui2 = ui3
  await ui2.unmount()
})
