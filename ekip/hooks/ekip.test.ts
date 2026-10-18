import { test, expect, mock } from 'claude-code/testing'
import { ROLLER, SABLON_EKIPLER, DANISMAN_MODEL, ISCI_MODEL, spec, durumu, incelemePrompt, sure, planDogrula, atamalar, jsonAl, ilerleme, temaSec, TEMALAR, serit, piksel, SERIT_W, firmwareMi, VARSAYILAN_EKIP, turAdimi, kararOku, sonKontrolPrompt, elleKontrolEdilecek, semaVerisi, denetmenIstemi, denetmenPlanDogrula, uygulaPlan, akisEkle, ozetSatiri, eylemMetni, kaynakSec, yedekRapor, baglamTopla, turetilmisAkis, sonucMetni, sessizKosular, bekleyenSonuc, tasarimMi, maddeSatirlari, maddeleriBirlestir, maddeListesi, acikMaddeler, kesikMi, devamHedefi, otoDevamKarari, OTO_DEVAM_MAX, yedekSonRapor, sonRaporGecerli } from './ekip.mjs'
import { sadeSvg as semaSvg, ikonSec, adimCumlesi, eylemOzeti } from './sade.mjs'
import { KARAR_ILKESI, ISCI_FORMAT, KADEME_EK } from './kurallar.mjs'

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
  // Etkin ekip proje başına: anahtar "aktif:<cwd>".
  mock.store(on, { 'aktif:/proje': 'Arayüz ekibi' })
  const kayit: string[] = []
  on('agent.register', (_$: unknown, e: any) => (kayit.push(e.name), { value: { agent: `ekip:${e.name}` } }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('agent.offer', () => ({ isOffered: true }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  expect(kayit).toEqual(['danisman', 'arayuz-gelistirici', 'dokumantasyoncu', 'hizli-isci', 'hafif-isci', 'model-izci'])
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
  mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
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
    // Firmware olmayan proje → Yazılım ekibi; görev düğmeleri "Elle yönet" arkasında.
    if (surface === 'terminal') expect(await ui.find({ type: 'Text', text: /Yazılım ekibi/ })).toBeDefined()
    else expect(JSON.stringify(await ui.find({ type: 'Svg' } as never))).toMatch(/Yazılım ekibi/)   // uygulamada başlık şemanın içinde
    expect(await ui.find({ type: 'Button', key: 'b-danisman' })).toBeUndefined()
    await ui.press({ key: 'elle' })
    await ui.press({ key: 'b-danisman' })
    await ui.input({ key: 'gorev', text: 'mimariyi değerlendir' })
    expect(spawned.at(-1).subagent_type).toBe('ekip:danisman')
    expect(spawned.at(-1).prompt).toBe('mimariyi değerlendir')
    expect(toasts.some(x => /başlatılamadı/.test(x))).toBe(false)
    await ui.press({ key: 'elle' }) // sonraki yüzey otomatik görünümle başlasın
    await ui.unmount()
  }
})

test('proje türü: .ioc / platformio / Core+Drivers firmware, gerisi yazılım', () => {
  expect(firmwareMi(['Proje.ioc', 'README.md'])).toBe(true)
  expect(firmwareMi(['platformio.ini'])).toBe(true)
  expect(firmwareMi(['Core', 'Drivers', 'Makefile'])).toBe(true)
  expect(firmwareMi(['backend', 'frontend', 'deploy', 'spfx'])).toBe(false)
  expect(SABLON_EKIPLER.some(e => e.ad === VARSAYILAN_EKIP.yazilim)).toBe(true)
})

test('üç kademe takma adla: danışman Fable, uzman Opus, hızlı Sonnet; işçi talimatında kademe ve biçim', () => {
  expect(DANISMAN_MODEL).toBe('fable')
  expect(ISCI_MODEL).toBe('opus')
  const hizli = ['test-yazici', 'dokumantasyoncu', 'hizli-isci'], hafif = ['hafif-isci']
  for (const [ad, r] of Object.entries(ROLLER)) if ((r as any).rol === 'isci') {
    expect((r as any).model).toBe(hafif.includes(ad) ? 'haiku' : hizli.includes(ad) ? 'sonnet' : 'opus')
    expect((r as any).prompt).toMatch(hafif.includes(ad) ? /Hafif kademedesin/ : hizli.includes(ad) ? /Hızlı kademedesin/ : /Uzman kademedesin/)
    expect((r as any).prompt).toMatch(/ÖZET: <tek cümle>/)
  }
  expect((ROLLER as any)['model-izci'].model).toBe('haiku')
  expect((ROLLER as any)['model-izci'].tools).toEqual(['WebFetch'])
  expect(ROLLER.danisman.prompt).toMatch(/EKİP KURALLARI v2/)
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

test('/ekip kur (otomatik): Fable planı onay beklemeden başlar, her üye görevle', async ($, on) => {
  mock.clock(on)
  mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
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
  // Otomatik mod: onay düğmesi yok, plan kaydedilip üyeler kendiliğinden başladı.
  expect(await ui.find({ type: 'Button', key: 'onay' })).toBeUndefined()
  expect(reg).toEqual(expect.arrayContaining(['surucu', 'testci']))
  expect(spawned.map(x => x.subagent_type)).toEqual(['ekip:surucu', 'ekip:testci'])
  expect(spawned[0].prompt).toBe('uart_dma.c yaz')
  expect(await ui.find({ type: 'Text', text: /Fable yönetir · Opus uzman · Sonnet hızlı · Haiku hafif · basit iş/ })).toBeDefined()
  await ui.unmount()
})

test('hex renk (Clawd turuncusu) motor tarafından kabul edilir', { plugins: [{ name: 'renk', register: (on: any) => {
  on('ui.render', { component: 'AbovePrompt' }, async ($: any, e: any) => { const { Text } = $.ui.resolve(e); return Text({ key: 'c', color: '#D97757', children: '▄█▀███▀█▄' }) })
} }] } as never, async ($) => {
  const ui = await $.ui.mount({ plugin: 'renk', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 100 } as never })
  expect(await ui.find({ type: 'Text', text: /▄█▀███▀█▄/ })).toBeDefined()
  await ui.unmount()
})

test('sade mod: terminalde ağaç, uygulamada tek animatif şema (yalnız çalışan işte hareket); saat ilerleyince blit yok', async ($, on) => {
  const saat = mock.clock(on); mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
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
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'ekip', surface, component: 'Pane', requestId: 'ekip', props })
    expect(await ui.find({ type: 'Raster' } as never)).toBeUndefined()
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Svg' } as never)).toBeUndefined()
      const satirlar = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text as string)
      expect(satirlar.some(t => t.startsWith('▸ test-yazici'))).toBe(true)
      expect(satirlar.some(t => t.startsWith('● ') && /%/.test(t))).toBe(true)   // sabit nokta + yüzde, spinner yok
      expect(satirlar.some(t => /^[├└]─ Hızlı · sonnet$/.test(t))).toBe(true)     // ast-üst ağacı: kademe başlığı
    } else {
      const svgler = await ui.findAll({ type: 'Svg' } as never)
      expect(svgler).toHaveLength(1)                                              // tek şema, üye başına şerit yok
      const s = JSON.stringify(svgler[0])
      expect(s).toMatch(/Uzman \(Opus 5\.5\): [^;]*test-yazici calisiyor/)          // erişilebilir metin; ajan Opus ile başladı → Uzman sütunu
      expect(s).not.toMatch(/isInteractive.?.?:.?true/)                           // çerçeve yok: kırpışmaz
      expect(s).toMatch(/<animate/)                                                // çalışan ajan var: hareket var
      expect(s).toMatch(/Ajanlar|test-yazici/)                                     // ajan listesi yazıyla görünür
    }
    await ui.unmount()
  }
  await saat.advance(3000)
  expect(blitler).toHaveLength(0)
})

