import { atom, read, update } from 'claude-code'
import type { Color, Elements, EngineInterface, Register, RenderElement, RenderNode, RenderSurface, ThemeKey } from 'claude-code'

import type { Accent, Border, StyleSettings as Settings } from '../types'

const PANE = 'style'

// A border takes one column each side.
const BORDER = 2

// Colors are theme keys, so every style follows the person's light or dark theme.
const BORDERS: Border[] = ['round', 'single', 'double', 'bold', 'dashed', 'classic']
const ACCENTS: Accent[] = ['subtle', 'claude', 'suggestion', 'promptBorder', 'permission', 'success', 'warning', 'ide', 'planMode']
const SITE_BORDERS = ['global', ...BORDERS] as const
const SITE_COLORS = ['global', ...ACCENTS] as const

export const DEFAULTS: Settings = {
  border: 'round',
  accent: 'claude',
  density: 'normal',
  promptStyle: 'bubble',
  promptColor: 'suggestion',
  bandFrame: 'on',
  bandBorder: 'global',
  toolStyle: 'rail',
  toolColor: 'tool',
  toolResult: 'full',
  noticeStyle: 'line',
  noticeColor: 'global',
  modeStyle: 'pills',
  modeColor: 'planMode',
  hintColor: 'global',
  hintDim: 'on',
  questionFrame: 'global',
  questionColor: 'permission',
  durationStyle: 'rule',
  durationVerb: 'on',
}

type Key = keyof Settings
// Each option: its row label and the values a press cycles through.
export const OPTIONS: { [K in Key]: { label: string; values: readonly Settings[K][] } } = {
  border: { label: 'Border', values: BORDERS },
  accent: { label: 'Color', values: ACCENTS },
  density: { label: 'Spacing', values: ['compact', 'normal', 'roomy'] },
  promptStyle: { label: 'Style', values: ['bubble', 'bar', 'plain', 'off'] },
  promptColor: { label: 'Color', values: SITE_COLORS },
  bandFrame: { label: 'Frame', values: ['on', 'off'] },
  bandBorder: { label: 'Border', values: SITE_BORDERS },
  toolStyle: { label: 'Style', values: ['card', 'rail', 'compact', 'off'] },
  toolColor: { label: 'Color by', values: ['tool', 'status', 'mono'] },
  toolResult: { label: 'Output', values: ['full', 'summary', 'hidden'] },
  noticeStyle: { label: 'Style', values: ['card', 'line', 'off'] },
  noticeColor: { label: 'Color', values: SITE_COLORS },
  modeStyle: { label: 'Style', values: ['pills', 'brackets', 'plain', 'off'] },
  modeColor: { label: 'Color', values: SITE_COLORS },
  hintColor: { label: 'Color', values: ['original', ...SITE_COLORS] },
  hintDim: { label: 'Dimmed', values: ['on', 'off'] },
  questionFrame: { label: 'Tab border', values: ['off', ...SITE_BORDERS] },
  questionColor: { label: 'Color', values: SITE_COLORS },
  durationStyle: { label: 'Style', values: ['rule', 'compact', 'original', 'hidden'] },
  durationVerb: { label: 'Show verb', values: ['on', 'off'] },
}
// Each group: its title, what it changes on screen, and its rows.
const GROUPS: [string, string, Key[]][] = [
  ['Defaults', 'used where a row says inherit', ['border', 'accent', 'density']],
  ['Your prompts', 'what you typed, in the transcript', ['promptStyle', 'promptColor']],
  ['Plugin bands', 'rows other mods draw above the prompt', ['bandFrame', 'bandBorder']],
  ['Tool calls', 'Write, Edit and other tool rows', ['toolStyle', 'toolColor', 'toolResult']],
  ['Notices', 'system notes in the transcript', ['noticeStyle', 'noticeColor']],
  ['Mode badge', 'the plan or auto mode label', ['modeStyle', 'modeColor']],
  ['Prompt hint', 'the line under the prompt', ['hintColor', 'hintDim']],
  ['Questions', 'the dialog Claude asks you in', ['questionFrame', 'questionColor']],
  ['Turn time', 'the "Baked for 3s" line', ['durationStyle', 'durationVerb']],
]

