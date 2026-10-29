import type { Color, Elements, RenderElement, RenderNode, RenderSurface } from 'claude-code'

import { fillOf, paint } from './palettes'
import { accentOf, borderOf, colorOf, duration, ours, outputText, rule, shown, target, toolColor } from './settings'
import type { Site } from './settings'
import type { Border, StyleSettings as Settings } from '../types'

export type Els = Elements[RenderSurface]
// What the engine draws at a site, produced only when asked for.
export type Inner = () => Promise<RenderElement>

// Padding inside a frame and the blank row above it.
export const SPACING: Record<Settings['density'], { padX: number; marginTop: number }> = {
  compact: { padX: 0, marginTop: 0 },
  normal: { padX: 1, marginTop: 1 },
  roomy: { padX: 2, marginTop: 1 },
}

// Each border's corner and line glyphs: the settings samples and the question dialog's tab.
export const BORDER_SAMPLES: Record<Border, string> = {
  round: '╭─╮',
  single: '┌─┐',
  double: '╔═╗',
  bold: '┏━┓',
  dashed: '┌╌┐',
  classic: '+-+',
}

// A colored glyph column beside `body`, as tall as it: an absolute Box spanning the row, its long
// text clipped to that height. On the right for a right-aligned prompt.
export function railed({ Box, Text }: Pick<Els, 'Box' | 'Text'>, color: Color | undefined, glyph: string, body: RenderElement, side: 'left' | 'right' = 'left') {
  const edge = side === 'left' ? { left: 0 } : { right: 0 }
  return (
    <Box flexDirection="column" paddingLeft={side === 'left' ? 2 : 0} paddingRight={side === 'right' ? 2 : 0}>
      <Box position="absolute" top={0} bottom={0} width={1} overflow="hidden" {...edge}>
        <Text color={color}>{`${glyph}\n`.repeat(400)}</Text>
      </Box>
      {body}
    </Box>
  )
}

// The transcript draws over a row's first column, which would hide a card's left border.
const EDGE = 1

type CardProps = {
  color: Color | undefined
  label?: string
  fill?: Settings['promptFill']
  alignSelf?: 'flex-start' | 'flex-end'
  marginTop?: number
  children: RenderNode
}

// A bordered card. Its label sits in the top border (`╭─ label ──╮`), painted over the line by an
// absolute Box one row up, or as a bold first line inside; a fill paints the card's inside.
export function card({ Box, Text }: Els, s: Settings, p: CardProps) {
  const { bg, fg } = fillOf(s, p.fill ?? 'none')
  const label = p.label ? (
    <Text bold color={bg && s.labels === 'inside' ? fg : p.color}>{s.labels === 'border' ? ` ${p.label} ` : p.label}</Text>
  ) : null
  return (
    <Box
      borderStyle={s.border}
      borderColor={p.color}
      backgroundColor={bg}
      paddingX={SPACING[s.density].padX}
      marginTop={p.marginTop}
      marginLeft={EDGE}
      flexDirection="column"
      alignSelf={p.alignSelf}
    >
      {label && s.labels === 'border' ? (
        <Box position="absolute" top={-1} left={1}>
          {label}
        </Box>
      ) : (
        label
      )}
      {p.children}
    </Box>
  )
}

// Your own prompts: a bubble sized to the text, a colored rail, or a plain colored ❯; at either side.
export function drawPrompt(els: Els, s: Settings, text: string) {
  if (!ours(s, 'prompts')) return undefined
  const { Box, Text } = els
  const color = colorOf(s, s.promptColor)
  const { marginTop } = SPACING[s.density]
  const right = s.promptAlign === 'right'
  const side = (row: RenderElement) => (right ? <Box justifyContent="flex-end" marginTop={marginTop}>{row}</Box> : <Box marginTop={marginTop}>{row}</Box>)
  if (s.promptStyle === 'bar') return side(railed(els, color, right ? '▐' : '▎', <Text>{text}</Text>, right ? 'right' : 'left'))
  if (s.promptStyle === 'plain')
    return side(
      right ? (
        <Text>
          {text}
          <Text color={color}> ❮</Text>
        </Text>
      ) : (
        <Box>
          <Text color={color}>❯ </Text>
          <Text>{text}</Text>
        </Box>
      ),
    )
  const { fg } = fillOf(s, s.promptFill)
  return card(els, s, {
    color,
    label: s.promptLabel || undefined,
    fill: s.promptFill,
    marginTop,
    alignSelf: right ? 'flex-end' : 'flex-start',
    children: (
      <Text color={fg}>
        {right ? null : <Text color={fg ?? color}>❯ </Text>}
        {text}
      </Text>
    ),
  })
}

