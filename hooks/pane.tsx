import type { Elements, RenderSurface } from 'claude-code'

import { BORDER_SAMPLES } from './draw'
import type { ListProps, ListRow, Span } from './list'
import { ACCENTS, fillOf, paint, paletteName } from './palettes'
import { GROUPS, OPTIONS, accentOf, borderOf, colorOf, inactive, isColorKey, isText, shown, toolColor } from './settings'
import type { Key } from './settings'
import type { Border, StyleSettings as Settings } from '../types'

export const PANE = 'style'
// The settings list's Client: its `key`, which `ui.message` names as `element`.
export const LIST = 'settings'

type Els = Elements[RenderSurface]

// What the pane's controls do, run by the hooks module, which holds the engine.
export type PaneActions = {
  step: (k: Key, by: number) => void
  reset: () => void
  preview: () => void
  close: () => void
}

// Rows the pane draws around the list: the help line, the legend and the buttons.
const CHROME_ROWS = 7

const SAMPLES: Partial<Record<Key, Record<string, string>>> = {
  density: { compact: '│hi│', normal: '│ hi │', roomy: '│  hi  │' },
  labels: { border: '╭─ Claude ──╮', inside: '╭ Claude ╮' },
  promptStyle: { bubble: '╭ ❯ hi ╮', bar: '▎ hi', plain: '❯ hi' },
  promptAlign: { left: 'hi ⇤', right: '⇥ hi' },
  replyStyle: { card: '╭ Claude ╮', rail: '▌ Claude', rule: '── Claude ──' },
  replyLabel: { on: 'first block', off: 'no label' },
  replyWidth: { full: '╭ hi ────╮', fit: '╭ hi ╮' },
  toolStyle: { card: '╭ Edit(a.ts) ╮', rail: '▎ Edit(a.ts)', compact: 'Edit(a.ts)' },
  toolColor: { mono: 'one color' },
  toolResult: { full: '⎿ every line', summary: '⎿ first line ▸', hidden: '▸ press to show' },
  noticeStyle: { card: '╭ note ╮', line: 'note /cmd' },
  durationStyle: { rule: '── Baked 3s ──', compact: '✻ 3s', hidden: 'nothing' },
  durationVerb: { on: 'Baked 3s', off: '3s' },
}

const MODE_CAPS: Record<string, [string, string]> = { caps: ['▐', '▌'], nerd: ['', ''] }

// What a row draws beside its value, as colored spans: a sample of the value in the current colors.
export function sample(s: Settings, k: Key): Span[] {
  const v = s[k] as string
  if (k === 'palette') return ACCENTS.map(a => ({ text: '■', color: paint(s, a) }))
  if (k === 'hintDim') return [{ text: 'esc to interrupt', color: colorOf(s, s.hintColor), dim: v === 'on' }]
  if (k === 'border' || k === 'bandBorder' || k === 'questionFrame') return [{ text: BORDER_SAMPLES[borderOf(s, v as Border)], color: accentOf(s) }]
  if (k === 'modeStyle') {
    const color = colorOf(s, s.modeColor)
    if (v === 'brackets' || v === 'plain') return [{ text: v === 'brackets' ? '[auto]' : 'auto', color }]
    const pill = { text: v === 'pills' ? ' auto ' : 'auto', bg: color, color: paint(s, 'ink'), bold: true }
    const caps = MODE_CAPS[v]
    return caps ? [{ text: caps[0], color }, pill, { text: caps[1], color }] : [pill]
  }
  if (k.endsWith('Fill')) {
    const { bg, fg } = fillOf(s, v as Settings['promptFill'])
    return bg ? [{ text: ' text ', bg, color: fg }] : [{ text: 'no fill', dim: true }]
  }
  if (isColorKey(k)) return [{ text: '■■', color: colorOf(s, v as Settings['promptColor']) }]
  if (k === 'toolColor' && v !== 'mono') {
    const dots: [string, string, boolean, boolean][] =
      v === 'tool'
        ? [['bash', 'Bash', false, false], ['edit', 'Edit', false, false], ['read', 'Read', false, false]]
        : [['run', '', true, false], ['fail', '', false, true], ['ok', '', false, false]]
    return dots.flatMap(([name, tool, running, errored]) => [
      { text: '● ', color: toolColor(s, tool, running, errored) },
      { text: `${name} `, dim: true },
    ])
  }
  const text = SAMPLES[k]?.[v]
  return text ? [{ text, dim: true }] : []
}

