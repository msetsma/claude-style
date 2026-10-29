import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderSurface } from 'claude-code'

import { DEFAULTS, OPTIONS, cleanLabel, duration, loadSettings, outputText, paint, rule, target, toolColor } from '../hooks/register'
import { LIST, listProps } from '../hooks/pane'
import type { StyleSettings } from '../types'

const SURFACES = ['terminal', 'desktop'] as const

// The plugin's `$.store`, held in `saved` so the test can read back what it wrote.
function memoryStore(on: On) {
  const saved: Record<string, unknown> = {}
  on('store.set', ($, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  on('store.get', ($, e) => ({ value: saved[e.key] }))
  return saved
}

// The engine's own drawing, beneath every plugin: what `next(e)` reaches in a session.
function engineBeneath(on: On) {
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
}

const PANE = {
  plugin: 'style',
  component: 'Pane',
  requestId: 'style',
  props: { title: 'Style', isFocused: true, bodyColumns: 52, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

// Sets options through the pane, as the person does: picks each row's value, or types its label.
async function configure($: Engine, change: Partial<StyleSettings>, saved: Record<string, unknown>) {
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  for (const [k, v] of Object.entries(change)) {
    const key = k as keyof StyleSettings
    if ('text' in OPTIONS[key]) await pane.post({ key, text: String(v) }, { in: LIST })
    else
      for (let i = 0; i < 12; i++) {
        const now = (saved.settings as StyleSettings | undefined)?.[key] ?? DEFAULTS[key]
        if (now === v) break
        await pane.post({ key, step: 1 }, { in: LIST })
      }
  }
  await pane.unmount()
}

const texts = async (ui: { findAll: (q: { type: string }) => Promise<{ text: string }[]> }) =>
  (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')

const ENGINE = { type: 'engine' }

test('loads settings over the defaults, per key, ignoring garbage', () => {
  expect(loadSettings(undefined)).toEqual(DEFAULTS)
  expect(loadSettings('nope')).toEqual(DEFAULTS)
  expect(loadSettings({ border: 'double', accent: 'hotpink', toolStyle: 'card', bogus: 1 })).toEqual({
    ...DEFAULTS,
    border: 'double',
    toolStyle: 'card',
  })
  // Earlier versions turned a site off in its style row: read as handing it to Claude Code.
  expect(loadSettings({ toolStyle: 'off', hintColor: 'original', bandFrame: 'off' })).toEqual({ ...DEFAULTS, tools: 'claude', hint: 'claude', bands: 'claude' })
})

test('helpers: durations, rules, call targets, result text, tool colors', () => {
  expect(duration(3000)).toBe('3s')
  expect(duration(64000)).toBe('1m 4s')
  expect(duration(3_720_000)).toBe('1h 2m')
  expect(rule('Baked 3s', 30)).toBe(`──── Baked 3s ${'─'.repeat(16)}`)
  expect(target({ command: 'ls -la\nsecond' })).toBe('ls -la')
  expect(target({ file_path: '/a.ts', limit: 3 })).toBe('/a.ts')
  expect(outputText({ stdout: 'a\nb', stderr: '' })).toBe('a\nb')
  expect(outputText([{ type: 'text', text: 'hi' }])).toBe('hi')
  expect(outputText({ structuredPatch: [] })).toBeUndefined()
  expect(toolColor(DEFAULTS, 'Bash', false, false)).toBe('bashBorder')
  expect(toolColor(DEFAULTS, 'mcp__x__y', false, false)).toBe('ide')
  expect(toolColor(DEFAULTS, 'Weird', false, false)).toBe('subtle')
  expect(toolColor({ ...DEFAULTS, toolColor: 'status' }, 'Bash', true, false)).toBe('warning')
  expect(toolColor({ ...DEFAULTS, toolColor: 'status' }, 'Bash', false, true)).toBe('error')
  expect(toolColor({ ...DEFAULTS, toolColor: 'mono', accent: 'ide' }, 'Bash', false, false)).toBe('ide')
})

test('/style opens the settings pane', async ($, on) => {
  const opened: string[] = []
  on('ui.open', ($, e) => {
    opened.push(e.id)
    expect(e).toMatchObject({ backgroundColor: 'transparent' })
    return { value: { isPlaced: true as const } }
  })
  const ran = await $.command.run({
    command: 'style',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })
  expect(ran).toMatchObject({ text: 'Style settings opened.' })
  expect(opened).toEqual(['style'])
})

test('down moves to a row, right and left step its value, saved and redrawn; Reset restores the defaults', async ($, on) => {
  const saved = memoryStore(on)
  const PROMPT_ROW = { plugin: 'style', component: 'UserMessage', props: { text: 'hi', origin: { kind: 'composer' }, isExpanded: true } } as const
  // The terminal's list is a Client that takes the keys; desktop draws the same list.
  for (const surface of SURFACES) {
    const pane = await $.ui.mount({ ...PANE, surface })
    const prompt = await $.ui.mount({ ...PROMPT_ROW, surface })
    expect(await prompt.drawn()).toMatchObject({ props: { borderStyle: 'round' } })

    // The cursor starts on Palette; down is Border.
    await pane.key({ key: 'down', in: LIST })
    await pane.key({ key: 'right', in: LIST })
    expect(saved.settings).toMatchObject({ border: 'single', palette: 'theme' })
    await pane.key({ key: 'right', in: LIST })
    await pane.key({ key: 'left', in: LIST })
    expect(saved.settings).toMatchObject({ border: 'single' })
    expect(await prompt.drawn()).toMatchObject({ props: { borderStyle: 'single' } })

    await pane.press({ key: 'reset' })
    expect(saved.settings).toEqual(DEFAULTS)
    expect(await prompt.drawn()).toMatchObject({ props: { borderStyle: 'round' } })
    // Up from the top stays there; left on Palette wraps to the last palette.
    await pane.key({ key: 'up', in: LIST })
    await pane.key({ key: 'up', in: LIST })
    await pane.key({ key: 'left', in: LIST })
    expect(saved.settings).toMatchObject({ palette: 'everforest' })
    await pane.press({ key: 'reset' })
    await prompt.unmount()
    await pane.unmount()
  }
})

test('the pane groups one row per option, with samples', async $ => {
  for (const surface of SURFACES) {
    const pane = await $.ui.mount({ ...PANE, surface })
    expect(await pane.find({ type: 'Select' })).toBeUndefined()
    expect(await pane.findAll({ type: 'Button' })).toHaveLength(3)
    const { rows } = listProps(DEFAULTS)
    const set = rows.flatMap(r => (r.kind === 'set' ? [r] : []))
    expect(set.map(r => r.key)).toEqual(expect.arrayContaining(Object.keys(DEFAULTS)))
    expect(set).toHaveLength(Object.keys(DEFAULTS).length)
    const heads = rows.flatMap(r => (r.kind === 'head' ? [r.title] : []))
    for (const title of ['Defaults', 'Tool calls', 'Turn time']) expect(heads).toContain(title)
    expect(set.find(r => r.key === 'durationStyle')?.sample).toEqual([{ text: '── Baked 3s ──', dim: true }])
    expect(await pane.find({ type: 'Client' })).toMatchObject({ props: { module: 'hooks/list.tsx' } })
    await pane.unmount()
  }
})

const userMessage = (surface: RenderSurface) =>
  ({
    plugin: 'style',
    surface,
    component: 'UserMessage',
    props: { text: 'hi there', origin: { kind: 'composer' }, isExpanded: true },
  }) as const

test('your prompts: bubble, bar, plain, or Claude Code\'s', async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(userMessage(surface))
    expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { borderStyle: 'round', borderColor: DEFAULTS.promptColor } })
    expect(await ui.find({ type: 'Text', text: 'hi there' })).toBeDefined()
    await ui.unmount()
  }
  await configure($, { promptStyle: 'bar', promptColor: 'claude' }, saved)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(userMessage(surface))
    expect(await ui.find({ type: 'Text', text: /^▎/ })).toMatchObject({ props: { color: 'claude' } })
    await ui.unmount()
  }
  await configure($, { promptStyle: 'plain' }, saved)
  const plain = await $.ui.mount(userMessage('terminal'))
  expect(await plain.find({ type: 'Text', text: '❯ ' })).toMatchObject({ props: { color: 'claude' } })
  await configure($, { prompts: 'claude' }, saved)
  const off = await $.ui.mount(userMessage('terminal'))
  expect(await off.drawn()).toMatchObject(ENGINE)
})

