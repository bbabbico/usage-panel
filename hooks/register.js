const PANE = 'usage-panel'

// The last figures Claude Code measured, and whether the pane is open
let usage = null
let isOpen = false

const LABELS = { five_hour: '5시간 한도', seven_day: '주간 한도', spend_limit: '지출 한도' }

// 0-100 as a bar of `width` cells
function bar(percent, width) {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function colorFor(percent) {
  return percent >= 90 ? 'red' : percent >= 70 ? 'yellow' : 'green'
}

// "2시간 13분 후" from an ISO timestamp
function untilReset(iso, now) {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  const h = Math.floor(mins / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return d + '일 ' + (h % 24) + '시간 후 리셋'
  if (h > 0) return h + '시간 ' + (mins % 60) + '분 후 리셋'
  return mins + '분 후 리셋'
}

function compact(n) {
  return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n)
}

async function openPane($) {
  await $.ui.open({ id: PANE, title: '사용량' })
  isOpen = true
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'usage-panel', description: '사용량 패널 열기/닫기' })
    usage = await $.session.usage()
    await openPane($)
    // Keep the reset countdowns current between measurements
    $.clock.every(60000, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  // Pushed after each turn and when a rate-limit window moves a point
  on('session.measure', async ($, e, next) => {
    usage = { context: e.context, rateLimits: e.rateLimits, cost: e.cost }
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('command.run', { command: 'usage-panel' }, async ($) => {
    if (isOpen) {
      await $.ui.close({ id: PANE })
      isOpen = false
    } else {
      await openPane($)
    }
    return {}
  })

  // The user can close the pane themselves too
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) isOpen = false
    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const width = Math.max(10, Math.min(30, (e.props.bodyColumns || 30) - 8))
    const now = $.clock.now()

    // One labelled bar, with a dim detail line under it
    const meter = (key, label, percent, detail) =>
      Box({
        key,
        flexDirection: 'column',
        children: [
          Text({ children: [label] }),
          Box({
            flexDirection: 'row',
            columnGap: 1,
            children: [
              Text({ color: colorFor(percent), children: [bar(percent, width)] }),
              Text({ children: [percent.toFixed(0) + '%'] }),
            ],
          }),
          ...(detail ? [Text({ dimColor: true, children: [detail] })] : []),
        ],
      })

    if (!usage) return Text({ dimColor: true, children: ['측정 대기 중…'] })

    const { context, rateLimits = [], cost } = usage
    const rows = []

    const ctxPercent = context.percent ?? 0
    rows.push(
      meter(
        'context',
        '컨텍스트',
        ctxPercent,
        context.tokens != null ? compact(context.tokens) + ' / ' + compact(context.window) + ' 토큰' : '첫 응답 후 표시',
      ),
    )

    for (const r of rateLimits) {
      rows.push(meter('rl-' + r.kind, LABELS[r.kind] || r.kind, r.percentUsed, untilReset(r.resetsAt, now)))
    }
    if (rateLimits.length === 0) {
      rows.push(Text({ dimColor: true, children: ['요금제 한도: 첫 응답 후 표시'] }))
    }

    if (cost) {
      rows.push(Text({ children: ['세션 비용 $' + cost.usd.toFixed(2)] }))
    }

    return Box({ flexDirection: 'column', rowGap: 1, children: rows })
  })
}