const optionLabel = (k: Key, v: string) => (k === 'palette' ? paletteName(v as Settings['palette']) : shown(v, k))
const current = (s: Settings, k: Key) => (isText(k) ? (s[k] as string) || '(none)' : optionLabel(k, s[k] as string))

/** The list's rows: a heading per group, then a row per setting with its shown value and sample. */
export function listProps(s: Settings): ListProps {
  const rows: ListRow[] = GROUPS.flatMap(([title, about, keys], i): ListRow[] => [
    ...(i ? [{ kind: 'gap' } as const] : []),
    { kind: 'head', title, about, color: accentOf(s) },
    ...keys.map(
      (k): ListRow => ({
        kind: 'set',
        key: k,
        label: OPTIONS[k].label,
        value: current(s, k),
        raw: isText(k) ? (s[k] as string) : '',
        text: isText(k),
        off: inactive(s, k),
        sample: sample(s, k),
      }),
    ),
  ])
  // A Client's props are plain JSON: a color the palette leaves unset is dropped, not undefined.
  return JSON.parse(JSON.stringify({ rows, accent: accentOf(s) })) as ListProps
}

// A surface without `Client` (the mobile app): a press on a row steps its value; labels stay as set.
function buttonRows(act: PaneActions, els: Els, s: Settings) {
  const { Box, Button, Text } = els
  return GROUPS.map(([title, , keys], i) => (
    <Box key={`group:${i}`} flexDirection="column" marginTop={1}>
      <Text bold color={accentOf(s)}>{title}</Text>
      {keys.map(k => {
        const label = `  ${OPTIONS[k].label}`.padEnd(14)
        return inactive(s, k) || isText(k) ? (
          <Box key={`set:${k}`}>
            <Text dimColor>
              {label}
              {current(s, k)}
            </Text>
          </Box>
        ) : (
          <Button key={`set:${k}`} plain onPress={() => act.step(k, 1)}>
            <Text dimColor>{label}</Text>
            <Text bold>{current(s, k)}</Text>
          </Button>
        )
      })}
    </Box>
  ))
}

// The settings pane: the palette's nine numbered colors, the settings list, and the buttons.
export function drawPane(act: PaneActions, els: Els, s: Settings, bodyRows: number) {
  const { Box, Button, Text } = els
  return (
    <Box flexDirection="column">
      <Text dimColor>Click the list, then ↑ ↓ move and ← → change. Esc leaves it.</Text>
      <Box flexDirection="column" marginTop={1}>
        <Text>
          <Text bold color={accentOf(s)}>Colors</Text>
          <Text dimColor>{`  ${paletteName(s.palette)}`}</Text>
        </Text>
        <Text>
          {'  '}
          {ACCENTS.map((a, i) => (
            <Text key={`color:${a}`}>
              <Text color={paint(s, a)}>■</Text>
              <Text dimColor>{`${i + 1}  `}</Text>
            </Text>
          ))}
        </Text>
      </Box>
      {'Client' in els ? (
        <Box marginTop={1} flexDirection="column">
          <els.Client key={LIST} module="./list.tsx" props={listProps(s)} height={Math.max(10, bodyRows - CHROME_ROWS)} />
        </Box>
      ) : (
        buttonRows(act, els, s)
      )}
      <Box marginTop={1} gap={1}>
        <Button key="reset" label="Reset" onPress={act.reset} />
        <Button key="preview" label="Preview" onPress={act.preview} />
        <Button key="close" label="Close" onPress={act.close} />
      </Box>
    </Box>
  )
}