// Claude's text: its markdown in a card, beside a rail, or under a rule, set apart from the tool
// rows around it. The label names it on a reply's first block only; a summary keeps its mark.
export function drawReply(els: Els, s: Settings, reply: { text: string; isFirstOfReply: boolean; isSummary?: true }, columns: number) {
  if (!ours(s, 'replies')) return undefined
  const { Box, Text, Markdown } = els
  const color = colorOf(s, s.replyColor)
  const { marginTop } = SPACING[s.density]
  const name = s.replyLabel === 'on' && reply.isFirstOfReply && s.replyName ? s.replyName : undefined
  const body = (head: string | undefined) => (
    <Box flexDirection="column">
      {head ? <Text bold color={color}>{head}</Text> : null}
      <Markdown text={reply.text} />
      {reply.isSummary ? <Text dimColor> · summary</Text> : null}
    </Box>
  )
  if (s.replyStyle === 'rail') return <Box marginTop={marginTop}>{railed(els, color, '▌', body(name))}</Box>
  if (s.replyStyle === 'rule')
    return (
      <Box flexDirection="column" marginTop={marginTop}>
        {reply.isFirstOfReply ? (
          <Text color={color} dimColor wrap="truncate">
            {name ? rule(name, columns - 2) : '─'.repeat(Math.max(4, columns - 2))}
          </Text>
        ) : null}
        {body(undefined)}
      </Box>
    )
  return card(els, s, {
    color,
    label: name,
    fill: s.replyFill,
    marginTop,
    alignSelf: s.replyWidth === 'fit' ? 'flex-start' : undefined,
    children: body(undefined),
  })
}

// A frame around what other plugins drew above the prompt, its label in the border.
export function drawBand(els: Els, s: Settings, inner: RenderElement) {
  return card(els, { ...s, border: borderOf(s, s.bandBorder), density: 'compact' }, { color: accentOf(s), label: s.bandLabel || undefined, children: inner })
}

type Call = { tool: string; input: unknown; isRunning: boolean; isErrored: boolean; isInterrupted?: boolean }

// A tool call's row, our own `Tool(target)` line in place of the engine's `⏺` one: the rail or
// card carries the color, and compact colors the name. A card with border labels puts the tool's
// name in its top line and the target inside.
export function drawTool(els: Els, s: Settings, call: Call) {
  if (!ours(s, 'tools')) return undefined
  const { Box, Text } = els
  const color = toolColor(s, call.tool, call.isRunning, call.isErrored)
  const name = call.tool.replace(/^mcp__/, '')
  const about = target(call.input)
  const inBorder = s.toolStyle === 'card' && s.labels === 'border'
  const status = [call.isRunning ? <Text dimColor> …</Text> : null, call.isInterrupted ? <Text color={paint(s, 'error')}> Interrupted</Text> : null]
  const { fg } = s.toolStyle === 'card' ? fillOf(s, s.toolFill) : {}
  const line = (
    <Text wrap="truncate" color={fg}>
      {inBorder ? null : <Text bold color={s.toolStyle === 'compact' ? color : fg}>{name}</Text>}
      {about ? <Text dimColor={!inBorder && !fg}>{inBorder ? about : `(${about})`}</Text> : null}
      {status}
    </Text>
  )
  const { marginTop } = SPACING[s.density]
  if (s.toolStyle === 'compact') return <Box marginTop={marginTop}>{line}</Box>
  if (s.toolStyle === 'rail') return <Box marginTop={marginTop}>{railed(els, color, '▎', line)}</Box>
  return card(els, s, { color, label: inBorder ? name : undefined, fill: s.toolFill, marginTop, alignSelf: 'flex-start', children: line })
}

type Result = { tool: string; output: unknown; isErrored: boolean; isExpanded?: boolean }
// A folded result's toggle: whether it is open, and what flips it.
export type Fold = { key: string; isOpen: boolean; toggle: () => void }

