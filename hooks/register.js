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

export function register(on) {
  on('session.start', async ($, e, next) => {
    // Keep the reset countdowns current between measurements
    $.clock.every(60000, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  // Pushed after each turn and when a rate-limit window moves a point
  on('session.measure', async ($, e, next) => {
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // One row in the band above the prompt
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
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

    // One blank row above, matching the gap Claude Code leaves below the band
    return Box({ flexDirection: 'row', columnGap: 3, marginTop: 1, children: items })
  })
}