test('the band: framed only when a plugin drew there, which is told the narrower width', async ($, on) => {
  const saved = memoryStore(on)
  const widths: number[] = []
  // A plugin beneath that draws a band unless a turn is running.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    widths.push(e.props.bodyColumns)
    if (e.props.isWorking) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text>band</Text>
  })
  engineBeneath(on)
  const band = (surface: RenderSurface, isWorking: boolean) =>
    ({
      plugin: 'style',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 60, scroll: { offset: 0, bodyRows: 9 }, view: {} },
    }) as const
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(band(surface, false))
    expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { borderStyle: 'round', borderColor: DEFAULTS.accent } })
    expect(widths.at(-1)).toBe(58)
    const empty = await $.ui.mount(band(surface, true))
    expect(await empty.drawn()).toMatchObject(ENGINE)
  }
  await configure($, { bandBorder: 'double' }, saved)
  expect(await (await $.ui.mount(band('terminal', false))).drawn()).toMatchObject({ props: { borderStyle: 'double' } })
  await configure($, { bands: 'claude' }, saved)
  expect(await (await $.ui.mount(band('terminal', false))).drawn()).toMatchObject({ type: 'Text' })
})

const toolUse = (surface: RenderSurface, tool: string, extra: object = {}) =>
  ({
    plugin: 'style',
    surface,
    component: 'ToolUse',
    props: { tool_use_id: 't1', tool, input: { command: 'ls -la' }, isRunning: false, isErrored: false, isInterrupted: false, ...extra },
  }) as const