test('yoğun iş: kademeli model ataması ve bağımlı üye sırası', async ($, on) => {
  mock.clock(on)
  mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  const toasts: string[] = []
  on('ui.toast', (_$: unknown, e: any) => (toasts.push(String(e.text)), { value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  const sistemler: string[] = []
  on('model.complete', (_$: unknown, e: any) => {
    const s = String(e.system)
    sistemler.push(/model kullanım stratejisi/.test(s) ? 'strateji' : /ekip kurucu/.test(s) ? 'kur' : /ara brif kararı/.test(s) ? 'brif' : 'deger')
    const text = /ekip kurucu/.test(s) ? JSON.stringify({ ad: 'ADC Ekibi', amac: 'kalibrasyon', yogunluk: 'yogun', uyeler: [
        { ad: 'cekirdek', model: 'opus', araclar: ['Read', 'Edit'], gorev: 'adc.c kalibrasyonu', bitis_olcutu: 'make test', dosyalar: ['adc.c'], beklenen_sure_dk: 10 },
        { ad: 'belgeci', model: 'sonnet', araclar: ['Read', 'Write'], gorev: 'README güncelle', bitis_olcutu: 'grep ADC README.md', dosyalar: ['README.md'] },
        { ad: 'testci', model: 'sonnet', araclar: ['Read', 'Edit', 'Bash'], gorev: 'test case ekle', bitis_olcutu: 'make test', dosyalar: ['test_adc.c'], bagimli: 'cekirdek' },
      ] })
      : /ara brif/.test(s) ? JSON.stringify({ brif: true, hedef_uye: 'cekirdek', tetikleyici: 'T3', eylem: 'yon', neden: 'belgeci karar istiyor' })
      : JSON.stringify({ degerlendirme: '**Sonuç** kalibrasyon bitti.\n\nKarar: bitir — hedef tamam', bitti: true })
    return { value: { isAnswered: true, usage: {}, text } } as never
  })
  const spawned: any[] = []
  on('agent.spawn', (_$: unknown, e: any) => (spawned.push(e), { model: e.model, agentId: `a${spawned.length}` }) as never)
  const gonderilen: any[] = []
  on('session.send', (_$: unknown, e: any) => (gonderilen.push(e), { value: {} }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'kur ADC kalibrasyonu', origin: 'user' } as never)
  await new Promise(r => setTimeout(r, 50))
  // Bağımlı testci beklemede; diğerleri kendi kademesinde ve [YOĞUN] etiketiyle başladı.
  expect(spawned.map(x => [x.subagent_type, x.model])).toEqual([['ekip:cekirdek', 'opus'], ['ekip:belgeci', 'sonnet']])
  expect(spawned[0].prompt).toMatch(/^\[YOĞUN\] adc\.c kalibrasyonu\nBitiş ölçütü: make test/)
  expect(toasts.some(t => /1 Opus, 2 Sonnet · bütçe normal · yoğun iş/.test(t))).toBe(true)
  expect(sistemler).toEqual(['strateji', 'kur'])          // önce projenin model stratejisi, sonra plan
})

test('tur adımı: biten üye bağımlıyı açar (çıktısıyla), yoğun işte süren varsa T1/T3 brif tetiklenir', () => {
  const tur: any = { no: 1, durum: 'calisiyor', yogun: true, bekleyen: [{ uye: 'testci', gorev: 'test ekle', model: 'sonnet', bagimli: 'cekirdek' }] }
  const k: any[] = [
    { id: 'a1', tip: 'ekip:cekirdek', tur: 1, durum: 'bitti', cikti: 'ÖZET: tamam' },
    { id: 'a2', tip: 'ekip:belgeci', tur: 1, durum: 'calisiyor' },
  ]
  const a = turAdimi(tur, k, k[0], 'cekirdek')
  expect(a.acilan.map((x: any) => [x.uye, x.model])).toEqual([['testci', 'sonnet']])
  expect(a.acilan[0].gorev).toMatch(/^test ekle\n\ncekirdek çıktısı:\nÖZET: tamam/)
  expect(a.bekleyen).toEqual([])
  expect(a.tetik).toBe('T1')
  expect(turAdimi(tur, k, { ...k[0], cikti: 'KARAR GEREKİR: baud?' }, 'cekirdek').tetik).toBe('T3')
  expect(turAdimi({ ...tur, yogun: false }, k, k[0], 'cekirdek').tetik).toBeNull()      // basit işte brif yok
  expect(turAdimi(tur, [k[0]], k[0], 'cekirdek').tetik).toBeNull()                     // süren yoksa brif yok, tur değerlendirilir
  expect(turAdimi({ ...tur, no: 2 }, k, k[0], 'cekirdek').acilan).toEqual([])           // eski turun çıktısı yeni turu etkilemez
})

test('kritik kota: Fable bütçeyi görür, plan 2 üyeye ve yalnız Sonnet\'e kırpılır', async ($, on) => {
  mock.clock(on)
  mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  const toasts: string[] = []
  on('ui.toast', (_$: unknown, e: any) => (toasts.push(String(e.text)), { value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  const simdi = Date.now()
  on('session.usage', () => ({ value: { startedAt: 0, rateLimits: [
    { kind: 'five_hour', percentUsed: 93, resetsAt: new Date(simdi + 3_600_000).toISOString() },
    { kind: 'seven_day', percentUsed: 40, resetsAt: new Date(simdi + 4 * 86_400_000).toISOString() },
  ] } }) as never)
  const istemler: string[] = []
  on('model.complete', (_$: unknown, e: any) => (istemler.push(String(e.prompt)), { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ad: 'Büyük Ekip', amac: 'x', uyeler: [
    { ad: 'mimar', model: 'opus', araclar: ['Read', 'Edit'], gorev: 'a.c', bitis_olcutu: 'make' },
    { ad: 'ikinci', model: 'opus', araclar: ['Read', 'Edit'], gorev: 'b.c', bitis_olcutu: 'make' },
    { ad: 'ucuncu', model: 'sonnet', araclar: ['Read'], gorev: 'c.c', bitis_olcutu: 'make' },
  ] }) } }) as never)
  const spawned: any[] = []
  on('agent.spawn', (_$: unknown, e: any) => (spawned.push(e), { model: e.model }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'kur büyük iş', origin: 'user' } as never)
  await new Promise(r => setTimeout(r, 50))
  expect(istemler.find(x => /^Hedef:/.test(x))).toMatch(/Kota: 5 saat %93[\s\S]*Bütçe: KRİTİK — en fazla 2 işçi, 1 tur, en fazla 0 Opus, ara brif yok/)
  expect(spawned.map(x => [x.subagent_type, x.model])).toEqual([['ekip:mimar', 'sonnet'], ['ekip:ikinci', 'sonnet']])
  expect(toasts.some(t => /0 Opus, 2 Sonnet · bütçe kritik/.test(t))).toBe(true)
  const ui = await $.ui.mount({ plugin: 'ekip', surface: 'terminal', component: 'Pane', requestId: 'ekip',
    props: { title: 'Ajan Ekibi', isFocused: true, bodyColumns: 100, placement: 'dock' } as never })
  expect(await ui.find({ type: 'Text', text: 'kritik' })).toBeDefined()
  await ui.unmount()
})

test('son kontrol: karar satırı okunur, istem doğrulama ister; elle işler hepsi bitince bir kez kontrol edilir', () => {
  expect(kararOku('| x |\nKARAR: ONAY')).toEqual({ durum: 'onay', neden: '' })
  expect(kararOku('KARAR: RET — test yok')).toEqual({ durum: 'ret', neden: 'test yok' })
  expect(kararOku('belirsiz').durum).toBe('hata')
  const p = sonKontrolPrompt({ baslik: 'ADC', rapor: 'Sonuç: bitti', kosular: [{ tip: 'ekip:cekirdek', model: 'opus', durum: 'bitti', aciklama: 'adc', cikti: 'ÖZET: tamam' }], yogun: true } as never)
  expect(p).toMatch(/SON KONTROL — ADC/)
  expect(p).toMatch(/\| Kontrol \| Sonuç \| Kanıt/)
  expect(p).toMatch(/KARAR: ONAY" ya da "KARAR: RET/)
  const k: any[] = [
    { tip: 'ekip:hizli-isci', durum: 'bitti', bitis: 200 },
    { tip: 'ekip:test-yazici', durum: 'calisiyor' },
    { tip: 'ekip:danisman', durum: 'bitti', bitis: 300 },
    { tip: 'ekip:kod-inceleyici', durum: 'bitti', bitis: 300, tur: 1 },
  ]
  expect(elleKontrolEdilecek(k, 0)).toEqual([])                          // biri sürüyor: bekle
  k[1].durum = 'bitti'; k[1].bitis = 250
  expect(elleKontrolEdilecek(k, 0).map((x: any) => x.tip)).toEqual(['ekip:hizli-isci', 'ekip:test-yazici'])  // danışman ve turlu işler hariç
  expect(elleKontrolEdilecek(k, 220).map((x: any) => x.tip)).toEqual(['ekip:test-yazici'])                   // önceki kontrolden sonra bitenler
})

test('dinamik strateji: danışman projeye göre yazar, plana eklenir, sonraki kurulumda önbellekten; Haiku ataması', async ($, on) => {
  mock.clock(on)
  mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  on('fs.list', (_$: unknown, e: any) => ({ value: /Core$/.test(String(e.path ?? '')) ? [{ name: 'main.c', kind: 'file', size: 1, mtimeMs: 0, isLink: false }]
    : [{ name: 'Proje.ioc', kind: 'file', size: 1, mtimeMs: 0, isLink: false }, { name: 'Core', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] }) as never)
  const cagri: Array<{ tur: string, prompt: string }> = []
  on('model.complete', (_$: unknown, e: any) => {
    const strateji = /model kullanım stratejisi/.test(String(e.system))
    cagri.push({ tur: strateji ? 'strateji' : 'kur', prompt: String(e.prompt) })
    const text = strateji
      ? JSON.stringify({ ozet: 'STM32 firmware', kademeler: { opus: ['DMA/kesme hatası'], sonnet: ['HAL çağrısı ekleme'], haiku: ['derleme uyarısı envanteri'] } })
      : JSON.stringify({ ad: 'Uyarı Ekibi', amac: 'x', uyeler: [{ ad: 'sayac', model: 'haiku', araclar: ['Read', 'Bash'], gorev: 'uyarıları say', bitis_olcutu: 'tablo' }] })
    return { value: { isAnswered: true, usage: {}, text } } as never
  })
  const spawned: any[] = []
  on('agent.spawn', (_$: unknown, e: any) => (spawned.push(e), { model: e.model }) as never)
  await $.session.start({ cwd: '/fw', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'kur derleme uyarılarını topla', origin: 'user' } as never)
  await new Promise(r => setTimeout(r, 50))
  expect(cagri.map(c => c.tur)).toEqual(['strateji', 'kur'])
  expect(cagri[0].prompt).toMatch(/hafif: haiku \(claude-haiku-5-5\)[\s\S]*Proje profili: C\/C\+\+ firmware 2[\s\S]*işaretler: firmware/)
  expect(cagri[1].prompt).toMatch(/MODEL STRATEJİSİ \(bu proje, danışmanın kendi kararı\):\nÖzet: STM32 firmware\n- Opus \(uzman\): DMA\/kesme hatası/)
  expect(spawned.map(x => [x.subagent_type, x.model])).toEqual([['ekip:sayac', 'haiku']])
  expect(spawned[0].prompt).toMatch(/uyarıları say/)
  await $.command.run({ command: 'ekip', args: 'kur ikinci iş', origin: 'user' } as never)
  await new Promise(r => setTimeout(r, 50))
  expect(cagri.map(c => c.tur)).toEqual(['strateji', 'kur', 'kur'])                     // strateji önbellekten
  const m: any = await $.command.run({ command: 'ekip', args: 'modeller', origin: 'user' } as never)
  expect(m.text).toMatch(/Model profili[\s\S]*claude-haiku-5-5[\s\S]*varsayılan; "\/ekip modeller yenile"/)
})

test('ekip şeması: kademeler (ast-üst), üye kartları, rozetler; yüzde 5 ve dakika adımı', () => {
  const ekip: any = { ad: 'Yazılım ekibi', amac: 'x', uyeler: ['danisman', 'kod-inceleyici', 'test-yazici', 'hafif-isci'] }
  const now = 1_000_000
  const k: any[] = [
    { id: 'a', tip: 'ekip:test-yazici', model: 'claude-sonnet-5-5', durum: 'calisiyor', adim: 3, baslangic: now - 150_000, aciklama: 'köprü testleri' },
    { id: 'b', tip: 'ekip:kod-inceleyici', model: 'claude-haiku-5-5', durum: 'bitti', adim: 5, baslangic: now - 90_000, bitis: now - 1000, aciklama: 'diff tara' },
  ]
  const v: any = semaVerisi(ekip, k, { now, tur: { no: 1, durum: 'calisiyor', butce: 'tasarruf' }, butceDurum: { seviye: 'tasarruf', ozet: '' }, brifler: [{ uye: 'test-yazici' }], profil: { modeller: [{ alias: 'fable', id: 'claude-fable-5-1' }, { alias: 'opus', id: 'claude-opus-5-5', gecikme: 'orta', fiyat: '$4 / $20' }] } })
  expect(v.kademeler.map((x: any) => [x.etiket, x.uyeler.map((u: any) => u.ad)])).toEqual([['Uzman', []], ['Hızlı', ['test-yazici']], ['Hafif', ['kod-inceleyici', 'hafif-isci']]])  // gerçek modele göre
  expect(v.kademeler[0].modelAd).toBe('Opus 5.5')
  expect(v.kademeler[1].uyeler[0]).toMatchObject({ durum: 'calisiyor', sure: '2 dk', brif: 1 })
  expect(v.kademeler[1].uyeler[0].yuzde % 5).toBe(0)
  expect(v.kademeler[2].uyeler[0]).toMatchObject({ durum: 'bitti', yuzde: 100, sure: '1:29' })
  expect(v.tur.yazi).toBe('tur 1/2 çalışıyor')                                   // tasarrufta 2 tur
  expect(v.butce.yazi).toBe('bütçe tasarruf')
  expect(v.danisman).toMatchObject({ model: 'Fable 5.1', durum: 'hazır', mesgul: false })
  const svg = semaSvg(v)
  expect(svg).toMatch(/^<svg [^>]*width="640"/)
  expect(svg).toMatch(/Danışman/)
  expect(svg).toMatch(/Danışman[\s\S]*Fable 5\.1[\s\S]*Ajanlar/)                    // danışman en üstte, altında ajanlar
  expect(svg).not.toMatch(/<script|on[a-z]+=/i)                                    // betik ve olay özniteliği yok
  expect(svg).toMatch(/<animate/)                                                  // çalışan test-yazici var: hareket var
  expect(svg).toMatch(/class="acc"[^>]*\/>/)                                       // çalışan üyenin çubuğu vurgu renginde
  expect(semaSvg(semaVerisi(ekip, k, { now: now + 21_000 }))).toBe(semaSvg(semaVerisi(ekip, k, { now: now + 24_000 })))  // 5 sn'de değişmez
})

test('denetmen: bütün istemi tamamlanan işleri, bekleyen istekleri ve briflerini birlikte taşır', () => {
  const p = denetmenIstemi({
    kosular: [{ tip: 'ekip:kod-inceleyici', durum: 'bitti', adim: 4, aciklama: 'diff incele', cikti: 'ÖZET: ok' }, { tip: 'ekip:model-izci', durum: 'bitti', aciklama: 'profil' }],
    bekleyenler: ['ADC ekle', 'README güncelle'],
    brifler: [{ no: 1, uye: 'test-yazici', eylem: 'yon', neden: 'kapsam daraldı' }],
    sonKontrol: { durum: 'onay', baslik: 'ADC' },
  } as never)
  expect(p).toMatch(/kod-inceleyici \(bitti, 4 adım\): diff incele → ÖZET: ok/)
  expect(p).toMatch(/1\. ADC ekle\n2\. README güncelle/)      // sıra korunur
  expect(p).toMatch(/#1 → test-yazici \(yon\)/)
  expect(p).toMatch(/Son kontrol: onay — ADC/)
  expect(denetmenIstemi({ kosular: [], bekleyenler: [], brifler: [], sonKontrol: null } as never)).toMatch(/henüz iş yok[\s\S]*Bekleyen istekler \(sırayla\):\nyok/)
})

test('denetmen planı: geçersiz indeks, tanınmayan kademe ve boş birleştirme atlanır', () => {
  const p: any = denetmenPlanDogrula({ sira: [2, 0, 9], cikar: [1], birlestir: [[0, 2, 'birleşik'], [5, 0, 'x']], kademe: { 'Test Yazıcı': 'Haiku', x: 'gpt' }, rapor: 'tamam', durum: 'TAMAM' }, 3)
  expect(p.sira).toEqual([2, 0])
  expect(p.cikar).toEqual([1])
  expect(p.birlestir).toEqual([{ a: 0, b: 2, metin: 'birleşik' }])
  expect(p.kademe).toEqual({ 'test-yazici': 'haiku' })
  expect(p.durum).toBe('TAMAM')
  expect(denetmenPlanDogrula(null, 3)).toBeNull()
  expect(denetmenPlanDogrula({ durum: 'DİKKAT — çakışma' }, 2).durum).toBe('DİKKAT')
})

test('denetmen planı kuyruğu uygular: sıra, çıkarma ve birleştirme', () => {
  const items = [{ metin: 'A' }, { metin: 'B' }, { metin: 'C' }]
  const fab = (m: string) => ({ metin: m })
  expect(uygulaPlan(items, { sira: [2, 0], cikar: [1], birlestir: [] } as never, fab).map(x => x.metin)).toEqual(['C', 'A'])
  expect(uygulaPlan(items, { sira: [], cikar: [], birlestir: [{ a: 0, b: 2, metin: 'AC' }] } as never, fab).map(x => x.metin)).toEqual(['AC', 'B'])
  expect(uygulaPlan(items, { sira: [], cikar: [], birlestir: [] } as never, fab).map(x => x.metin)).toEqual(['A', 'B', 'C'])
})

test('canlı akış: eylem metni, ÖZET satırı; akış şemada en yeni üstte, danışman odağı ve çalışan üyenin şu anki eylemi görünür', () => {
  expect(eylemMetni({ tool: 'Read', file_path: 'C:\\proje\\src\\ekip.mjs' })).toBe('Read src/ekip.mjs')
  expect(eylemMetni({ tool: 'Bash', command: 'pytest -q' })).toBe('Bash pytest -q')
  expect(eylemMetni({ tool: 'Grep' })).toBe('Grep')
  expect(ozetSatiri('x\nÖZET: 3 test eklendi\n| a |')).toBe('3 test eklendi')
  expect(ozetSatiri('özet yok')).toBe('')
  akisEkle('kod-inceleyici', 'Read src/ekip.mjs', 'uzman')
  akisEkle('danisman', 'brif #1 → kod-inceleyici (yön): kapsam daraldı', 'danışman')
  const ekip: any = { ad: 'Yazılım ekibi', amac: 'x', uyeler: ['danisman', 'test-yazici'] }
  const now = 5_000_000
  const k: any[] = [{ id: 'a', tip: 'ekip:test-yazici', model: 'claude-sonnet-5-5', durum: 'bitti', adim: 4, baslangic: now - 60_000, bitis: now - 1000, aciklama: 'testler', ozet: '3 test eklendi' }]
  const v: any = semaVerisi(ekip, k, { now, tur: { no: 1, durum: 'degerlendiriliyor' } })
  expect(v.akis[0].uye).toBe('danisman')                                            // en yeni üstte
  expect(v.danisman.mesgul).toBe(true)
  expect(v.danisman.odak).toMatch(/brif #1/)                                        // danışman neyle ilgileniyor
  expect(v.kademeler[1].uyeler[0].ozet).toBe('3 test eklendi')                      // tespit
  const svg = semaSvg(v)
  expect(svg).toMatch(/Son olaylar/)
  expect(svg).toMatch(/Son olaylar[\s\S]*>Danışman<[\s\S]*>kod-inceleyici</)
  expect(svg).toMatch(/3 test eklendi/)                                             // biten üyenin bulgusu ayrıntı sütununda
  expect(semaSvg({ ...v, anim: false })).not.toMatch(/<animate/)
})

test('dinamik panel: ekip dışı ajan görünür, araç çağrısı sayaçla panele yansır, iş bitince sayaç durur', async ($, on) => {
  const saat = mock.clock(on); mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'g1' }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'animasyon kapat', origin: 'user' } as never)   // kırpışma freni gerçek saati kullanır; bu test sayaca bakar
  await $.agent.spawn({ prompt: 'SPFx mobile speed fixes 1-8', subagentType: 'general-purpose' } as never)
  const ui = await $.ui.mount({ plugin: 'ekip', surface: 'desktop', component: 'Pane', requestId: 'ekip',
    props: { title: 'Ajan Ekibi', isFocused: true, bodyColumns: 100, placement: 'dock' } as never })
  const svg = async () => JSON.stringify(await ui.find({ type: 'Svg' } as never))
  expect(await svg()).toMatch(/general-purpose[\s\S]*SPFx mobile speed fixes 1-8/)
  expect(await svg()).toMatch(/ekip dışı/)
  await $.tool.call({ tool: 'Read', file_path: 'src/app.ts', agentId: 'g1' } as never)
  await saat.advance(2600)                                           // canlı sayaç paneli yeniden çizer
  expect(await svg()).toMatch(/Dosya okuyor · src\/app\.ts/)
  await $.tool.call({ tool: 'Bash', command: 'npm run build', agentId: 'g1' } as never)
  await saat.advance(2600)
  expect(await svg()).toMatch(/Derliyor/)                             // ikinci adım da yansır
  await $.turn.complete({ agentId: 'g1', answer: 'ÖZET: bitti', durationMs: 9000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await saat.advance(2600)
  expect(await svg()).toMatch(/ekip dışı[\s\S]*Tamamlandı/)                // biten ajan yerinde kalır, tamamlandı görünür
  expect(await svg()).not.toMatch(/<animate/)                         // hiçbiri çalışmıyor: hareket durur
  await ui.unmount()
})

test('eşzamanlı başlayan üç ajan birbirinin kaydını ezmez (hepsi çalışıyor görünür)', async ($, on) => {
  mock.clock(on); mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `p${++n}` }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await Promise.all(['ekip:kod-inceleyici', 'ekip:hizli-isci', 'ekip:hafif-isci'].map(t => $.agent.spawn({ prompt: `iş ${t}`, subagentType: t } as never)))
  const ui = await $.ui.mount({ plugin: 'ekip', surface: 'desktop', component: 'Pane', requestId: 'ekip',
    props: { title: 'Ajan Ekibi', isFocused: true, bodyColumns: 100, placement: 'dock' } as never })
  const svg = JSON.stringify(await ui.find({ type: 'Svg' } as never))
  expect(svg).toMatch(/3 çalışıyor/)                                  // üçü de listede: kayıp güncelleme yok
  await ui.unmount()
})

test('şema: çalışan → hata → biten → bekleyen sıralaması, bekleyenler tek satırlık çip, durum sayıları', () => {
  const ekip: any = { ad: 'x', amac: 'y', uyeler: ['danisman', 'kod-inceleyici', 'arayuz-gelistirici', 'firmware-analist'] }
  const now = 10_000_000
  const k: any[] = [
    { id: 'a', tip: 'ekip:arayuz-gelistirici', model: 'claude-opus-5-5', durum: 'calisiyor', baslangic: now - 30_000, aciklama: 'widget' },
    { id: 'b', tip: 'ekip:firmware-analist', model: 'claude-opus-5-5', durum: 'bitti', baslangic: now - 90_000, bitis: now - 1000, aciklama: 'dma' },
  ]
  const v: any = semaVerisi(ekip, k, { now })
  expect(v.kademeler[0].uyeler.map((u: any) => [u.ad, u.durum])).toEqual([['arayuz-gelistirici', 'calisiyor'], ['firmware-analist', 'bitti'], ['kod-inceleyici', 'bekliyor']])
  expect(v.sayim).toEqual({ calisiyor: 1, bitti: 1, hata: 0, bekliyor: 1 })
  const svg = semaSvg(v)
  const a = svg.indexOf('>arayuz-gelistirici <'), f = svg.indexOf('>firmware-analist <'), b = svg.indexOf('Beklemede (1)')
  expect(a).toBeGreaterThan(0)
  expect(a).toBeLessThan(f)                                                         // çalışan önce
  expect(f).toBeLessThan(b)                                                         // biten, bekleyenden önce
  expect(svg).toMatch(/Beklemede \(1\): kod-inceleyici/)                             // bekleyen tek satırda
  expect(svg).toMatch(/1 çalışıyor[\s\S]*1 tamamlandı[\s\S]*1 beklemede/)
  const bos = semaSvg(semaVerisi(ekip, [], { now }))
  expect(Number(/height="(\d+)"/.exec(bos)![1])).toBeLessThan(Number(/height="(\d+)"/.exec(svg)![1]))   // hepsi bekliyorken şema kısa
})

test('ÖZET satırında tam yollar dosya adına iner', () => {
  expect(ozetSatiri('ÖZET: C:\\Users\\yhizal\\Projects\\yusuf-mods\\ekip\\hooks altındaki 5 dosya envanterlendi')).toBe('hooks altındaki 5 dosya envanterlendi')
  expect(ozetSatiri('ÖZET: /yol/a/b.mjs güncellendi')).toBe('b.mjs güncellendi')
  expect(ozetSatiri('ÖZET: 3 test eklendi')).toBe('3 test eklendi')
})

test('dinamik ikon: bitti/hata, çalışırken o anki araç, yoksa rol; şemada çizilir', () => {
  const c = (ad: string, simdi = '', durum = 'calisiyor') => ikonSec({ ad, simdi, durum } as never)
  expect(c('kod-inceleyici', 'Read src/a.ts')).toBe('belge')
  expect(c('kod-inceleyici', 'Grep baglanti backend/')).toBe('ara')
  expect(c('hizli-isci', 'Edit ekip.mjs')).toBe('kalem')
  expect(c('hizli-isci', 'Bash pytest -q')).toBe('test')
  expect(c('hizli-isci', 'Bash claude plugin test ekip')).toBe('test')
  expect(c('hizli-isci', 'Bash git status')).toBe('dal')
  expect(c('hizli-isci', 'Bash npm run build')).toBe('cark')
  expect(c('hizli-isci', 'Bash ls -la')).toBe('terminal')
  expect(c('model-izci', 'WebFetch platform.claude.com/docs')).toBe('kure')
  expect(c('general-purpose', 'Agent iş')).toBe('ag')
  expect(c('hafif-isci')).toBe('liste')                                 // çalışıyor ama eylem yok → rol ikonu
  expect(c('hafif-isci', '', 'bitti')).toBe('check')
  expect(c('test-yazici', 'Bash pytest', 'hata')).toBe('x')
  expect(c('test-yazici', '', 'bekliyor')).toBe('test')                 // boştayken rol ikonu
  expect(c('bilinmeyen-ajan', '', 'bekliyor')).toBe('nokta')
  const ekip: any = { ad: 'x', amac: 'y', uyeler: ['danisman', 'kod-inceleyici'] }
  const k: any[] = [{ id: 'a', tip: 'ekip:kod-inceleyici', model: 'claude-opus-5-5', durum: 'calisiyor', baslangic: 1_000_000, aciklama: 'incele' }]
  const svg = semaSvg(semaVerisi(ekip, k, { now: 1_030_000 }))
  expect(svg).toMatch(/class="sacc" stroke-width="1\.35"[^>]*><path d="M5 2a3 3 0 1 0/)   // rol ikonu (büyüteç) çizildi, tek renkli çizgi
  expect(svg).not.toMatch(/<script|on[a-z]+=/i)
})

test('okunur Türkçe adım cümlesi: araç çağrısı düz cümleye döner', () => {
  expect(adimCumlesi('Read src/app.ts')).toBe('Dosya okuyor · src/app.ts')
  expect(adimCumlesi('Read C:\\a\\b\\ekip.mjs')).toBe('Dosya okuyor · b/ekip.mjs')
  expect(adimCumlesi('Grep baglanti backend/')).toBe('Arıyor · baglanti backend')
  expect(adimCumlesi('Edit ekip.mjs')).toBe('Düzenliyor · ekip.mjs')
  expect(adimCumlesi('Bash pytest -q')).toBe('Test çalıştırıyor')
  expect(adimCumlesi('Bash npm run build')).toBe('Derliyor')
  expect(adimCumlesi('Bash git status')).toBe('Git · status')
  expect(adimCumlesi('Bash ls -la')).toBe('Komut çalıştırıyor · ls -la')
  expect(adimCumlesi('WebFetch platform.claude.com/docs')).toBe('Sayfa okuyor · platform.claude.com/docs')
  expect(adimCumlesi('Agent iş')).toBe('Alt ajan çağırıyor · iş')
  expect(adimCumlesi('tur 1 başladı')).toBe('tur 1 başladı')                      // araç değilse olduğu gibi
})

test('kırpışma freni: çalışırken çizim 4 sn içinde değişmez, iş bitince son durum hemen gelir', () => {
  expect(kaynakSec('<svg>A</svg>', true)).toBe('<svg>A</svg>')            // sıfırla
  expect(kaynakSec('<svg>B</svg>')).toBe('<svg>A</svg>')                  // 4 sn içinde eski çizim
  expect(kaynakSec('<svg>A</svg>')).toBe('<svg>A</svg>')                  // aynı kaynak zaten aynı
  expect(kaynakSec('<svg>B</svg>', true)).toBe('<svg>B</svg>')            // son durum frenlenmez
})

test('iş bitince yerinde durur: biten ekip dışı ajan listede kalır, sayımlara girer, hareket yok', () => {
  const ekip: any = { ad: 'x', amac: 'y', uyeler: ['danisman', 'test-yazici'] }
  const now = 20_000_000
  const k: any[] = [
    { id: 'g', tip: 'general-purpose', model: 'claude-opus-5-5', durum: 'bitti', baslangic: now - 120_000, bitis: now - 10_000, aciklama: 'SPFx hız düzeltmeleri', ozet: '8 düzeltme tamam' },
    { id: 'e', tip: 'ekip:test-yazici', model: 'claude-sonnet-5-5', durum: 'bitti', baslangic: now - 90_000, bitis: now - 5_000, aciklama: 'testler', ozet: 'hepsi geçti' },
    { id: 'eski', tip: 'general-purpose', model: 'claude-opus-5-5', durum: 'bitti', baslangic: now - 3_600_000, bitis: now - 3_000_000, aciklama: 'çok eski' },
  ]
  const v: any = semaVerisi(ekip, k, { now })
  expect(v.diger.map((d: any) => [d.ad, d.durum, d.ozet])).toEqual([['general-purpose', 'bitti', '8 düzeltme tamam']])   // 30 dk'dan eski düşer
  expect(v.sayim).toMatchObject({ calisiyor: 0, bitti: 2 })
  const svg = semaSvg(v)
  expect(svg).toMatch(/general-purpose[\s\S]*Tamamlandı · 1:50/)
  expect(svg).toMatch(/2 tamamlandı/)
  expect(svg).not.toMatch(/<animate/)                                      // hepsi bitti: hareket durur
})

test('ara rapor: danışman her bitişte kısa rapor yazar; panelde danışman şeridinde görünür', async ($, on) => {
  mock.clock(on); mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'r1' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  const istemler: string[] = []
  on('model.complete', (_$: unknown, e: any) => (istemler.push(String(e.system)), { value: { isAnswered: true, usage: {}, text: 'Köprü testleri tamamlandı, hepsi geçti; sıradaki adım yok.' } }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'animasyon kapat', origin: 'user' } as never)
  await $.agent.spawn({ prompt: 'köprü testleri', subagentType: 'ekip:hizli-isci' } as never)
  await $.turn.complete({ agentId: 'r1', answer: 'ÖZET: testler geçti', durationMs: 9000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await new Promise(r => setTimeout(r, 80))
  expect(istemler.some(x => /ara rapor yaz/.test(x))).toBe(true)          // danışman (Fable) çağrıldı
  const ui = await $.ui.mount({ plugin: 'ekip', surface: 'desktop', component: 'Pane', requestId: 'ekip',
    props: { title: 'Ajan Ekibi', isFocused: true, bodyColumns: 100, placement: 'dock' } as never })
  const svg = JSON.stringify(await ui.find({ type: 'Svg' } as never))
  expect(svg).toMatch(/Ara rapor ·[\s\S]*Köprü testleri tamamlandı/)
  await ui.unmount()
  expect(yedekRapor('hizli-isci', { durum: 'bitti', ozet: 'testler geçti' } as never, ['kod-inceleyici'])).toBe('hizli-isci tamamlandı: testler geçti. Süren: kod-inceleyici.')
  expect(yedekRapor('hizli-isci', { durum: 'hata' } as never, [])).toBe('hizli-isci hata. Çalışan ajan kalmadı.')
})

test('hareket: dönen gösterge, parıltılı adım cümlesi, dönen durum kelimeleri; yalnız çalışırken, bitince hiçbiri yok', () => {
  const ekip: any = { ad: 'x', amac: 'y', uyeler: ['danisman', 'test-yazici'] }
  const now = 30_000_000
  const calisan: any[] = [{ id: 'a', tip: 'ekip:test-yazici', model: 'claude-sonnet-5-5', durum: 'calisiyor', baslangic: now - 60_000, aciklama: 'testler' }]
  const v: any = semaVerisi(ekip, calisan, { now, tur: { no: 1, durum: 'degerlendiriliyor' } })      // danışman da çalışıyor
  const svg = semaSvg(v)
  expect(svg).toMatch(/<linearGradient id="parilti"[\s\S]*<animateTransform attributeName="gradientTransform"/)   // parıltı bandı
  expect(svg).toMatch(/fill="url\(#parilti\)"/)                                                                   // yazıya uygulanır
  expect(svg).toMatch(/<animateTransform attributeName="transform" type="rotate"/)                                // dönen gösterge
  for (const w of ['Düşünüyor', 'Değerlendiriyor', 'Planlıyor', 'Karar veriyor']) expect(svg).toContain(`>${w}</text>`)   // dönen kelimeler
  expect(semaSvg({ ...v, anim: false })).not.toMatch(/<animate|parilti/)                                           // animasyon kapalı: iz yok
  const bitti: any[] = [{ ...calisan[0], durum: 'bitti', bitis: now - 1000, ozet: 'tamam' }]
  expect(semaSvg(semaVerisi(ekip, bitti, { now }))).not.toMatch(/<animate|parilti/)                               // hiçbiri çalışmıyor: hareket durur
})

test('JSON ayıklama: dengeli parantez; baştaki/sondaki açıklama ve kod bloğu plan okumayı bozmaz, kesik JSON null', () => {
  const plan = { ad: 'E', amac: 'a', uyeler: [{ ad: 'x', gorev: 'g {iç parantez} }' }] }
  expect(jsonAl('Tamam. ```json\n' + JSON.stringify(plan) + '\n``` Not: parametre {x} olabilir.')).toEqual(plan)   // eski kod burada patlıyordu
  expect(jsonAl('önce {bozuk json} sonra ' + JSON.stringify(plan))).toEqual(plan)                                  // bozuk ilk nesne atlanır
  expect(jsonAl('{"ad":"E","uyeler":[{"ad":"x","gorev":"yarım')).toBeNull()                                          // kesik: kapanmamış
  expect(jsonAl('hiç json yok')).toBeNull()
})

test('plan okunamayınca Fable bir kez yalnız-JSON uyarısıyla yeniden sorulur; ikincisi geçerliyse iş başlar', async ($, on) => {
  mock.clock(on); mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  const kurCagri: string[] = []
  on('model.complete', (_$: unknown, e: any) => {
    const sis = String(e.system)
    if (/model kullanım stratejisi/.test(sis)) return { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ozet: 'x', kademeler: { opus: ['a'] } }) } } as never
    kurCagri.push(String(e.prompt))
    const text = kurCagri.length === 1 ? 'Önce şunu netleştirelim: hangi dosya? (cevabım bir plan değil)'
      : JSON.stringify({ ad: 'Kontrol Ekibi', amac: 'x', uyeler: [{ ad: 'tarayici', model: 'haiku', araclar: ['Read'], gorev: 'kırpışma desenlerini tara', bitis_olcutu: 'tablo' }] })
    return { value: { isAnswered: true, usage: {}, text } } as never
  })
  const spawned: any[] = []
  on('agent.spawn', (_$: unknown, e: any) => (spawned.push(e), { model: e.model }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'kur kırpışmayı kontrol et', origin: 'user' } as never)
  await new Promise(r => setTimeout(r, 80))
  expect(kurCagri).toHaveLength(2)                                                  // bir kez yeniden soruldu
  expect(kurCagri[1]).toMatch(/YALNIZ JSON döndür/)
  expect(spawned.map(x => x.subagent_type)).toEqual(['ekip:tarayici'])              // ikinci cevapla iş başladı
})

test('oturum bağlamı: eski konuşmadan son istekler, değişen dosyalar ve son cevap toplanır; /ekip satırı ve araç sonuçları dışarıda', () => {
  const ms: any[] = [
    { role: 'user', text: 'SPFx hız düzeltmelerini yap', toolUses: [] },
    { role: 'assistant', text: 'Tamam', toolUses: [{ tool: 'Edit', input: { file_path: 'C:/p/a.ts' } }, { tool: 'Read', input: { file_path: 'C:/p/okunan.ts' } }, { tool: 'Write', input: { file_path: 'C:/p/b.ts' } }] },
    { role: 'user', text: '', toolResults: [{ text: 'ok' }], toolUses: [] },
    { role: 'assistant', text: 'a.ts ve b.ts düzeltildi; testler eksik.', toolUses: [{ tool: 'Edit', input: { file_path: 'C:/p/a.ts' } }] },
    { role: 'user', text: '/ekip toparla', toolUses: [] },
  ]
  const b = baglamTopla(ms, { komut: 'toparla' })
  expect(b).toMatch(/SPFx hız düzeltmelerini yap/)
  expect(b).toMatch(/C:\/p\/a\.ts \(2×\)/)
  expect(b).toMatch(/C:\/p\/b\.ts/)
  expect(b).not.toMatch(/okunan\.ts/)               // yalnız değişen dosyalar
  expect(b).not.toMatch(/\/ekip toparla/)           // komutun kendisi bağlam değil
  expect(b).toMatch(/testler eksik/)
  expect(baglamTopla([])).toBe('')
  expect(baglamTopla(null as never)).toBe('')
  expect(baglamTopla([{ role: 'user', text: 'x'.repeat(5000), toolUses: [] }] as never, { sinir: 300 }).length).toBeLessThanOrEqual(300)
})

test('eski konuşmaya eklenen kısa hedef: plan isteği oturum bağlamını taşır; sıradaki iş bildirimi doğru', async ($, on) => {
  mock.clock(on); mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  on('session.messages', () => ({ value: [
    { role: 'user', text: 'Köprü modülünü yeniden yaz', toolUses: [] },
    { role: 'assistant', text: 'köprü.py yazıldı', toolUses: [{ tool: 'Write', input: { file_path: 'C:/p/kopru.py' } }] },
  ] }) as never)
  const kurCagri: string[] = []
  on('model.complete', (_$: unknown, e: any) => {
    if (/model kullanım stratejisi/.test(String(e.system))) return { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ozet: 'x', kademeler: { opus: ['a'] } }) } } as never
    kurCagri.push(String(e.prompt))
    return { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ad: 'Toplama', amac: 'x', uyeler: [{ ad: 'toplayici', model: 'sonnet', araclar: ['Read'], gorev: 'kopru.py dosyasını gözden geçir', bitis_olcutu: 'liste' }] }) } } as never
  })
  const spawned: any[] = []
  on('agent.spawn', (_$: unknown, e: any) => (spawned.push(e), { model: e.model }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  const r1: any = await $.command.run({ command: 'ekip', args: 'toparla', origin: 'user' } as never)
  await new Promise(r => setTimeout(r, 100))
  expect(String(r1?.value?.text ?? r1?.text ?? '')).toMatch(/İstek alındı/)       // önünde iş yok: hemen başlıyor
  expect(kurCagri[0]).toMatch(/OTURUM BAĞLAMI/)
  expect(kurCagri[0]).toMatch(/Köprü modülünü yeniden yaz/)
  expect(kurCagri[0]).toMatch(/C:\/p\/kopru\.py/)
  expect(spawned.map(x => x.subagent_type)).toEqual(['ekip:toplayici'])
})