// What the pane calls a stored value. Colors are named for what they mean in the theme, not
// what they look like, so the names hold under any theme, custom ones included; the swatch
// beside each shows the color the person's theme gives it.
const NAMES: Record<string, string> = {
  global: 'inherit',
  original: 'unchanged',
  subtle: 'muted',
  claude: 'brand',
  suggestion: 'suggestion',
  promptBorder: 'prompt',
  permission: 'permission',
  success: 'success',
  warning: 'warning',
  ide: 'ide',
  planMode: 'plan mode',
}
export const shown = (v: string) => NAMES[v] ?? v

// A row whose value changes nothing while another row turns its site off is drawn dim.
const INACTIVE: Partial<Record<Key, (s: Settings) => boolean>> = {
  promptColor: s => s.promptStyle === 'off',
  bandBorder: s => s.bandFrame === 'off',
  toolColor: s => s.toolStyle === 'off',
  toolResult: s => s.toolStyle === 'off',
  noticeColor: s => s.noticeStyle === 'off',
  modeColor: s => s.modeStyle === 'off',
  hintDim: s => s.hintColor === 'original',
  questionColor: s => s.questionFrame === 'off',
  durationVerb: s => s.durationStyle === 'original' || s.durationStyle === 'hidden',
}
const KEYS = Object.keys(OPTIONS) as Key[]

// Padding inside a frame and the blank row above it.
const SPACING: Record<Settings['density'], { padX: number; marginTop: number }> = {
  compact: { padX: 0, marginTop: 0 },
  normal: { padX: 1, marginTop: 1 },
  roomy: { padX: 2, marginTop: 1 },
}

// Tool families and the color each draws in when coloring by tool.
const TOOL_COLORS: [RegExp, ThemeKey][] = [
  [/^Bash$/, 'bashBorder'],
  [/^(Edit|MultiEdit|Write|NotebookEdit)$/, 'claude'],
  [/^(Read|Grep|Glob|LS)$/, 'suggestion'],
  [/^mcp__/, 'ide'],
  [/^(Agent|Task)$/, 'planMode'],
]

// Tools the dialog stands for: their row draws nothing, and a card around it would be empty.
const BARE = /^AskUserQuestion$/

const settings = atom({ plugin: 'style', key: 'settings' } as const, DEFAULTS)

const cycle = <T,>(list: readonly T[], value: T) => list[(list.indexOf(value) + 1) % list.length] as T

/** Stored settings over the defaults; anything unknown or malformed falls back per key. */
export function loadSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const s = { ...DEFAULTS } as Record<Key, unknown>
  for (const k of KEYS) if ((OPTIONS[k].values as readonly unknown[]).includes(r[k])) s[k] = r[k]
  return s as Settings
}

const borderOf = (s: Settings, v: 'global' | Border) => (v === 'global' ? s.border : v)
const colorOf = (s: Settings, v: 'global' | Accent): ThemeKey => (v === 'global' ? s.accent : v)

export function toolColor(s: Settings, tool: string, running: boolean, errored: boolean): ThemeKey {
  if (s.toolColor === 'mono') return s.accent
  if (s.toolColor === 'status') return errored ? 'error' : running ? 'warning' : 'success'
  return TOOL_COLORS.find(([re]) => re.test(tool))?.[1] ?? 'subtle'
}

/** The engine's own format: `3s`, `1m 4s`, `1h 2m`. */
export function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

/** `──── label ────` across `columns`. */
export function rule(label: string, columns: number): string {
  return `──── ${label} ${'─'.repeat(Math.max(4, columns - label.length - 6))}`
}