test("tool rows: our own Tool(target) line, no dot, by rail, card or compact; or Claude Code's", async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolUse(surface, 'Bash'))
    expect(await ui.find({ type: 'Text', text: /^▎/ })).toMatchObject({ props: { color: 'bashBorder' } })
    expect(await ui.find({ type: 'Text', text: /^Bash\(ls -la\)$/ })).toBeDefined()
    expect(JSON.stringify(await ui.drawn())).not.toMatch(/engine|⏺|●/)
    await ui.unmount()
  }
  await configure($, { toolStyle: 'card', toolColor: 'status' }, saved)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolUse(surface, 'Edit', { isRunning: true }))
    expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { borderStyle: 'round', borderColor: 'warning' } })
    await ui.unmount()
  }
  // The question tool's row draws nothing: no empty card around it.
  expect(await (await $.ui.mount(toolUse('terminal', 'AskUserQuestion'))).drawn()).toMatchObject(ENGINE)
  await configure($, { toolStyle: 'compact', toolColor: 'mono' }, saved)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolUse(surface, 'Bash'))
    expect(await texts(ui)).toContain('ls -la')
    expect(await ui.find({ type: 'Text', text: /^Bash$/ })).toMatchObject({ props: { color: DEFAULTS.accent } })
    await ui.unmount()
  }
  await configure($, { tools: 'claude' }, saved)
  expect(await (await $.ui.mount(toolUse('terminal', 'Bash'))).drawn()).toMatchObject(ENGINE)
  expect(await (await $.ui.mount(toolResult('terminal', 'x'))).drawn()).toMatchObject(ENGINE)
})

const toolResult = (surface: RenderSurface, output: unknown, isErrored = false) =>
  ({
    plugin: 'style',
    surface,
    component: 'ToolResult',
    props: { tool_use_id: 't1', tool: 'Bash', output, isErrored },
  }) as const

