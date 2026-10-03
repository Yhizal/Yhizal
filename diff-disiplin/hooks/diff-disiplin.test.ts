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