/** A one-line description of a call's input: its command, path, pattern or first string. */
export function target(input: unknown): string {
  const o = (input ?? {}) as Record<string, unknown>
  const v = ['command', 'file_path', 'path', 'pattern', 'url', 'description', 'prompt'].map(k => o[k]).find(x => typeof x === 'string')
  return String(v ?? Object.values(o).find(x => typeof x === 'string') ?? '').split('\n')[0] ?? ''
}

/** The text of a tool's result where its shape is a known one; undefined for anything else (a diff, a file read). */
export function outputText(output: unknown): string | undefined {
  if (typeof output === 'string') return output
  const o = (output ?? {}) as Record<string, unknown>
  if (typeof o.stdout === 'string') return [o.stdout, o.stderr].filter(Boolean).join('\n')
  if (typeof o.content === 'string') return o.content
  if (Array.isArray(o.filenames)) return o.filenames.join('\n')
  // An MCP result: a list of content blocks.
  if (Array.isArray(output)) return output.map(b => (b as { text?: unknown })?.text).filter(t => typeof t === 'string').join('\n')
  return undefined
}

async function changeSettings($: EngineInterface, change: (s: Settings) => Settings) {
  await $.store.set('settings', await update($, settings, change))
}

// Each border's corner and line glyphs: the settings samples and the question dialog's tab.
const BORDER_SAMPLES: Record<Border, string> = {
  round: '╭─╮',
  single: '┌─┐',
  double: '╔═╗',
  bold: '┏━┓',
  dashed: '┌╌┐',
  classic: '+-+',
}
const SAMPLES: Partial<Record<Key, Record<string, string>>> = {
  density: { compact: '│hi│', normal: '│ hi │', roomy: '│  hi  │' },
  bandFrame: { off: 'no frame' },
  promptStyle: { bubble: '╭ ❯ hi ╮', bar: '▎ hi', plain: '❯ hi', off: 'as Claude draws it' },
  toolStyle: { card: '╭ ⏺ Edit ╮', rail: '▎⏺ Edit', compact: '● Edit a.ts', off: 'as Claude draws it' },
  toolColor: { mono: 'one color' },
  toolResult: { full: '⎿ every line', summary: '⎿ first lines …', hidden: 'errors only' },
  noticeStyle: { card: '╭ note ╮', line: 'note /cmd', off: 'as Claude draws it' },
  modeStyle: { brackets: '[auto]', plain: 'auto', off: 'as Claude draws it' },
  questionFrame: { off: 'no tab' },
  hintColor: { original: 'as Claude draws it' },
  durationStyle: { rule: '── Baked 3s ──', compact: '✻ 3s', original: '✻ Baked for 3s', hidden: 'nothing' },
  durationVerb: { on: 'Baked 3s', off: '3s' },
}

// A colored glyph column beside `body`, as tall as it: an absolute Box spanning the row, its long
// text clipped to that height. `top` skips rows the body opens with (the engine's blank line).
function railed({ Box, Text }: Pick<Elements[RenderSurface], 'Box' | 'Text'>, color: Color, glyph: string, body: RenderElement, top = 0) {
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box position="absolute" top={top} bottom={0} left={0} width={1} overflow="hidden">
        <Text color={color}>{`${glyph}\n`.repeat(400)}</Text>
      </Box>
      {body}
    </Box>
  )
}

type Els = Elements[RenderSurface]
// What the engine draws at a site, produced only when asked for.
type Inner = () => Promise<RenderElement>

// Your own prompts: a rounded bubble sized to the text, a colored rail, or a plain colored ❯.
function drawPrompt(els: Els, s: Settings, text: string) {
  if (s.promptStyle === 'off') return undefined
  const { Box, Text } = els
  const color = colorOf(s, s.promptColor)
  const { padX, marginTop } = SPACING[s.density]
  if (s.promptStyle === 'bar') return <Box marginTop={marginTop}>{railed(els, color, '▎', <Text>{text}</Text>)}</Box>
  if (s.promptStyle === 'plain')
    return (
      <Box marginTop={marginTop}>
        <Text color={color}>❯ </Text>
        <Text>{text}</Text>
      </Box>
    )
  return (
    <Box borderStyle={s.border} borderColor={color} paddingX={padX} marginTop={marginTop} alignSelf="flex-start">
      <Text color={color}>❯ </Text>
      <Text>{text}</Text>
    </Box>
  )
}