test('tool results: full beside the rail, a summary of the first line, or hidden; errors stay whole', async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  const OUT = { stdout: 'one\ntwo\nthree', stderr: '', interrupted: false }
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolResult(surface, OUT))
    expect(JSON.stringify(await ui.drawn())).toContain('"engine"')
    await ui.unmount()
  }
  await configure($, { toolResult: 'summary' }, saved)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolResult(surface, OUT))
    const shown = await texts(ui)
    expect(shown).toContain('⎿  one')
    expect(await ui.find({ key: 'fold:t1' })).toMatchObject({ props: { text: '[▸ +2 lines](#style-fold)' } })
    expect(shown).not.toContain('three')
    // A press opens the folded output, another folds it again.
    await ui.press({ key: 'fold:t1', link: { href: '#style-fold' } })
    expect(JSON.stringify(await ui.drawn())).toContain('"engine"')
    expect(await ui.find({ key: 'fold:t1' })).toMatchObject({ props: { text: '[▾ fold output](#style-fold)' } })
    await ui.press({ key: 'fold:t1', link: { href: '#style-fold' } })
    expect(await ui.find({ key: 'fold:t1' })).toMatchObject({ props: { text: '[▸ +2 lines](#style-fold)' } })
    await ui.unmount()
  }
  // ctrl+o's expanded view always shows the whole output.
  const expanded = await $.ui.mount({ ...toolResult('terminal', OUT), props: { ...toolResult('terminal', OUT).props, isExpanded: true } })
  expect(JSON.stringify(await expanded.drawn())).toContain('"engine"')
  await configure($, { toolResult: 'hidden', toolStyle: 'compact' }, saved)
  for (const surface of SURFACES) {
    const hidden = await $.ui.mount(toolResult(surface, OUT))
    expect(JSON.stringify(await hidden.drawn())).not.toContain('"engine"')
    expect(await hidden.find({ key: 'fold:t1' })).toMatchObject({ props: { text: '[▸ show output](#style-fold)' } })
    expect(await (await $.ui.mount(toolResult(surface, 'boom', true))).drawn()).toMatchObject(ENGINE)
  }
})

test('info notices: a dim line in the color, a card, or the engine', async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  // Raised on the terminal only.
  const notice = { plugin: 'style', surface: 'terminal', component: 'InfoNotice', props: { text: 'Model from settings', command: '/model' } } as const
  const line = await $.ui.mount(notice)
  expect(await line.find({ type: 'Text', text: /^Model from settings$/ })).toMatchObject({ props: { color: DEFAULTS.accent, dimColor: true } })
  expect(await line.find({ type: 'Text', text: /^ \/model$/ })).toBeDefined()
  await configure($, { noticeStyle: 'card', noticeColor: 'ide' }, saved)
  expect(await (await $.ui.mount(notice)).drawn()).toMatchObject({ type: 'Box', props: { borderStyle: 'round', borderColor: 'ide' } })
  await configure($, { notices: 'claude' }, saved)
  expect(await (await $.ui.mount(notice)).drawn()).toMatchObject(ENGINE)
})

test('the mode footer: solid pills, capped pills, brackets, plain; no modes is the engine', async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  const footer = (surface: RenderSurface, modes: string[]) => ({ plugin: 'style', surface, component: 'SessionMode', props: { modes } }) as const
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(footer(surface, ['focus', 'memory paused']))
    expect(await ui.find({ type: 'Text', text: /^ focus $/ })).toMatchObject({ props: { backgroundColor: DEFAULTS.modeColor, color: 'inverseText' } })
    expect(await (await $.ui.mount(footer(surface, []))).drawn()).toMatchObject(ENGINE)
    await ui.unmount()
  }
  await configure($, { modeStyle: 'caps' }, saved)
  const caps = await $.ui.mount(footer('terminal', ['focus']))
  expect(await caps.find({ type: 'Text', text: /^▐$/ })).toMatchObject({ props: { color: DEFAULTS.modeColor } })
  expect(await caps.find({ type: 'Text', text: /^focus$/ })).toMatchObject({ props: { backgroundColor: DEFAULTS.modeColor } })
  await configure($, { modeStyle: 'nerd' }, saved)
  expect(await (await $.ui.mount(footer('terminal', ['focus']))).find({ type: 'Text', text: /^\ue0b6$/ })).toBeDefined()
  await configure($, { modeStyle: 'brackets' }, saved)
  expect(await texts(await $.ui.mount(footer('desktop', ['focus'])))).toContain('[focus]')
  await configure($, { modeStyle: 'plain' }, saved)
  expect(await texts(await $.ui.mount(footer('terminal', ['a', 'b'])))).toContain(' · ')
  await configure($, { mode: 'claude' }, saved)
  expect(await (await $.ui.mount(footer('terminal', ['a']))).drawn()).toMatchObject(ENGINE)
})

