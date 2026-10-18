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
// The session's effort: from settings on the first draw, from /effort and /model,
// and from each main-loop request, which is what the model actually got
let effort = null
let isEffortRead = false

// "claude-opus-5-5" -> "Opus 5.5", anything else as given
function modelName(id) {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(id)
  if (!m) return id
  return m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] + (m[3] ? '.' + m[3] : '')
}

// The saved default for the session's model, as /effort and /model leave it
async function effortFromSettings($) {
  try {
    const model = await $.session.model()
    const s = await $.settings.read()
    return s.modelSettings?.[model]?.effortLevel ?? s.effortLevel ?? null
  } catch {
    return null
  }
}

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

  // Each request the main loop sends carries the effort it asks for
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId && e.effort !== undefined && e.effort !== effort) {
      effort = e.effort
      $.ui.invalidate('ui.render')
    }
    return yield* next(e)
  })

  // A session-only /effort is never saved, so read the level off its answer
  on('command.run', { command: 'effort' }, async ($, e, next) => {
    const r = await next(e)
    const m = /effort level to (low|medium|high|xhigh|max)\b/i.exec(r?.text ?? '')
    effort = m ? m[1].toLowerCase() : await effortFromSettings($)
    $.ui.invalidate('ui.render')
    return r
  })

  // Each model keeps its own saved effort
  on('command.run', { command: 'model' }, async ($, e, next) => {
    const r = await next(e)
    effort = await effortFromSettings($)
    $.ui.invalidate('ui.render')
    return r
  })

  on('command.run', { command: 'usage-panel' }, async ($) => {
    await setHidden($, !isHidden)
    return { text: isHidden ? '사용량 줄을 껐어요. /usage-panel 로 다시 켤 수 있어요.' : '사용량 줄을 켰어요.' }
  })

  // One row in the band above the prompt
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    if (isHidden) {
      return Box({
        marginTop: 1,
        children: [Button({ key: 'show', label: '사용량 보기', plain: true, dimColor: true, onPress: () => setHidden($, false) })],
      })
    }
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
    if (!isEffortRead) {
      isEffortRead = true
      effort = effort ?? (await effortFromSettings($))
    }
    const model = modelName(await $.session.model())
    const items = [
      Text({ children: [model + (effort !== null ? ' · ' + effort : '')] }),
      meter('context', '컨텍스트', context.percent ?? 0),
    ]
    for (const r of rateLimits) {
      items.push(meter('rl-' + r.kind, LABELS[r.kind] || r.kind, r.percentUsed, untilReset(r.resetsAt, now)))
    }
    if (cost) items.push(Text({ children: ['$' + cost.usd.toFixed(2)] }))
    items.push(Button({ key: 'hide', label: '끄기', plain: true, dimColor: true, onPress: () => setHidden($, true) }))

    // One blank row above, matching the gap Claude Code leaves below the band
    return Box({ flexDirection: 'row', columnGap: 3, marginTop: 1, children: items })
  })
}