// A frame around what other plugins drew above the prompt.
function drawBand({ Box }: Els, s: Settings, inner: RenderElement) {
  return (
    <Box borderStyle={borderOf(s, s.bandBorder)} borderColor={s.accent} flexDirection="column">
      {inner}
    </Box>
  )
}

// A tool call's row: the engine's drawing in a card or beside a rail, or one line of our own.
async function drawTool(els: Els, s: Settings, call: { tool: string; input: unknown; isRunning: boolean; isErrored: boolean }, inner: Inner) {
  if (s.toolStyle === 'off') return undefined
  const { Box, Text } = els
  const color = toolColor(s, call.tool, call.isRunning, call.isErrored)
  if (s.toolStyle === 'compact')
    return (
      <Box marginTop={SPACING[s.density].marginTop}>
        <Text wrap="truncate">
          <Text color={color}>● </Text>
          <Text bold>{call.tool.replace(/^mcp__/, '')}</Text>
          <Text dimColor> {target(call.input)}</Text>
        </Text>
      </Box>
    )
  // The engine's row opens with a blank line: the rail starts below it, the card pulls it under its
  // top border and keeps the density's own gap above.
  if (s.toolStyle === 'rail') return railed(els, color, '▎', await inner(), 1)
  const { padX, marginTop } = SPACING[s.density]
  return (
    <Box borderStyle={s.border} borderColor={color} paddingX={padX} marginTop={marginTop} flexDirection="column">
      <Box marginTop={-1} flexDirection="column">
        {await inner()}
      </Box>
    </Box>
  )
}

// A tool's result: the engine's drawing (beside the call's rail), its first line, or nothing.
// An error always shows whole.
async function drawResult(els: Els, s: Settings, result: { tool: string; output: unknown; isErrored: boolean }, inner: Inner) {
  const { Box, Text } = els
  const glyph = s.toolStyle === 'rail' ? '▎' : s.toolStyle === 'card' ? '┆' : undefined
  const beside = (body: RenderElement) => (glyph ? railed(els, toolColor(s, result.tool, false, result.isErrored), glyph, body) : body)
  const text = outputText(result.output)
  if (s.toolResult === 'hidden' && !result.isErrored) return <Box />
  if (s.toolResult === 'summary' && !result.isErrored && text !== undefined) {
    const lines = text.trimEnd().split('\n')
    return beside(
      <Box flexDirection="column" paddingLeft={glyph ? 0 : 2}>
        <Text dimColor wrap="truncate">⎿  {lines[0] || '(no output)'}</Text>
        {lines.length > 1 ? <Text dimColor>   … +{lines.length - 1} lines</Text> : null}
      </Box>,
    )
  }
  return glyph ? beside(await inner()) : inner()
}

// The dim notices under the logo, after the engine's own `▎` mark: a card, or a dim line in the color.
function drawNotice({ Box, Text }: Els, s: Settings, text: string, command: string | null) {
  if (s.noticeStyle === 'off') return undefined
  const color = colorOf(s, s.noticeColor)
  const line = s.noticeStyle === 'line'
  const body = (
    <Text>
      <Text color={line ? color : undefined} dimColor>{text}</Text>
      {command ? <Text color={color} bold={line}> {command}</Text> : null}
    </Text>
  )
  if (line) return body
  return (
    <Box borderStyle={s.border} borderColor={color} paddingX={SPACING[s.density].padX} alignSelf="flex-start">
      {body}
    </Box>
  )
}