test('the prompt hint: dim in the accent by default, recolored on request, Claude Code\'s when handed back', async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  const hint = (surface: RenderSurface) =>
    ({ plugin: 'style', surface, component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } }) as const
  expect(await (await $.ui.mount(hint('terminal'))).drawn()).toMatchObject({ type: 'Text', props: { color: DEFAULTS.accent, dimColor: true } })
  await configure($, { hint: 'claude' }, saved)
  expect(await (await $.ui.mount(hint('terminal'))).drawn()).toMatchObject(ENGINE)
  await configure($, { hint: 'style', hintColor: 'suggestion', hintDim: 'off' }, saved)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(hint(surface))
    expect(await ui.drawn()).toMatchObject({ type: 'Text', props: { color: 'suggestion', dimColor: false } })
    expect(JSON.stringify(await ui.drawn())).toContain('? for shortcuts')
    await ui.unmount()
  }
})

test("the question dialog: the engine's own under a tab", async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  const dialog = (surface: RenderSurface) =>
    ({
      plugin: 'style',
      surface,
      component: 'AskUserQuestion',
      viewport: { columns: 40, rows: 20 },
      props: { tool: 'AskUserQuestion', questions: [] as unknown[] },
    }) as const
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(dialog(surface))
    expect(JSON.stringify(await ui.drawn())).toContain('"engine"')
    expect(await ui.find({ type: 'Text', text: '╭─ Question ─╮' })).toMatchObject({ props: { color: 'permission' } })
    await ui.unmount()
  }
  await configure($, { questionFrame: 'double' }, saved)
  expect(await (await $.ui.mount(dialog('terminal'))).find({ type: 'Text', text: '╔═ Question ═╗' })).toBeDefined()
  await configure($, { questions: 'claude' }, saved)
  expect(await (await $.ui.mount(dialog('terminal'))).drawn()).toMatchObject(ENGINE)
})

test('turn duration: a rule across the width, compact, the engine, or nothing', async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  // Raised on the terminal only.
  const line = { plugin: 'style', surface: 'terminal', component: 'TurnDuration', viewport: { columns: 40, rows: 20 }, props: { word: 'Baked', durationMs: 64000 } } as const
  expect(await (await $.ui.mount(line)).find({ type: 'Text', text: rule('Baked 1m 4s', 38) })).toBeDefined()
  await configure($, { durationStyle: 'compact', durationVerb: 'off' }, saved)
  expect(await (await $.ui.mount(line)).find({ type: 'Text', text: '✻ 1m 4s' })).toBeDefined()
  await configure($, { turnTime: 'claude' }, saved)
  expect(await (await $.ui.mount(line)).drawn()).toMatchObject(ENGINE)
  await configure($, { turnTime: 'style', durationStyle: 'hidden' }, saved)
  expect(await (await $.ui.mount(line)).find({ type: 'Text' })).toBeUndefined()
})