// A tool's result: the engine's drawing (beside the call's rail), its first line, or nothing.
// An error always shows whole, and so does ctrl+o's expanded view; a folded one opens on a press.
export async function drawResult(els: Els, s: Settings, result: Result, inner: Inner, fold?: Fold) {
  if (!ours(s, 'tools')) return inner()
  const { Box, Text, Button } = els
  const glyph = s.toolStyle === 'rail' ? '▎' : s.toolStyle === 'card' ? '┆' : undefined
  const beside = (body: RenderElement) => (glyph ? railed(els, toolColor(s, result.tool, false, result.isErrored), glyph, body) : body)
  const whole = async () => (glyph ? beside(await inner()) : inner())
  if (result.isErrored || result.isExpanded || s.toolResult === 'full') return whole()
  const toggle = (label: string) =>
    fold ? (
      <Button key={fold.key} plain dimColor onPress={fold.toggle}>
        {label}
      </Button>
    ) : (
      <Text dimColor>{label}</Text>
    )
  if (fold?.isOpen)
    return (
      <Box flexDirection="column">
        {await whole()}
        <Box paddingLeft={2}>{toggle('▾ fold output')}</Box>
      </Box>
    )
  const text = outputText(result.output)
  if (s.toolResult === 'hidden') return beside(<Box paddingLeft={glyph ? 0 : 2}>{toggle('▸ show output')}</Box>)
  if (text === undefined) return whole()
  const lines = text.trimEnd().split('\n')
  return beside(
    <Box flexDirection="column" paddingLeft={glyph ? 0 : 2}>
      <Text dimColor wrap="truncate">⎿  {lines[0] || '(no output)'}</Text>
      {lines.length > 1 ? <Box paddingLeft={3}>{toggle(`▸ +${lines.length - 1} lines`)}</Box> : null}
    </Box>,
  )
}

// The dim notices under the logo, after the engine's own `▎` mark: a card, or a dim line in the color.
export function drawNotice(els: Els, s: Settings, text: string, command: string | null) {
  if (!ours(s, 'notices')) return undefined
  const { Text } = els
  const color = colorOf(s, s.noticeColor)
  const line = s.noticeStyle === 'line'
  const body = (
    <Text>
      <Text color={line ? color : undefined} dimColor>{text}</Text>
      {command ? <Text color={color} bold={line}> {command}</Text> : null}
    </Text>
  )
  if (line) return body
  return card(els, s, { color, label: s.noticeLabel || undefined, alignSelf: 'flex-start', children: body })
}

// Rounded caps drawn from Nerd Font powerline glyphs, and half blocks any font has.
const CAPS = { nerd: ['', ''], caps: ['▐', '▌'] } as const

/** One mode label: a solid pill, capped by half blocks or Nerd Font glyphs, in brackets, or plain. */
export function badge({ Text }: Els, s: Settings, m: string) {
  const color = colorOf(s, s.modeColor)
  const ink = paint(s, 'ink')
  if (s.modeStyle === 'brackets' || s.modeStyle === 'plain') return <Text color={color}>{s.modeStyle === 'brackets' ? `[${m}]` : m}</Text>
  const body = (
    <Text backgroundColor={color} color={ink} bold>
      {s.modeStyle === 'pills' ? ` ${m} ` : m}
    </Text>
  )
  if (s.modeStyle === 'pills') return body
  const [left, right] = CAPS[s.modeStyle]
  return (
    <Text>
      <Text color={color}>{left}</Text>
      {body}
      <Text color={color}>{right}</Text>
    </Text>
  )
}

// The mode labels at the right of the footer.
export function drawMode(els: Els, s: Settings, modes: readonly string[]) {
  if (!ours(s, 'mode')) return undefined
  const { Text } = els
  const gap = <Text dimColor>{s.modeStyle === 'plain' ? ' · ' : ' '}</Text>
  return <Text>{modes.flatMap((m, i) => (i ? [gap, badge(els, s, m)] : [badge(els, s, m)]))}</Text>
}