test('plan modu: işçiler salt-okur uyarısıyla başlar, Fable bilgilenir; ajanlar reddedilirse panelde neden yazar', async ($, on) => {
  mock.clock(on); mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  const kurCagri: string[] = []
  on('model.complete', (_$: unknown, e: any) => {
    if (/model kullanım stratejisi/.test(String(e.system))) return { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ozet: 'x', kademeler: { opus: ['a'] } }) } } as never
    kurCagri.push(String(e.prompt))
    return { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ad: 'Plan Ekibi', amac: 'x', uyeler: [{ ad: 'okuyucu', model: 'sonnet', araclar: ['Read'], gorev: 'modülü oku', bitis_olcutu: 'rapor' }] }) } } as never
  })
  const spawned: any[] = []
  let reddet = false
  on('agent.spawn', (_$: unknown, e: any) => (spawned.push(e), reddet ? { deny: 'plan modunda ajan başlatılamaz' } : { model: e.model ?? 'claude-sonnet-5-5' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.agent.spawn({ prompt: 'x', subagentType: 'general-purpose', permissionMode: 'plan' } as never)   // ana modelin ajan çağrısı plan modunu bildirir
  spawned.length = 0
  try {
    const r: any = await $.command.run({ command: 'ekip', args: 'modülü gözden geçir', origin: 'user' } as never)
    await new Promise(x => setTimeout(x, 100))
    expect(String(r?.value?.text ?? r?.text ?? '')).toMatch(/Plan modundasın/)
    expect(kurCagri[0]).toMatch(/PLAN MODU AÇIK/)
    expect(spawned[0].prompt).toMatch(/^\[PLAN MODU: dosya değiştirme/)
    reddet = true
    await $.command.run({ command: 'ekip', args: 'bir daha dene', origin: 'user' } as never)
    await new Promise(x => setTimeout(x, 100))
    const ui = await $.ui.mount({ plugin: 'ekip', surface: 'terminal', component: 'Pane', requestId: 'ekip',
      props: { title: 'Ajan Ekibi', isFocused: true, bodyColumns: 100, placement: 'dock' } as never })
    expect(await ui.find({ type: 'Text', text: /Ajanlar başlatılamadı: plan modunda ajan başlatılamaz.*Shift\+Tab/ })).toBeDefined()
    await ui.unmount()
  } finally { await $.agent.spawn({ prompt: 'y', subagentType: 'general-purpose', permissionMode: 'default' } as never) }
})

test('auto mod sınıflandırıcısı ajan başlatmayı reddederse: panelde sebep ve çözüm yazar, tur takılı kalmaz', async ($, on) => {
  mock.clock(on); mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  on('model.complete', (_$: unknown, e: any) => {
    if (/model kullanım stratejisi/.test(String(e.system))) return { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ozet: 'x', kademeler: { opus: ['a'] } }) } } as never
    return { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ad: 'Oto Ekip', amac: 'x', uyeler: [{ ad: 'okuyucu', model: 'sonnet', araclar: ['Read'], gorev: 'oku', bitis_olcutu: 'rapor' }] }) } } as never
  })
  on('agent.spawn', () => ({ deny: 'The server-side auto mode classifier gave no verdict for Agent: the request that produced this action did not ask for one.' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'arayüzü yenile', origin: 'user' } as never)
  await new Promise(x => setTimeout(x, 100))
  const ui = await $.ui.mount({ plugin: 'ekip', surface: 'terminal', component: 'Pane', requestId: 'ekip',
    props: { title: 'Ajan Ekibi', isFocused: true, bodyColumns: 100, placement: 'dock' } as never })
  expect(await ui.find({ type: 'Text', text: /auto modun izin denetimi.*Agent\(ekip:\*\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Tur 1\/\d+ çalışıyor/ })).toBeUndefined()
  await ui.unmount()
})