test('Preview runs /style preview, whose row shows every site labeled, as the sites draw it', async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  const runs: unknown[] = []
  on('command.run', ($, e) => {
    runs.push({ command: e.command, args: e.args })
    return { text: '' }
  })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'preview' })
  expect(runs).toEqual([{ command: 'style', args: 'preview' }])
  await pane.unmount()

  const row = (surface: RenderSurface) =>
    ({ plugin: 'style', surface, component: 'CommandOutput', props: { command: 'style', args: 'preview', text: 'Style preview', isErrored: false } }) as const
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(row(surface))
    const shown = await texts(ui)
    for (const title of ['Your prompts', 'Plugin bands', 'Tool calls', 'Notices', 'Mode badge', 'Prompt hint', 'Questions', 'Turn time'])
      expect(shown).toContain(title)
    expect(JSON.stringify(await ui.drawn())).toContain(`"borderColor":"${DEFAULTS.promptColor}"`)
    expect(shown).toContain('── Baked 3s ──')
    await ui.unmount()
  }
  // Sites left to the engine show a stand-in, and the row follows the settings.
  await configure($, { prompts: 'claude', durationStyle: 'compact' }, saved)
  const shown = await texts(await $.ui.mount(row('terminal')))
  expect(shown).toContain('❯ fix the login bug')
  expect(shown).toContain('✻ Baked 3s')
  // Another command's output is the engine's.
  expect(await (await $.ui.mount({ ...row('terminal'), props: { ...row('terminal').props, args: '' } })).drawn()).toMatchObject(ENGINE)
})

test('a site handed to Claude Code dims its other rows to text; colors are numbered 1-9', async ($, on) => {
  const saved = memoryStore(on)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await texts(pane)).toContain('■9')
  const row = (s: StyleSettings, k: string) => listProps(s).rows.find(r => r.kind === 'set' && r.key === k)
  expect(row(DEFAULTS, 'modeColor')).toMatchObject({ value: '9', off: false })
  await pane.post({ key: 'tools', step: 1 }, { in: LIST })
  expect(saved.settings).toMatchObject({ tools: 'claude' })
  expect(row(saved.settings as StyleSettings, 'toolStyle')).toMatchObject({ off: true })
  // A step on a dim row, a label's step and a choice's text are dropped.
  await pane.post({ key: 'toolStyle', step: 1 }, { in: LIST })
  await pane.post({ key: 'promptLabel', step: 1 }, { in: LIST })
  await pane.post({ key: 'border', text: 'x' }, { in: LIST })
  await pane.post({ key: 'nope', step: 1 }, { in: LIST })
  expect(saved.settings).toMatchObject({ tools: 'claude', toolStyle: DEFAULTS.toolStyle, border: DEFAULTS.border })
  await pane.post({ key: 'tools', step: -1 }, { in: LIST })
  await pane.post({ key: 'toolStyle', step: -1 }, { in: LIST })
  expect(saved.settings).toMatchObject({ toolStyle: 'card' })
  await pane.unmount()
})

const reply = (surface: RenderSurface, isFirstOfReply = true) =>
  ({
    plugin: 'style',
    surface,
    component: 'AssistantMessage',
    props: { text: 'Fixed **it**.', isFirstOfReply },
  }) as const

test("replies: markdown in a card, beside a rail, or under a rule, named on a reply's first block; or Claude Code's", async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(reply(surface))
    expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { borderStyle: 'round', borderColor: DEFAULTS.replyColor } })
    expect(await ui.find({ type: 'Markdown' })).toMatchObject({ props: { text: 'Fixed **it**.' } })
    // The label sits in the card's top border: an absolute Box over the line.
    expect(await ui.find({ type: 'Text', text: ' Claude ' })).toBeDefined()
    expect(JSON.stringify(await ui.drawn())).toContain('"position":"absolute","top":-1')
    await ui.unmount()
    const more = await $.ui.mount(reply(surface, false))
    expect(await more.find({ type: 'Text', text: / ?Claude ?/ })).toBeUndefined()
    await more.unmount()
  }
  await configure($, { labels: 'inside', replyName: 'Opus' }, saved)
  expect(await (await $.ui.mount(reply('terminal'))).find({ type: 'Text', text: 'Opus' })).toBeDefined()
  await configure($, { replyWidth: 'fit' }, saved)
  expect(await (await $.ui.mount(reply('terminal'))).drawn()).toMatchObject({ props: { alignSelf: 'flex-start' } })
  await configure($, { replyStyle: 'rail', replyColor: 'ide' }, saved)
  const rail = await $.ui.mount(reply('terminal'))
  expect(await rail.find({ type: 'Text', text: /^▌/ })).toMatchObject({ props: { color: 'ide' } })
  await configure($, { replyStyle: 'rule', replyLabel: 'off' }, saved)
  const ruled = await $.ui.mount(reply('terminal'))
  expect(await ruled.find({ type: 'Text', text: /^─+$/ })).toBeDefined()
  expect(await ruled.find({ type: 'Text', text: 'Claude' })).toBeUndefined()
  await configure($, { replies: 'claude' }, saved)
  expect(await (await $.ui.mount(reply('terminal'))).drawn()).toMatchObject(ENGINE)
})