// The mode labels at the right of the footer, as pills, in brackets or plain.
function drawMode({ Text }: Els, s: Settings, modes: readonly string[]) {
  if (s.modeStyle === 'off') return undefined
  const color = colorOf(s, s.modeColor)
  const label = (m: string) =>
    s.modeStyle === 'pills' ? <Text inverse color={color}> {m} </Text> : <Text color={color}>{s.modeStyle === 'brackets' ? `[${m}]` : m}</Text>
  const gap = <Text dimColor>{s.modeStyle === 'plain' ? ' · ' : ' '}</Text>
  return <Text>{modes.flatMap((m, i) => (i ? [gap, label(m)] : [label(m)]))}</Text>
}

// The hint under the prompt, recolored; its text is the engine's.
function drawHint({ Text }: Els, s: Settings, hint: string, tail?: string | null) {
  if (s.hintColor === 'original') return undefined
  return (
    <Text color={colorOf(s, s.hintColor)} dimColor={s.hintDim === 'on'} wrap="truncate">
      {hint}
      {tail ? ` ${tail}` : ''}
    </Text>
  )
}

// The AskUserQuestion dialog, the engine's own and still live, under a tab in the frame's border
// and color that sits on the dialog's top divider. Only a tab above: the engine refuses a tree that
// draws below the dialog, and a border's side columns would wrap the dividers it draws full width.
async function drawQuestion({ Box, Text }: Els, s: Settings, inner: Inner) {
  if (s.questionFrame === 'off') return undefined
  const [left, line, right] = BORDER_SAMPLES[borderOf(s, s.questionFrame)]
  return (
    <Box flexDirection="column" marginTop={SPACING[s.density].marginTop}>
      <Text color={colorOf(s, s.questionColor)}>{`${left}${line} Question ${line}${right}`}</Text>
      {await inner()}
    </Box>
  )
}

// The line that closes a turn: a dim rule across the width, a short `✻ 3s`, or nothing.
function drawDuration({ Box, Text }: Els, s: Settings, word: string, ms: number, columns: number) {
  if (s.durationStyle === 'original') return undefined
  if (s.durationStyle === 'hidden') return <Box />
  const label = s.durationVerb === 'on' ? `${word} ${duration(ms)}` : duration(ms)
  const { marginTop } = SPACING[s.density]
  if (s.durationStyle === 'compact')
    return (
      <Box marginTop={marginTop}>
        <Text dimColor>✻ {label}</Text>
      </Box>
    )
  return (
    <Box marginTop={marginTop}>
      <Text color={s.accent} dimColor wrap="truncate">
        {rule(label, columns - 2)}
      </Text>
    </Box>
  )
}

