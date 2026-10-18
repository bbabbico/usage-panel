import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 120 },
} as const

test('the band shows model, context, rate limits and cost in one row', async ($, on) => {
  mock.store(on)
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
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
    expect(await ui.find({ type: 'Text', text: 'Opus 5.5' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '42%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '23% (2h13m)' })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: '█'.repeat(7) + '░' }))?.props.color).toBe('red')
    expect(await ui.find({ type: 'Text', text: '$1.23' })).toBeDefined()
    await ui.unmount()
  }
})

test('끄기 leaves a 사용량 보기 button that brings the band back', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-haiku-4-5-20251001' }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 42 }, rateLimits: [] },
  }))

  const ui = await $.ui.mount({ plugin: 'usage-panel', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeDefined()

  expect(await ui.find({ type: 'Text', text: 'Haiku 4.5' })).toBeDefined()

  await ui.press({ key: 'hide' })
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeUndefined()
  await ui.press({ key: 'show' })
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeDefined()

  await $.command.run({ command: 'usage-panel', args: '' })
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeUndefined()
  await ui.unmount()
})

test('the band shows the effort the last main-loop request asked for', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 1 }, rateLimits: [] },
  }))
  // Stands for the model: answers the step and streams nothing
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [] }
  })

  const ui = await $.ui.mount({ plugin: 'usage-panel', surface: 'terminal', ...BAND })
  for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'claude-opus-5-5', effort: 'high', messageCount: 1 })) {
  }
  expect(await ui.find({ type: 'Text', text: 'Opus 5.5 · high' })).toBeDefined()
  await ui.unmount()
})
