import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 120 },
} as const

test('the band shows context, rate limits and cost in one row', async ($, on) => {
  const now = mock.clock(on, { now: Date.parse('2026-10-18T00:00:00Z') }).now()
  on('session.usage', () => ({
    value: {
      startedAt: now,
      context: { tokens: 84000, window: 200000, percent: 42 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 23, resetsAt: new Date(now + 133 * 60000).toISOString() },
        { kind: 'seven_day', percentUsed: 91 },
      ],
      cost: { usd: 1.234 },
    },
  }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-panel', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: '42%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '23% (2h13m)' })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: '█'.repeat(7) + '░' }))?.props.color).toBe('red')
    expect(await ui.find({ type: 'Text', text: '$1.23' })).toBeDefined()
    await ui.unmount()
  }
})

test('the 끄기 button hides the band and /usage-panel brings it back', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  // Stands for the engine's own empty band when the mod yields
  on('ui.render', ($, e) => $.ui.resolve(e).Box({ key: 'engine' }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 42 }, rateLimits: [] },
  }))

  const ui = await $.ui.mount({ plugin: 'usage-panel', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeDefined()

  await ui.press({ key: 'hide' })
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeUndefined()

  await $.command.run({ command: 'usage-panel', args: '' })
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeDefined()
  await ui.unmount()
})
