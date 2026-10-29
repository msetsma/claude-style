import { atom, update } from 'claude-code'
import type { Elements, EngineInterface, RenderNode, RenderSurface } from 'claude-code'

import { BORDER_SAMPLES, badge } from './draw'
import { ACCENTS, fillOf, paint, paletteName } from './palettes'
import { DEFAULTS, GROUPS, OPTIONS, accentOf, borderOf, cleanLabel, colorOf, inactive, isColorKey, isText, shown, toolColor, valuesOf } from './settings'
import type { Key } from './settings'
import type { Border, StyleSettings as Settings } from '../types'

export const PANE = 'style'

type Els = Elements[RenderSurface]

const settings = atom({ plugin: 'style', key: 'settings' } as const, DEFAULTS)

export async function changeSettings($: EngineInterface, change: (s: Settings) => Settings) {
  await $.store.set('settings', await update($, settings, change))
}

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

// What a row draws beside its value: a sample of the current value in the current colors.
function sample(els: Els, s: Settings, k: Key): RenderNode | null {
  const { Text } = els
  const v = s[k] as string
  if (k === 'palette')
    return (
      <Text>
        {ACCENTS.map(a => (
          <Text key={`pal:${a}`} color={paint(s, a)}>■</Text>
        ))}
      </Text>
    )
  if (k === 'hintDim') return <Text color={colorOf(s, s.hintColor)} dimColor={v === 'on'}>esc to interrupt</Text>
  if (k === 'border' || k === 'bandBorder' || k === 'questionFrame') return <Text color={accentOf(s)}>{BORDER_SAMPLES[borderOf(s, v as Border)]}</Text>
  if (k === 'modeStyle') return badge(els, s, 'auto')
  if (k.endsWith('Fill')) {
    const { bg, fg } = fillOf(s, v as Settings['promptFill'])
    return bg ? <Text backgroundColor={bg} color={fg}> text </Text> : <Text dimColor>no fill</Text>
  }
  if (isColorKey(k)) return <Text color={colorOf(s, v as Settings['promptColor'])}>■■</Text>
  if (k === 'toolColor' && v !== 'mono') {
    const tint = (tool: string, running: boolean, errored: boolean) => toolColor(s, tool, running, errored)
    const dots: [string, ReturnType<typeof tint>][] =
      v === 'tool'
        ? [['bash', tint('Bash', false, false)], ['edit', tint('Edit', false, false)], ['read', tint('Read', false, false)]]
        : [['run', tint('', true, false)], ['fail', tint('', false, true)], ['ok', tint('', false, false)]]
    return <Text>{dots.map(([name, c]) => <Text key={`dot:${name}`} color={c}>● <Text dimColor>{name} </Text></Text>)}</Text>
  }
  const text = SAMPLES[k]?.[v]
  return text ? <Text dimColor>{text}</Text> : null
}

const optionLabel = (k: Key, v: string) => (k === 'palette' ? paletteName(v as Settings['palette']) : shown(v, k))

// One setting's row: a picker the arrows change, a field for a typed label, or a dim line when
// the value changes nothing.
function row($: EngineInterface, els: Els, s: Settings, k: Key) {
  const { Box, Text, Button } = els
  const label = `  ${OPTIONS[k].label}`.padEnd(14)
  const current = isText(k) ? s[k] || '(none)' : optionLabel(k, s[k] as string)
  if (inactive(s, k))
    return (
      <Box key={`set:${k}`}>
        <Text dimColor>
          {label}
          {current}
        </Text>
      </Box>
    )
  // The mobile app draws no field or picker: a press there cycles the value, and labels stay as set.
  if (!('Select' in els) || !('Input' in els)) {
    if (isText(k))
      return (
        <Box key={`set:${k}`}>
          <Text dimColor>
            {label}
            {current}
          </Text>
        </Box>
      )
    const values = valuesOf(k)
    const next = values[(values.indexOf(s[k] as string) + 1) % values.length]
    return (
      <Button key={`set:${k}`} plain onPress={() => changeSettings($, x => ({ ...x, [k]: next }))}>
        <Text dimColor>{label}</Text>
        <Text bold>{current}</Text>
      </Button>
    )
  }
  const { Select, Input } = els
  if (isText(k))
    return (
      <Input
        key={`set:${k}`}
        label={label}
        value={s[k]}
        placeholder="none"
        onSubmit={(value: string) => changeSettings($, x => ({ ...x, [k]: cleanLabel(value) }))}
      />
    )
  return (
    <Box key={`row:${k}`} gap={1}>
      <Select
        key={`set:${k}`}
        label={label}
        options={valuesOf(k).map(v => ({ value: v, label: optionLabel(k, v) }))}
        value={s[k] as string}
        onSelect={(value: string) => changeSettings($, x => ({ ...x, [k]: value }))}
      />
      {sample(els, s, k)}
    </Box>
  )
}

// The settings pane: a legend of the palette's nine numbered colors, then one row per option grouped by site.
export function drawPane($: EngineInterface, els: Els, s: Settings) {
  const { Box, Button, Text } = els
  return (
    <Box flexDirection="column">
      <Text dimColor>Tab moves between rows, ↑ ↓ change a value, Enter sets it. Esc closes.</Text>
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
      {GROUPS.map(([title, about, keys], i) => (
        <Box key={`group:${i}`} flexDirection="column" marginTop={1}>
          <Text>
            <Text bold color={accentOf(s)}>{title}</Text>
            <Text dimColor>{`  ${about}`}</Text>
          </Text>
          {keys.map(k => row($, els, s, k))}
        </Box>
      ))}
      <Box marginTop={1} gap={1}>
        <Button key="reset" label="Reset" onPress={() => changeSettings($, () => DEFAULTS)} />
        <Button key="preview" label="Preview" onPress={() => $.command.run({ command: 'style', args: 'preview' })} />
        <Button key="close" label="Close" onPress={() => $.ui.close({ id: PANE })} />
      </Box>
    </Box>
  )
}