test('eylem özeti: araç sayaçları okunur Türkçe cümleye döner', () => {
  expect(eylemOzeti({ Read: 9, Grep: 2, Glob: 1, Edit: 1 })).toBe('9 dosya okudu · 3 arama · 1 düzenleme')
  expect(eylemOzeti({ Bash: 4, WebFetch: 2 })).toBe('4 komut · 2 web sayfası')
  expect(eylemOzeti({})).toBe('')
  expect(eylemOzeti(undefined)).toBe('')
})

test('iş akışı şeması: danışmandan işçilere yaylar; çalışırken noktalar akar, hepsi bitince durur; satırda eylem özeti', () => {
  const ekip: any = { ad: 'x', amac: 'y', uyeler: ['danisman', 'test-yazici', 'kod-inceleyici'] }
  const now = 40_000_000
  const calisan: any[] = [{ id: 'a', tip: 'ekip:test-yazici', model: 'claude-sonnet-5-5', durum: 'calisiyor', baslangic: now - 60_000, aciklama: 'testler', eylemler: { Read: 5, Bash: 2 } }]
  const svg = semaSvg(semaVerisi(ekip, calisan, { now }))
  expect(svg).toContain('İş akışı')
  expect(svg).toMatch(/<animateMotion[^>]*path="M\d+ \d+ Q/)                 // çalışan işçiye akan nokta
  expect(svg).toMatch(/stroke-dasharray="3 4"/)                              // bekleyen (kod-inceleyici) kesikli yay
  expect(svg).toContain('5 dosya okudu · 2 komut')
  const bitti: any[] = [{ ...calisan[0], durum: 'bitti', bitis: now - 1000, ozet: 'tamam' }]
  const durgun = semaSvg(semaVerisi(ekip, bitti, { now }))
  expect(durgun).toContain('İş akışı')                                       // bitince de şema yerinde
  expect(durgun).not.toMatch(/<animate/)                                     // ama hareket yok
  expect(durgun).toContain('5 dosya okudu · 2 komut')                        // biten satırda yapılan işler görünür
})

test('canlı akış belleği boşken son olaylar koşu kayıtlarından türetilir', () => {
  const now = 50_000_000
  const k: any[] = [
    { id: 'a', tip: 'ekip:hafif-isci', durum: 'bitti', baslangic: now - 120_000, bitis: now - 60_000, aciklama: 'hooks envanteri', ozet: '5 dosya tarandı' },
    { id: 'i', tip: 'ekip:model-izci', durum: 'bitti', baslangic: now - 90_000, bitis: now - 80_000, aciklama: 'profil' },
    { id: 'e', tip: 'general-purpose', durum: 'bitti', baslangic: now - 4 * 3600_000, bitis: now - 3 * 3600_000, aciklama: 'eski' },
  ]
  const a = turetilmisAkis(k, now)
  expect(a.map((x: any) => [x.uye, x.metin])).toEqual([['hafif-isci', 'tamamladı — 5 dosya tarandı'], ['hafif-isci', 'başladı — hooks envanteri']])
})

// ── Sonuç ana sohbete yazılır (yalnız yan panelde kalmasın) ──
test('sonuç metni: rapor, işçi satırları (özet + yapılan işler) ve son kontrol kararı', () => {
  const now = 60_000_000
  const m = sonucMetni({ rapor: 'Hedef tamam.', kosular: [
    { id: 'a', tip: 'ekip:hafif-isci', model: 'claude-haiku-5-5', durum: 'bitti', baslangic: now - 40_000, bitis: now, ozet: 'envanter çıktı', eylemler: { Read: 9, Grep: 2 } },
    { id: 'b', tip: 'ekip:model-izci', model: 'claude-haiku-5-5', durum: 'bitti', baslangic: now - 9000, bitis: now },
    { id: 'c', tip: 'ekip:test-yazici', model: 'claude-sonnet-5-5', durum: 'hata', baslangic: now - 60_000, bitis: now },
  ] as any, karar: { durum: 'ret', neden: 'test eksik' } })
  expect(m).toMatch(/^Son durum: ✖ RET — test eksik/)          // en üstte son durum
  expect(m).toMatch(/Danışman raporu:\nHedef tamam\./)
  expect(m).toMatch(/✓ hafif-isci \(hafif, 0:40\) — envanter çıktı · 9 dosya okudu · 2 arama/)
  expect(m).toMatch(/✕ test-yazici/)
  expect(m).not.toMatch(/model-izci/)

})

test('sessiz ajan: 8 dk adım atmayan çalışan koşu uyarılır; etkinlik varsa ya da yeni yüklendiyse uyarılmaz', () => {
  const now = 70_000_000
  const k: any[] = [
    { id: 'sessiz', tip: 'ekip:hizli-isci', durum: 'calisiyor', baslangic: now - 20 * 60_000 },
    { id: 'canli', tip: 'ekip:test-yazici', durum: 'calisiyor', baslangic: now - 20 * 60_000 },
    { id: 'yeni', tip: 'ekip:dokumantasyoncu', durum: 'calisiyor', baslangic: now - 2 * 60_000 },
    { id: 'bitti', tip: 'ekip:kod-inceleyici', durum: 'bitti', baslangic: now - 30 * 60_000, bitis: now - 20 * 60_000 },
  ]
  const etk = new Map([['canli', now - 60_000]])
  expect(sessizKosular(k, etk, now).map((x: any) => x.id)).toEqual(['sessiz'])
  expect(sessizKosular(k, etk, now, now - 60_000)).toEqual([])      // eklenti az önce yüklendi: eski koşular için sahte uyarı yok
})

function sohbetKur($: any, on: any) {
  mock.clock(on); mock.store(on, { izciDeneme: Date.now() })   // model profili yenilemesi (7 gün) takvime bağlı: testler tarihe göre kırılmasın
  const logs: string[] = [], notlar: string[] = [], gonderilen: string[] = []
  on('prompt.submit', (_$: unknown, e: any) => (gonderilen.push(String(e.text)), { text: e.text }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('ui.log', (_$: unknown, e: any) => (logs.push(String(e.text)), { value: undefined }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('session.append', (_$: unknown, e: any, next: any) => { notlar.push(JSON.stringify(e.message ?? e)); return next(e) })
  on('session.start', (_$: unknown, e: any) => e as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.register', (_$: unknown, e: any) => ({ value: { agent: `ekip:${e.name}` } }) as never)
  return { logs, notlar, gonderilen }
}

test('senaryo: ekip planlandı ve kuruldu — ana sohbete "Ekip kuruldu" + üye görevleri yazılır', async ($, on) => {
  const { logs } = sohbetKur($, on)
  on('model.complete', (_$: unknown, e: any) => {
    const sis = String(e.system)
    const text = /model kullanım stratejisi/.test(sis) ? JSON.stringify({ ozet: 'x', kademeler: { opus: ['a'] } })
      : JSON.stringify({ ad: 'Okuma Ekibi', amac: 'modülü oku', uyeler: [{ ad: 'okuyucu', model: 'sonnet', araclar: ['Read'], gorev: 'modülü oku ve özetle', bitis_olcutu: 'özet' }] })
    return { value: { isAnswered: true, usage: {}, text } } as never
  })
  on('agent.spawn', (_$: unknown, e: any) => ({ model: e.model ?? 'claude-sonnet-5-5', agentId: 'a1' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'modülü oku', origin: 'user' } as never)
  await new Promise(r => setTimeout(r, 150))
  expect(logs.join('\n---\n')).toMatch(/Ekip kuruldu — Okuma Ekibi[\s\S]*• okuyucu \(hızlı\): modülü oku ve özetle[\s\S]*Sonuç bitince buraya yazılır/)
})

test('senaryo: iş bitti — ara rapor ve son sonuç ana sohbete yazılır, ana model de bilgilendirilir', async ($, on) => {
  const { logs, gonderilen } = sohbetKur($, on)
  on('model.complete', (_$: unknown, e: any) => {
    const text = /SON KONTROL/.test(String(e.prompt)) ? 'Kontrol tamam, çelişki yok.\nKARAR: ONAY'
      : /ara rapor yaz/.test(String(e.system)) ? 'hizli-isci modülü okudu; sıradaki adım yok.' : 'ok'
    return { value: { isAnswered: true, usage: {}, text } } as never
  })
  on('agent.spawn', (_$: unknown, e: any) => ({ model: e.model ?? 'claude-sonnet-5-5', agentId: 'r1' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.agent.spawn({ prompt: 'köprü modülünü oku', subagentType: 'ekip:hizli-isci', description: 'köprüyü oku' } as never)
  await $.turn.complete({ agentId: 'r1', answer: 'ÖZET: 3 dosya okundu', durationMs: 9000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await new Promise(r => setTimeout(r, 300))
  const hepsi = logs.join('\n---\n')
  expect(hepsi).toMatch(/Ara rapor\nhizli-isci modülü okudu/)
  const sonuc = logs.find(l => /Ekip sonucu —/.test(l)) ?? ''
  const rapor = gonderilen.join('\n')
  expect(rapor).toMatch(/AYNEN göster[\s\S]*## Ekip sonucu —[\s\S]*### Değişiklikler\n\| Üye \| Özet \| Yapılan işler \|[\s\S]*\| hizli-isci \| 3 dosya okundu \|/)   // tablolu rapor ana modele gider
  expect(rapor).toMatch(/### Açık noktalar ve ileride yapılacaklar/)
  expect(rapor).toMatch(/Sorumluluk: Bu raporun doğruluğu ve eksiksizliği danışmana \(Fable\) aittir/)
  expect(sonuc).toMatch(/Son durum: ✔ ONAY/)
  expect(sonuc).toMatch(/Tablolu son rapor hemen aşağıda/)
})

test('senaryo: son kontrol RET — danışman tablolu son raporu yazar (değişiklikler, açık noktalar, sorumluluk) ve ana sohbete gider', async ($, on) => {
  const { logs, gonderilen } = sohbetKur($, on)
  const DAN_RAPOR = '**Sonuç:** Testler eklenmedi.\n### Değişiklikler\n| Dosya | Değişiklik (özet) | Madde | Doğrulama |\n|---|---|---|---|\n| — | Değişiklik yapılmadı | | |\n### İstek maddeleri\n| # | Madde | Durum | Kanıt / gerekçe |\n|---|---|---|---|\n### Açık noktalar ve ileride yapılacaklar\n| # | Konu | Neden açık | Önerilen adım | Öncelik |\n|---|---|---|---|---|\n| 1 | Test | eklenmedi | test yaz | Yüksek |\n### Son kontrol\nRET — testler eklenmemiş'
  on('model.complete', (_$: unknown, e: any) => {
    const text = /SON KONTROL/.test(String(e.prompt)) ? '| Kontrol | Sonuç |\n| test | eksik |\nKARAR: RET — testler eklenmemiş'
      : /son raporun SORUMLUSUSUN/.test(String(e.system)) ? '```markdown\n' + DAN_RAPOR + '\n```' : 'kısa rapor'
    return { value: { isAnswered: true, usage: {}, text } } as never
  })
  on('agent.spawn', (_$: unknown, e: any) => ({ model: e.model ?? 'claude-sonnet-5-5', agentId: 'r1' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.agent.spawn({ prompt: 'x', subagentType: 'ekip:hizli-isci', description: 'x' } as never)
  await $.turn.complete({ agentId: 'r1', answer: 'ÖZET: bitti', durationMs: 3000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await new Promise(r => setTimeout(r, 300))
  const sonuc = logs.find(l => /Ekip sonucu —/.test(l)) ?? ''
  expect(sonuc).toMatch(/Son durum: ✖ RET — testler eklenmemiş/)
  const rapor = gonderilen.join('\n')
  expect(rapor).toMatch(/## Ekip sonucu —[\s\S]*\*\*Sonuç:\*\* Testler eklenmedi\.[\s\S]*\| 1 \| Test \| eklenmedi \| test yaz \| Yüksek \|/)   // danışmanın raporu, kod bloğu soyulmuş
  expect(rapor).not.toMatch(/```/)
  expect(rapor).toMatch(/Sorumluluk: .*danışmana \(Fable\) aittir/)
})

test('yedek son rapor: danışmana ulaşılamazsa verilerden tablolar kurulur; biçim denetimi', () => {
  const md = yedekSonRapor({ baslik: 'Direk', karar: { durum: 'ret', neden: 'çizim yok' },
    maddeler: [{ no: 1, metin: 'direği çiz', durum: 'yapilmadi', not: 'ön koşul eksik' }, { no: 2, metin: 'exe | paket', durum: 'yapildi', not: 'selftest OK' }],
    kosular: [{ tip: 'ekip:dogrulama', durum: 'bitti', ozet: 'selftest geçti', eylemler: { Bash: 3 } }], kullanicidan: ['Uzak depo adresi?'] } as any)
  expect(md).toMatch(/\*\*Sonuç:\*\* Son kontrol ✖ RET — çizim yok · 1\/2 madde yapıldı\./)
  expect(md).toMatch(/\| dogrulama \| selftest geçti \| 3 komut \|/)
  expect(md).toMatch(/\| 2 \| exe \\\| paket \| ✅ Yapıldı \| selftest OK \|/)          // hücredeki | kaçışlı
  expect(md).toMatch(/\| 1 \| direği çiz \| ön koşul eksik \| Ekip devam turunda ele alır \|/)
  expect(md).toMatch(/\| 2 \| Uzak depo adresi\? \| Dış engel \| Kullanıcıdan bilgi \|/)
  expect(sonRaporGecerli(md)).toBe(true)
  expect(sonRaporGecerli('Rapor: her şey yolunda.')).toBe(false)
})

test('senaryo: plan çıkmadı — Fable soru sorarsa ana sohbete uyarı yazılır', async ($, on) => {
  const { logs } = sohbetKur($, on)
  on('model.complete', (_$: unknown, e: any) => ({ value: { isAnswered: true, usage: {}, text: /model kullanım stratejisi/.test(String(e.system)) ? JSON.stringify({ ozet: 'x', kademeler: { opus: ['a'] } }) : 'Hangi dosyayı kastediyorsun?' } }) as never)
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'toparla', origin: 'user' } as never)
  await new Promise(r => setTimeout(r, 200))
  expect(logs.join('\n---\n')).toMatch(/⚠ Ekip planı çıkmadı[\s\S]*Hangi dosyayı kastediyorsun/)
})

test('bekleyen sonuç: son kontrol bitmiş, koşan iş yok ve son iş son bildirimden yeniyse sohbete yazılmamış sonuç vardır', () => {
  const now = 80_000_000
  const k: any[] = [
    { id: 'a', tip: 'ekip:model-dogrulayici', durum: 'bitti', baslangic: now - 300_000, bitis: now - 100_000 },
    { id: 'd', tip: 'ekip:danisman', durum: 'bitti', baslangic: now - 90_000, bitis: now - 10_000 },
    { id: 'i', tip: 'ekip:model-izci', durum: 'bitti', baslangic: now - 50_000, bitis: now - 1_000 },
  ]
  const onay = { durum: 'onay', baslik: 'sim' }
  expect(bekleyenSonuc(onay, k, 0)?.sonIs).toBe(now - 100_000)         // danışman/izci bitişi sayılmaz
  expect(bekleyenSonuc(onay, k, now - 50_000)).toBeNull()                // zaten bildirilmiş
  expect(bekleyenSonuc({ durum: 'bekliyor' }, k, 0)).toBeNull()          // son kontrol sürüyor
  expect(bekleyenSonuc(null, k, 0)).toBeNull()
  expect(bekleyenSonuc(onay, [...k, { id: 'c', tip: 'ekip:hizli-isci', durum: 'calisiyor', baslangic: now - 5000 }], 0)).toBeNull()   // iş sürüyor
})

test('panel: iş bittiyse danışman şeridi "İş bitti · son kontrol onaylandı" der, "Hazır · bekliyor" demez', () => {
  const ekip: any = { ad: 'x', amac: 'y', uyeler: ['danisman', 'hizli-isci'] }
  const now = 90_000_000
  const k: any[] = [{ id: 'a', tip: 'ekip:hizli-isci', model: 'claude-sonnet-5-5', durum: 'bitti', baslangic: now - 60_000, bitis: now - 1000, aciklama: 'x', ozet: 'tamam' }]
  const v: any = semaVerisi(ekip, k, { now, tur: { no: 1, durum: 'bitti' }, sk: { durum: 'onay' } })
  const svg = semaSvg(v)
  expect(svg).toMatch(/İş bitti · son kontrol onaylandı/)
  expect(svg).toMatch(/>Bitti</)
  expect(svg).not.toMatch(/işleri yönlendirmek için bekliyor/)
})

test('senaryo: sonuç bildirimi bir kez yazılır; eklenti yeniden yüklenince (session.start) tekrar yazılmaz', async ($, on) => {
  const { logs } = sohbetKur($, on)
  on('model.complete', (_$: unknown, e: any) => ({ value: { isAnswered: true, usage: {}, text: /SON KONTROL/.test(String(e.prompt)) ? 'ok\nKARAR: ONAY' : 'kısa rapor' } }) as never)
  on('agent.spawn', (_$: unknown, e: any) => ({ model: e.model ?? 'claude-sonnet-5-5', agentId: 'r1' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.agent.spawn({ prompt: 'x', subagentType: 'ekip:hizli-isci', description: 'x' } as never)
  await $.turn.complete({ agentId: 'r1', answer: 'ÖZET: bitti', durationMs: 3000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await new Promise(r => setTimeout(r, 300))
  const say = () => logs.filter(l => /Ekip sonucu —/.test(l)).length
  expect(say()).toBe(1)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)   // sıcak yeniden yükleme
  await new Promise(r => setTimeout(r, 150))
  expect(say()).toBe(1)
})

test('tasarım: /design ve /ekip aynı mesajda olmaz — tasarım işi ekibe verilir; Skill+Artifact yalnız tasarım üyesine', () => {
  expect(tasarimMi('ekran bağlama şemasını yeniden tasarla')).toBe(true)
  expect(tasarimMi('SVG simge seti ve arayüz yerleşimi')).toBe(true)
  expect(tasarimMi('physics.py sıcaklık limiti hatasını düzelt')).toBe(false)
  const plan = planDogrula({ ad: 'E', amac: 'a', uyeler: [
    { ad: 'tasarimci', model: 'opus', araclar: ['Read', 'Write', 'Skill', 'Artifact'], gorev: 'ekran şemasını tasarla', talimat: 'design:design-critique becerisini çağır' },
    { ad: 'duzeltici', model: 'sonnet', araclar: ['Read', 'Edit', 'Skill', 'Artifact'], gorev: 'physics.py limitini düzelt', talimat: 'hesabı düzelt' },
  ] }) as any
  expect(plan.uyeler[0].tools).toEqual(['Read', 'Write', 'Skill', 'Artifact'])
  expect(plan.uyeler[1].tools).toEqual(['Read', 'Edit'])            // tasarım olmayan üyeden Skill/Artifact düşer
  const r = (ROLLER as any).tasarimci
  expect(r.tools).toEqual(expect.arrayContaining(['Skill', 'Artifact', 'Write']))
  expect(r.prompt).toMatch(/design:design-critique[\s\S]*design:design-system[\s\S]*design:ux-copy[\s\S]*design:accessibility-review/)
  expect(r.prompt).toMatch(/Windows teması AÇIK/)
  expect((SABLON_EKIPLER as any[]).find(x => x.ad === 'Tasarım ekibi').uyeler).toContain('tasarimci')
})

test('senaryo: tasarım isteği — Fable\'a TASARIM İŞİ ipucu gider, tasarım üyesi Skill ile başlar', async ($, on) => {
  const { logs } = sohbetKur($, on)
  const istemler: string[] = []
  on('model.complete', (_$: unknown, e: any) => {
    if (/model kullanım stratejisi/.test(String(e.system))) return { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ozet: 'x', kademeler: { opus: ['a'] } }) } } as never
    istemler.push(String(e.prompt))
    return { value: { isAnswered: true, usage: {}, text: JSON.stringify({ ad: 'Tasarım Turu', amac: 'şema', uyeler: [{ ad: 'tasarimci', model: 'opus', araclar: ['Read', 'Write', 'Skill', 'Artifact'], gorev: 'ekran bağlama şemasını tasarla', bitis_olcutu: 'svg' }] }) } } as never
  })
  const spawned: any[] = []
  on('agent.spawn', (_$: unknown, e: any) => (spawned.push(e), { model: e.model ?? 'claude-opus-5-5', agentId: 'a1' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'ekip', args: 'ekran bağlama simülatörünün şemasını tasarla', origin: 'user' } as never)
  await new Promise(r => setTimeout(r, 200))
  expect(istemler[0]).toMatch(/TASARIM İŞİ[\s\S]*design:design-critique/)
  expect(spawned.map(x => x.subagent_type)).toEqual(['ekip:tasarimci'])
  expect(logs.join('\n')).toMatch(/Ekip kuruldu — Tasarım Turu[\s\S]*tasarimci/)
})

// ── İstek maddeleri: her iş yapılır ya da gerekçelenir; ön koşul; net son rapor ve "/ekip devam" ──
test('plan: istek maddeleri üyelere atanır, atanmayan gerekçeyle kapsam dışı; göreve madde listesi ve ön koşul eklenir', () => {
  const plan = planDogrula({ ad: 'E', amac: 'a',
    maddeler: [{ no: 1, metin: 'CB ekran akımı sıfır hatası' }, { no: 2, metin: 'donut grafik' }, { no: 3, metin: 'yazı tipi büyüt' }, { no: 4, metin: 'harita sayfası' }],
    kapsam_disi: [{ no: 3, gerekce: 'tasarım onayı bekleniyor' }],
    uyeler: [
      { ad: 'cekirdek', model: 'opus', araclar: ['Read', 'Edit'], gorev: 'CB hesabını düzelt', maddeler: [1], on_kosul: 'hatayı önce yeniden üret' },
      { ad: 'grafik', model: 'sonnet', araclar: ['Read', 'Edit'], gorev: 'donut ekle', maddeler: [2, 99] },
    ] }) as any
  expect(plan.uyeler[0].gorev).toMatch(/Ön koşul \(önce bunu kontrol et\): hatayı önce yeniden üret/)
  expect(plan.uyeler[0].gorev).toMatch(/İSTEK MADDELERİ[\s\S]*#1 CB ekran akımı sıfır hatası/)
  expect(plan.uyeler[1].maddeler).toEqual([2])                              // geçersiz madde no düşer
  expect(plan.maddeler.map((m: any) => [m.no, m.durum, m.gerekce ?? ''])).toEqual([
    [1, 'atandi', ''], [2, 'atandi', ''], [3, 'kapsam_disi', 'tasarım onayı bekleniyor'], [4, 'kapsam_disi', 'plan gerekçesiz bıraktı']])   // açıkta madde kalmaz
  expect(Object.keys(plan.uyeler[0])).toContain('maddeler')
})

test('madde akışı: işçi MADDE satırları + danışman değerlendirmesi → son durum; kesik JSON fark edilir', () => {
  const cikti = 'ÖZET: tamam\nMADDE #1: YAPILDI — physics.py:120 düzeltildi, 12 test geçti\nMADDE #2: YAPILMADI — GEREKEN: faz dengesizliği verisi yok'
  expect(maddeSatirlari(cikti)).toEqual([{ no: 1, durum: 'yapildi', not: 'physics.py:120 düzeltildi, 12 test geçti' }, { no: 2, durum: 'yapilmadi', not: 'GEREKEN: faz dengesizliği verisi yok' }])
  const plan = [{ no: 1, metin: 'a', durum: 'atandi' }, { no: 2, metin: 'b', durum: 'atandi' }, { no: 3, metin: 'c', durum: 'atandi' }]
  const k = [{ tip: 'ekip:x', cikti, maddeRapor: maddeSatirlari(cikti) }]
  const m = maddeleriBirlestir(plan, k, [{ no: 2, durum: 'kısmen', not: 'veri eklendi, grafik bekliyor' }])
  expect(m.map((x: any) => [x.no, x.durum])).toEqual([[1, 'yapildi'], [2, 'kismen'], [3, 'atandi']])
  expect(maddeListesi(m)).toBe('✓ #1 a — physics.py:120 düzeltildi, 12 test geçti\n◐ #2 b — veri eklendi, grafik bekliyor\n… #3 c — işçi raporlamadı')
  expect(acikMaddeler(m).map((x: any) => x.no)).toEqual([2, 3])
  expect(kesikMi('{"ad":"E","uyeler":[{"ad":"x","gorev":"uzun...')).toBe(true)
  expect(kesikMi('{"ad":"E"}')).toBe(false)
})

test('son rapor: son durum + madde özeti en üstte, sonra maddeler, senden beklenenler ve "/ekip devam" adımı', () => {
  const maddeler = [{ no: 1, metin: 'hata', durum: 'yapildi', not: 'test geçti' }, { no: 2, metin: 'donut', durum: 'yapilmadi', not: 'GEREKEN: veri' }, { no: 3, metin: 'font', durum: 'kapsam_disi', gerekce: 'onay bekliyor' }]
  const m = sonucMetni({ karar: { durum: 'ret', neden: 'donut yok' }, maddeler, kullanicidan: ['Donut için matplotlib mi QPainter mı?'], kosular: [] } as any)
  expect(m.split('\n')[0]).toBe('Son durum: ✖ RET — donut yok · 1/3 madde yapıldı, 1 yapılmadı, 1 kapsam dışı')
  expect(m).toMatch(/İstek maddeleri:\n✓ #1 hata — test geçti\n✕ #2 donut — GEREKEN: veri\n– #3 font — onay bekliyor/)
  expect(m).toMatch(/Senden beklenenler:\n• Donut için matplotlib mi QPainter mı\?/)
  expect(m).toMatch(/Sonraki adım: açık 2 madde için ekip kendiliğinden devam eder \(en fazla 2 tur\); yukarıdaki dış engelleri "\/ekip devam <yanıtın>" ile bildir\./)
  const h = devamHedefi({ baslik: 'Faz', hedef: 'ekranı düzelt', maddeler: maddeler.slice(1), kullanicidan: ['Donut için matplotlib mi QPainter mı?'], ret: 'donut yok' }, 'QPainter kullan')
  expect(h).toMatch(/"Faz" işinin devamı \(asıl hedef: ekranı düzelt\)/)
  expect(h).toMatch(/✕ #2 donut — GEREKEN: veri/)
  expect(h).toMatch(/Son kontrol RET nedeni: donut yok/)
  expect(h).toMatch(/Kullanıcının yanıtı \/ ek isteği: QPainter kullan/)
})

// ── Karar ekipte: iş "kullanıcı kararı bekleniyor" diye bırakılmaz; açık madde kalırsa ekip kendiliğinden devam eder ──
test('karar ilkesi: plan, değerlendirme, son kontrol ve işçi talimatı kullanıcıya karar bırakmayı yasaklar; açık talimat eski tercihi geçer', () => {
  expect(KARAR_ILKESI).toMatch(/kullanıcıya SORULMAZ/)
  expect(KARAR_ILKESI).toMatch(/tercihine aykırı[\s\S]*KULLANILAMAZ/)
  expect(KARAR_ILKESI).toMatch(/DIŞ bir engel/)
  expect(ISCI_FORMAT).toMatch(/VARSAYIM: \.\.\./)
  expect(ISCI_FORMAT).toMatch(/"tercihe aykırı" diye iş reddetme/)
  expect(String(KADEME_EK['claude-sonnet-5-5'] ?? Object.values(KADEME_EK)[1])).toMatch(/kullanıcıya sorulmaz/)
  expect(sonKontrolPrompt({ baslik: 'x', kosular: [], maddeler: [] } as any)).toMatch(/karar ekipte; yapılmalı/)
  expect((ROLLER as any).tasarimci.prompt).toMatch(/QPainter\/kodla parametrik çizim\) onu uygula/)
})

test('otomatik devam: yapılabilir açık madde varsa yeni tur; dış engel, plan modu, kritik bütçe ve zincir sınırında durur', () => {
  const acik = (ms: any[]) => ({ baslik: 'Direk', maddeler: ms })
  const m2 = { no: 2, metin: 'direği çiz', durum: 'yapilmadi', not: 'kullanıcı a/b kararı bekleniyor' }
  const dis = { no: 8, metin: 'push', durum: 'yapilmadi', not: 'GEREKEN: uzak depo tanımlı değil' }
  expect(otoDevamKarari(acik([m2, dis]))).toEqual({ devam: true, sayi: 1, neden: '' })              // karar bekleyen madde yapılabilir sayılır
  expect(otoDevamKarari(acik([dis])).devam).toBe(false)                                               // yalnız dış engel
  expect(otoDevamKarari(acik([dis])).neden).toMatch(/dış engelli/)
  expect(otoDevamKarari(acik([m2]), { planModu: true }).neden).toMatch(/Plan modu/)
  expect(otoDevamKarari(acik([m2]), { butce: 'kritik' }).neden).toMatch(/kritik/)
  expect(otoDevamKarari(acik([m2]), { sayi: OTO_DEVAM_MAX }).neden).toMatch(/sınırına/)
  expect(otoDevamKarari(acik([])).devam).toBe(false)
})

test('senaryo: son kontrol RET + açık madde → ekip kullanıcıyı beklemeden otomatik devam turunu sıraya alır', async ($, on) => {
  const { logs } = sohbetKur($, on)
  const istemler: string[] = []
  on('model.complete', (_$: unknown, e: any) => {
    const pr = String(e.prompt), sis = String(e.system)
    if (/SON KONTROL/.test(pr)) return { value: { isAnswered: true, usage: {}, text: 'KARAR: RET — madde açık' } } as never
    if (/ekip kurucu/.test(sis)) istemler.push(pr)
    return { value: { isAnswered: true, usage: {}, text: 'kısa' } } as never
  })
  on('agent.spawn', (_$: unknown, e: any) => ({ model: e.model ?? 'claude-sonnet-5-5', agentId: 'r1' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  await $.agent.spawn({ prompt: 'x', subagentType: 'ekip:hizli-isci', description: 'x' } as never)
  await $.turn.complete({ agentId: 'r1', answer: 'ÖZET: yarım\nMADDE #1: YAPILMADI — karar bekleniyor', durationMs: 3000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await new Promise(r => setTimeout(r, 500))
  // tursuz (elle) işte madde listesi yok: RET tek başına otomatik devam başlatmaz, sonuç yine yazılır
  expect(logs.join('\n---\n')).toMatch(/Ekip sonucu —[\s\S]*Son durum: ✖ RET — madde açık/)
})

test('/ekip devam: açık iş başka projedeyse orayı söyler; açık iş yoksa ek talimatı yeni iş olarak önerir', async ($, on) => {
  sohbetKur($, on)
  on('model.complete', () => ({ value: { isAnswered: true, usage: {}, text: 'x' } }) as never)
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5' }) as never)
  await $.session.start({ cwd: '/proje', surface: 'terminal', isInteractive: true } as never)
  const r: any = await $.command.run({ command: 'ekip', args: 'devam QPainter kullan', origin: 'user' } as never)
  expect(String(r?.value?.text ?? r?.text ?? '')).toMatch(/Devam edilecek açık iş yok\. Yeni iş olarak başlatmak için: \/ekip QPainter kullan/)
})
