const LABELS = { five_hour: '5시간', seven_day: '주간', spend_limit: '지출' }
const BAR = 8

// 0-100 as a bar of BAR cells
function bar(percent) {
  const filled = Math.max(0, Math.min(BAR, Math.round((percent / 100) * BAR)))
  return '█'.repeat(filled) + '░'.repeat(BAR - filled)
}

function colorFor(percent) {
  return percent >= 90 ? 'red' : percent >= 70 ? 'yellow' : 'green'
}

// "2h13m" from an ISO timestamp
function untilReset(iso, now) {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  const h = Math.floor(mins / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return d + 'd' + (h % 24) + 'h'
  if (h > 0) return h + 'h' + (mins % 60) + 'm'
  return mins + 'm'
}

// Whether the person turned the band off; kept in $.store across sessions
let isHidden = false

async function setHidden($, value) {
  isHidden = value
  await $.store.set('hidden', value)
  $.ui.invalidate('ui.render')
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'usage-panel', description: '사용량 줄 켜기/끄기' })
    isHidden = (await $.store.get('hidden')) === true
    // Keep the reset countdowns current between measurements
    $.clock.every(60000, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  // Pushed after each turn and when a rate-limit window moves a point
  on('session.measure', async ($, e, next) => {
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('command.run', { command: 'usage-panel' }, async ($) => {
    await setHidden($, !isHidden)
    return { text: isHidden ? '사용량 줄을 껐어요. /usage-panel 로 다시 켤 수 있어요.' : '사용량 줄을 켰어요.' }
  })

  // One row in the band above the prompt
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isHidden || e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    // The plain call costs nothing, so read it fresh on each draw
    const usage = await $.session.usage()
    const now = await $.clock.now()

    const meter = (key, label, percent, extra) =>
      Box({
        key,
        flexDirection: 'row',
        columnGap: 1,
        children: [
          Text({ dimColor: true, children: [label] }),
          Text({ color: colorFor(percent), children: [bar(percent)] }),
          Text({ children: [Math.round(percent) + '%' + (extra ? ' (' + extra + ')' : '')] }),
        ],
      })

    const { context, rateLimits = [], cost } = usage
    const items = [meter('context', '컨텍스트', context.percent ?? 0)]
    for (const r of rateLimits) {
      items.push(meter('rl-' + r.kind, LABELS[r.kind] || r.kind, r.percentUsed, untilReset(r.resetsAt, now)))
    }
    if (cost) items.push(Text({ children: ['$' + cost.usd.toFixed(2)] }))
    items.push(Button({ key: 'hide', label: '끄기', plain: true, dimColor: true, onPress: () => setHidden($, true) }))

    // One blank row above, matching the gap Claude Code leaves below the band
    return Box({ flexDirection: 'row', columnGap: 3, marginTop: 1, children: items })
  })
}