// One labeled sample per site, the engine's part of each played by a dim stand-in.
async function drawPreview(els: Els, s: Settings, columns: number) {
  const { Box, Text } = els
  const plain = (text: string) => <Text dimColor>{text}</Text>
  // The engine's tool row opens with a blank line, as the rail and card expect.
  const call = (tool: string, input: Record<string, string>, isErrored = false) => {
    const row = async () => (
      <Box marginTop={1}>
        <Text>
          ⏺ <Text bold>{tool}</Text>({Object.values(input)[0]})
        </Text>
      </Box>
    )
    return drawTool(els, s, { tool, input, isRunning: false, isErrored }, row).then(r => r ?? row())
  }
  const result = (tool: string, output: string, isErrored = false) =>
    drawResult(els, s, { tool, output, isErrored }, async () => <Text color={isErrored ? 'error' : undefined}>{`  ⎿  ${output.replace(/\n/g, '\n     ')}`}</Text>)
  const question = async () => <Text>Which approach should I take?</Text>
  const sites: [string, string, RenderNode][] = [
    ['Your prompts', shown(s.promptStyle), drawPrompt(els, s, 'fix the login bug') ?? plain('❯ fix the login bug')],
    ['Plugin bands', s.bandFrame === 'off' ? 'off' : shown(borderOf(s, s.bandBorder)), s.bandFrame === 'off' ? plain('a row another mod draws') : drawBand(els, s, <Text>a row another mod draws</Text>)],
    [
      'Tool calls',
      `${shown(s.toolStyle)}, by ${shown(s.toolColor)}, output ${shown(s.toolResult)}`,
      <Box flexDirection="column">
        {await call('Bash', { command: 'npm test' })}
        {await result('Bash', '14 pass\n0 fail\nRan 14 tests')}
        {await call('Edit', { file_path: 'src/login.ts' })}
        {await result('Edit', 'Updated src/login.ts')}
        {await call('Read', { file_path: 'missing.ts' }, true)}
        {await result('Read', 'File does not exist.', true)}
      </Box>,
    ],
    ['Notices', shown(s.noticeStyle), drawNotice(els, s, 'Model from settings', '/model') ?? plain('Model from settings /model')],
    ['Mode badge', shown(s.modeStyle), drawMode(els, s, ['plan', 'auto']) ?? plain('plan & auto')],
    ['Prompt hint', shown(s.hintColor), drawHint(els, s, '? for shortcuts') ?? plain('? for shortcuts')],
    ['Questions', shown(s.questionFrame), (await drawQuestion(els, s, question)) ?? (await question())],
    ['Turn time', shown(s.durationStyle), drawDuration(els, s, 'Baked', 3000, columns) ?? plain('✻ Baked for 3s')],
  ]
  return (
    <Box flexDirection="column">
      {sites.map(([title, value, sample], i) => (
        <Box key={`preview:${i}`} flexDirection="column" marginTop={i ? 1 : 0}>
          <Text>
            <Text bold color={s.accent}>{title}</Text>
            <Text dimColor>{`  ${value}`}</Text>
          </Text>
          {sample}
        </Box>
      ))}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'style', description: 'Style settings: borders, colors and styles; /style preview shows each' })
    const saved = loadSettings(await $.store.get('settings'))
    await update($, settings, () => saved)
    return next(e)
  })

  on('command.run', { command: 'style' }, async ($, e) => {
    if (e.args.trim() === 'preview') return { text: 'Style preview' }
    await $.ui.open({ id: PANE, title: 'Style', focus: true, closeOnEscape: true, rows: 44, columns: 64 })
    return { text: 'Style settings opened.' }
  })

  // The settings pane: one row per option grouped by site, a press cycles it.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const s = await read($, settings)
    const sample = (k: Key, v: string): RenderNode | null => {
      if (k === 'bandFrame' && v === 'on') return <Text color={s.accent}>{BORDER_SAMPLES[borderOf(s, s.bandBorder)]}</Text>
      if (k === 'hintDim') return <Text color={s.hintColor === 'original' ? undefined : colorOf(s, s.hintColor as Accent)} dimColor={v === 'on'}>esc to interrupt</Text>
      if (k === 'border' || ((k === 'bandBorder' || k === 'questionFrame') && v !== 'off'))
        return <Text color={s.accent}>{BORDER_SAMPLES[borderOf(s, v as Border)]}</Text>
      if (k === 'accent' || (k.endsWith('Color') && k !== 'toolColor' && v !== 'original'))
        return <Text color={colorOf(s, v as Accent)}>■■■</Text>
      if (k === 'toolColor' && v !== 'mono') {
        const tint = (tool: string, running: boolean, errored: boolean) => toolColor({ ...s, toolColor: v as Settings['toolColor'] }, tool, running, errored)
        const dots: [string, ThemeKey][] = v === 'tool'
          ? [['bash', tint('Bash', false, false)], ['edit', tint('Edit', false, false)], ['read', tint('Read', false, false)]]
          : [['run', tint('', true, false)], ['fail', tint('', false, true)], ['ok', tint('', false, false)]]
        return <Text>{dots.map(([name, c]) => <Text color={c}>● <Text dimColor>{name} </Text></Text>)}</Text>
      }
      if (k === 'modeStyle' && v === 'pills') return <Text inverse color={colorOf(s, s.modeColor)}> auto </Text>
      const text = SAMPLES[k]?.[v]
      return text ? <Text dimColor>{text}</Text> : null
    }
    return (
      <Box flexDirection="column">
        <Text dimColor>Press a row to cycle its value. Esc closes.</Text>
        {GROUPS.map(([title, about, keys], i) => (
          <Box key={`group:${i}`} flexDirection="column" marginTop={1}>
            <Text>
              <Text bold color={s.accent}>{title}</Text>
              <Text dimColor>{`  ${about}`}</Text>
            </Text>
            {keys.map(k => {
              const off = INACTIVE[k]?.(s) ?? false
              const values = OPTIONS[k].values as readonly string[]
              return (
                <Button
                  key={`set:${k}`}
                  plain
                  onPress={() => changeSettings($, x => ({ ...x, [k]: cycle(values, x[k]) }))}
                >
                  <Text dimColor>{`  ${OPTIONS[k].label}`.padEnd(14)}</Text>
                  <Text bold={!off} dimColor={off}>{shown(s[k]).padEnd(11)}</Text>
                  <Text dimColor>{`${values.indexOf(s[k]) + 1}/${values.length}`.padEnd(6)}</Text>
                  {off ? <Text dimColor>not used</Text> : sample(k, s[k])}
                </Button>
              )
            })}
          </Box>
        ))}
        <Box marginTop={1} gap={1}>
          <Button key="reset" label="Reset" onPress={() => changeSettings($, () => DEFAULTS)} />
          <Button key="preview" label="Preview" onPress={() => $.command.run({ command: 'style', args: 'preview' })} />
          <Button key="close" label="Close" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })

  // Each site: the engine's drawing when the site is left to it, else ours.
  on('ui.render', { component: 'UserMessage', props: { origin: { kind: 'composer' } } }, async ($, e, next) => {
    return drawPrompt($.ui.resolve(e), await read($, settings), e.props.text) ?? next(e)
  }).catch(($, e, next) => next(e))

  // The band above the prompt, only when a plugin drew something there: the
  // engine's own drawing is usually empty, and an empty frame is clutter.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, settings)
    if (s.bandFrame === 'off') return next(e)
    const inner = await next({ ...e, props: { ...e.props, bodyColumns: e.props.bodyColumns - BORDER } })
    return inner.type === 'engine' ? inner : drawBand($.ui.resolve(e), s, inner)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (BARE.test(e.props.tool)) return next(e)
    return (await drawTool($.ui.resolve(e), await read($, settings), e.props, () => next(e))) ?? next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (BARE.test(e.props.tool)) return next(e)
    return drawResult($.ui.resolve(e), await read($, settings), e.props, () => next(e))
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'InfoNotice' }, async ($, e, next) => {
    return drawNotice($.ui.resolve(e), await read($, settings), e.props.text, e.props.command) ?? next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (e.props.modes.length === 0) return next(e)
    return drawMode($.ui.resolve(e), await read($, settings), e.props.modes) ?? next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    return drawHint($.ui.resolve(e), await read($, settings), e.props.hint, e.props.tail) ?? next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    return (await drawQuestion($.ui.resolve(e), await read($, settings), () => next(e))) ?? next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const { word, durationMs } = e.props
    return drawDuration($.ui.resolve(e), await read($, settings), word, durationMs, e.viewport?.columns ?? 80) ?? next(e)
  }).catch(($, e, next) => next(e))

  // `/style preview`'s row: a labeled sample of every site, drawn by the same code as the sites,
  // with stand-ins for what the engine draws. It reads the settings, so it redraws as they change.
  on('ui.render', { component: 'CommandOutput', props: { command: 'style', args: 'preview' } }, async ($, e) => {
    return drawPreview($.ui.resolve(e), await read($, settings), e.viewport?.columns ?? 80)
  }).catch(($, e, next) => next(e))
}