// The hint under the prompt, recolored; its text is the engine's.
export function drawHint({ Text }: Els, s: Settings, hint: string, tail?: string | null) {
  if (!ours(s, 'hint')) return undefined
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
export async function drawQuestion({ Box, Text }: Els, s: Settings, inner: Inner) {
  if (!ours(s, 'questions')) return undefined
  const [left, line, right] = BORDER_SAMPLES[borderOf(s, s.questionFrame)]
  const label = s.questionLabel ? ` ${s.questionLabel} ` : line
  return (
    <Box flexDirection="column" marginTop={SPACING[s.density].marginTop}>
      <Text color={colorOf(s, s.questionColor)}>{`${left}${line}${label}${line}${right}`}</Text>
      {await inner()}
    </Box>
  )
}

// The line that closes a turn: a dim rule across the width, a short `✻ 3s`, or nothing.
export function drawDuration({ Box, Text }: Els, s: Settings, word: string, ms: number, columns: number) {
  if (!ours(s, 'turnTime')) return undefined
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
      <Text color={accentOf(s)} dimColor wrap="truncate">
        {rule(label, columns - 2)}
      </Text>
    </Box>
  )
}

// One labeled sample per site, the engine's part of each played by a dim stand-in.
export async function drawPreview(els: Els, s: Settings, columns: number) {
  const { Box, Text } = els
  const plain = (text: string) => <Text dimColor>{text}</Text>
  const call = (tool: string, input: Record<string, string>, isErrored = false) =>
    drawTool(els, s, { tool, input, isRunning: false, isErrored }) ?? (
      <Box marginTop={1}>
        <Text>
          ⏺ <Text bold>{tool}</Text>({Object.values(input)[0]})
        </Text>
      </Box>
    )
  const result = (tool: string, output: string, isErrored = false) =>
    drawResult(els, s, { tool, output, isErrored }, async () => <Text color={isErrored ? paint(s, 'error') : undefined}>{`  ⎿  ${output.replace(/\n/g, '\n     ')}`}</Text>)
  const question = async () => <Text>Which approach should I take?</Text>
  const sites: [Site, string, string, RenderNode][] = [
    ['prompts', 'Your prompts', `${shown(s.promptStyle)}, ${s.promptAlign}`, drawPrompt(els, s, 'fix the login bug') ?? plain('❯ fix the login bug')],
    [
      'replies',
      'Replies',
      shown(s.replyStyle),
      drawReply(els, s, { text: 'Fixed: the token check used `<`, not `<=`.', isFirstOfReply: true }, columns) ??
        plain('● Fixed: the token check used `<`, not `<=`.'),
    ],
    ['bands', 'Plugin bands', shown(borderOf(s, s.bandBorder)), ours(s, 'bands') ? drawBand(els, s, <Text>a row another mod draws</Text>) : <Text>a row another mod draws</Text>],
    [
      'tools',
      'Tool calls',
      `${shown(s.toolStyle)}, by ${shown(s.toolColor)}, output ${shown(s.toolResult)}`,
      <Box flexDirection="column">
        {call('Bash', { command: 'npm test' })}
        {await result('Bash', '14 pass\n0 fail\nRan 14 tests')}
        {call('Edit', { file_path: 'src/login.ts' })}
        {await result('Edit', 'Updated src/login.ts')}
        {call('Read', { file_path: 'missing.ts' }, true)}
        {await result('Read', 'File does not exist.', true)}
      </Box>,
    ],
    ['notices', 'Notices', shown(s.noticeStyle), drawNotice(els, s, 'Model from settings', '/model') ?? plain('Model from settings /model')],
    ['mode', 'Mode badge', shown(s.modeStyle), drawMode(els, s, ['plan', 'auto']) ?? plain('plan & auto')],
    ['hint', 'Prompt hint', shown(s.hintColor, 'hintColor'), drawHint(els, s, '? for shortcuts') ?? plain('? for shortcuts')],
    ['questions', 'Questions', shown(s.questionFrame), (await drawQuestion(els, s, question)) ?? (await question())],
    ['turnTime', 'Turn time', shown(s.durationStyle), drawDuration(els, s, 'Baked', 3000, columns) ?? plain('✻ Baked for 3s')],
  ]
  return (
    <Box flexDirection="column">
      {sites.map(([site, title, value, sample], i) => (
        <Box key={`preview:${i}`} flexDirection="column" marginTop={i ? 1 : 0}>
          <Text>
            <Text bold color={accentOf(s)}>{title}</Text>
            <Text dimColor>{`  ${ours(s, site) ? value : 'Claude Code'}`}</Text>
          </Text>
          {sample}
        </Box>
      ))}
    </Box>
  )
}