test('palettes: a built-in palette paints every slot and role in its own colors', async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  expect(paint(DEFAULTS, 'suggestion')).toBe('suggestion')
  expect(paint({ palette: 'nord' }, 'suggestion')).toBe('#81a1c1')
  await configure($, { palette: 'catppuccin' }, saved)
  const ui = await $.ui.mount(userMessage('terminal'))
  expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { borderColor: '#89b4fa' } })
  const tool = await $.ui.mount(toolUse('terminal', 'Bash'))
  expect(await tool.find({ type: 'Text', text: /^▎/ })).toMatchObject({ props: { color: '#f5c2e7' } })
  // The pane names the palette over its nine colors.
  expect(await texts(await $.ui.mount({ ...PANE, surface: 'terminal' }))).toContain('Catppuccin')
})

test('your prompts: right-aligned, labeled in the border, filled', async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  await configure($, { promptAlign: 'right', promptLabel: 'You', promptFill: 'surface', palette: 'nord' }, saved)
  const ui = await $.ui.mount(userMessage('terminal'))
  expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { alignSelf: 'flex-end', backgroundColor: '#3b4252' } })
  expect(await ui.find({ type: 'Text', text: ' You ' })).toBeDefined()
  await configure($, { promptFill: 'warning' }, saved)
  expect(await (await $.ui.mount(userMessage('terminal'))).find({ type: 'Text', text: 'hi there' })).toMatchObject({ props: { color: '#2e3440' } })
  await configure($, { promptStyle: 'bar' }, saved)
  const bar = await $.ui.mount(userMessage('terminal'))
  expect(await bar.drawn()).toMatchObject({ props: { justifyContent: 'flex-end' } })
  expect(await bar.find({ type: 'Text', text: /^▐/ })).toBeDefined()
})

test('labels: typed labels are kept to one short line', async ($, on) => {
  const saved = memoryStore(on)
  expect(cleanLabel('  a\nb\tc  ')).toBe('a b c')
  expect(cleanLabel('x'.repeat(40))).toHaveLength(24)
  await configure($, { bandLabel: 'plugins\n' }, saved)
  expect(saved.settings).toMatchObject({ bandLabel: 'plugins' })
  expect(loadSettings({ questionLabel: 7 })).toMatchObject({ questionLabel: 'Question' })
})

test("tool cards with border labels name the tool in the border; an expanded row is the engine's", async ($, on) => {
  const saved = memoryStore(on)
  engineBeneath(on)
  await configure($, { toolStyle: 'card' }, saved)
  const ui = await $.ui.mount(toolUse('terminal', 'Bash'))
  expect(await ui.find({ type: 'Text', text: ' Bash ' })).toBeDefined()
  expect(await texts(ui)).toContain('ls -la')
  expect(await (await $.ui.mount(toolUse('terminal', 'Bash', { isExpanded: true }))).drawn()).toMatchObject(ENGINE)
})

test('on a label row, typing edits the label and Enter saves it', async ($, on) => {
  const saved = memoryStore(on)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // Palette, four more defaults, then Your prompts: Drawn by, Style, Align, Color, Fill, Label.
  for (let i = 0; i < 10; i++) await pane.key({ key: 'down', in: LIST })
  for (const key of ['Y', 'o', 'x', 'backspace', 'u']) await pane.key({ key, in: LIST })
  // Left and right on a label row change nothing.
  await pane.key({ key: 'left', in: LIST })
  expect(saved.settings).toBeUndefined()
  await pane.key({ key: 'return', in: LIST })
  expect(saved.settings).toMatchObject({ promptLabel: 'You' })
  await pane.unmount()
})
