import { test, expect, mock } from 'claude-code/testing'
import { ROLLER, SABLON_EKIPLER, DANISMAN_MODEL, spec, durumu, incelemePrompt, sure } from './ekip.mjs'

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
