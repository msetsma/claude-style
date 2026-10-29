import type { Color } from 'claude-code'

import { ACCENTS, PALETTES, paint } from './palettes'
import type { Accent, Border, DrawnBy, StyleSettings as Settings } from '../types'

export const BORDERS: Border[] = ['round', 'single', 'double', 'bold', 'dashed', 'classic']
const SITE_BORDERS = ['global', ...BORDERS] as const
const SITE_COLORS = ['global', ...ACCENTS] as const
const FILLS = ['none', 'surface', ...ACCENTS] as const

export const DEFAULTS: Settings = {
  palette: 'theme',
  border: 'round',
  accent: 'claude',
  density: 'normal',
  labels: 'border',
  prompts: 'style',
  promptStyle: 'bubble',
  promptAlign: 'left',
  promptColor: 'suggestion',
  promptFill: 'none',
  promptLabel: '',
  replies: 'style',
  replyStyle: 'card',
  replyColor: 'claude',
  replyFill: 'none',
  replyLabel: 'on',
  replyName: 'Claude',
  replyWidth: 'full',
  bands: 'style',
  bandBorder: 'global',
  bandLabel: '',
  tools: 'style',
  toolStyle: 'rail',
  toolColor: 'tool',
  toolFill: 'none',
  toolResult: 'full',
  notices: 'style',
  noticeStyle: 'line',
  noticeColor: 'global',
  noticeLabel: '',
  mode: 'style',
  modeStyle: 'pills',
  modeColor: 'planMode',
  hint: 'style',
  hintColor: 'global',
  hintDim: 'on',
  questions: 'style',
  questionFrame: 'global',
  questionColor: 'permission',
  questionLabel: 'Question',
  turnTime: 'style',
  durationStyle: 'rule',
  durationVerb: 'on',
}

export type Key = keyof Settings
export type Site = { [K in Key]: Settings[K] extends DrawnBy ? K : never }[Key]
type TextKey = { [K in Key]: string extends Settings[K] ? K : never }[Key]

// The longest label a text row keeps.
export const LABEL_MAX = 24

const DRAWN_BY = { label: 'Drawn by', values: ['style', 'claude'] } as const
const text = (label: string) => ({ label, text: true }) as const
// Each option: its row label and the values its picker offers, or `text` for a typed label.
export const OPTIONS: { [K in Key]: K extends TextKey ? { label: string; text: true } : { label: string; values: readonly Settings[K][] } } = {
  palette: { label: 'Palette', values: PALETTES },
  border: { label: 'Border', values: BORDERS },
  accent: { label: 'Color', values: ACCENTS },
  density: { label: 'Spacing', values: ['compact', 'normal', 'roomy'] },
  labels: { label: 'Labels', values: ['border', 'inside'] },
  prompts: DRAWN_BY,
  promptStyle: { label: 'Style', values: ['bubble', 'bar', 'plain'] },
  promptAlign: { label: 'Align', values: ['left', 'right'] },
  promptColor: { label: 'Color', values: SITE_COLORS },
  promptFill: { label: 'Fill', values: FILLS },
  promptLabel: text('Label'),
  replies: DRAWN_BY,
  replyStyle: { label: 'Style', values: ['card', 'rail', 'rule'] },
  replyColor: { label: 'Color', values: SITE_COLORS },
  replyFill: { label: 'Fill', values: FILLS },
  replyLabel: { label: 'Show label', values: ['on', 'off'] },
  replyName: text('Label'),
  replyWidth: { label: 'Width', values: ['full', 'fit'] },
  bands: DRAWN_BY,
  bandBorder: { label: 'Border', values: SITE_BORDERS },
  bandLabel: text('Label'),
  tools: DRAWN_BY,
  toolStyle: { label: 'Style', values: ['card', 'rail', 'compact'] },
  toolColor: { label: 'Color by', values: ['tool', 'status', 'mono'] },
  toolFill: { label: 'Fill', values: FILLS },
  toolResult: { label: 'Output', values: ['full', 'summary', 'hidden'] },
  notices: DRAWN_BY,
  noticeStyle: { label: 'Style', values: ['card', 'line'] },
  noticeColor: { label: 'Color', values: SITE_COLORS },
  noticeLabel: text('Label'),
  mode: DRAWN_BY,
  modeStyle: { label: 'Style', values: ['pills', 'caps', 'nerd', 'brackets', 'plain'] },
  modeColor: { label: 'Color', values: SITE_COLORS },
  hint: DRAWN_BY,
  hintColor: { label: 'Color', values: SITE_COLORS },
  hintDim: { label: 'Dimmed', values: ['on', 'off'] },
  questions: DRAWN_BY,
  questionFrame: { label: 'Tab border', values: SITE_BORDERS },
  questionColor: { label: 'Color', values: SITE_COLORS },
  questionLabel: text('Tab label'),
  turnTime: DRAWN_BY,
  durationStyle: { label: 'Style', values: ['rule', 'compact', 'hidden'] },
  durationVerb: { label: 'Show verb', values: ['on', 'off'] },
}
export const isText = (k: Key): k is TextKey => 'text' in OPTIONS[k]
export const valuesOf = (k: Key): readonly string[] => ('values' in OPTIONS[k] ? (OPTIONS[k] as { values: readonly string[] }).values : [])

// Each group: its title, what it changes on screen, and its rows, the site's Drawn by first.
export const GROUPS: [string, string, Key[]][] = [
  ['Defaults', 'used where a row says inherit', ['palette', 'border', 'accent', 'density', 'labels']],
  ['Your prompts', 'what you typed, in the transcript', ['prompts', 'promptStyle', 'promptAlign', 'promptColor', 'promptFill', 'promptLabel']],
  ['Replies', "Claude's text between tool calls", ['replies', 'replyStyle', 'replyColor', 'replyFill', 'replyLabel', 'replyName', 'replyWidth']],
  ['Plugin bands', 'rows other mods draw above the prompt', ['bands', 'bandBorder', 'bandLabel']],
  ['Tool calls', 'Write, Edit and other tool rows', ['tools', 'toolStyle', 'toolColor', 'toolFill', 'toolResult']],
  ['Notices', 'system notes in the transcript', ['notices', 'noticeStyle', 'noticeColor', 'noticeLabel']],
  ['Mode badge', 'the plan or auto mode label', ['mode', 'modeStyle', 'modeColor']],
  ['Prompt hint', 'the line under the prompt', ['hint', 'hintColor', 'hintDim']],
  ['Questions', 'the dialog Claude asks you in', ['questions', 'questionFrame', 'questionColor', 'questionLabel']],
  ['Turn time', 'the "Baked for 3s" line', ['turnTime', 'durationStyle', 'durationVerb']],
]
export const isSite = (k: Key): k is Site => OPTIONS[k] === DRAWN_BY
// Each row's site: the Drawn by row of its group.
const SITE_OF = Object.fromEntries(GROUPS.flatMap(([, , keys]) => keys.filter(k => !isSite(k)).map(k => [k, keys.find(isSite)]))) as Partial<Record<Key, Site>>
// A site this mod draws; one handed to Claude Code is left to the engine.
export const ours = (s: Settings, site: Site) => s[site] === 'style'

// What the pane calls a stored value. Color slots are numbered, as the legend numbers them,
// so a name holds under every palette.
const NAMES: Record<string, string> = { global: 'inherit', surface: 'surface', none: 'none' }
export const isColorKey = (k: Key) => k === 'accent' || /(Color|Fill)$/.test(k) && k !== 'toolColor'
export const slotNumber = (a: Accent) => ACCENTS.indexOf(a) + 1
export function shown(v: string, k?: Key): string {
  if (k && isSite(k)) return v === 'claude' ? 'Claude Code' : 'style'
  if ((ACCENTS as string[]).includes(v) && (!k || isColorKey(k))) return String(slotNumber(v as Accent))
  return NAMES[v] ?? v
}

// A row whose value changes nothing is drawn dim and takes no input: every row of a site Claude
// Code draws, the verb of a hidden turn time, a reply's width and fill when it is no card, its
// label when labels are off, and a tool fill without a card.
export function inactive(s: Settings, k: Key): boolean {
  const site = SITE_OF[k]
  if (site !== undefined && !ours(s, site)) return true
  if (k === 'durationVerb') return s.durationStyle === 'hidden'
  if (k === 'replyWidth' || k === 'replyFill') return s.replyStyle !== 'card'
  if (k === 'replyName') return s.replyLabel === 'off'
  if (k === 'promptFill' || k === 'promptLabel') return s.promptStyle !== 'bubble'
  if (k === 'toolFill') return s.toolStyle !== 'card'
  if (k === 'noticeLabel') return s.noticeStyle !== 'card'
  return false
}

// Values earlier versions stored for a site left to Claude Code, read as its Drawn by.
const LEGACY: [string, string, Site][] = [
  ['promptStyle', 'off', 'prompts'],
  ['bandFrame', 'off', 'bands'],
  ['toolStyle', 'off', 'tools'],
  ['noticeStyle', 'off', 'notices'],
  ['modeStyle', 'off', 'mode'],
  ['hintColor', 'original', 'hint'],
  ['questionFrame', 'off', 'questions'],
  ['durationStyle', 'original', 'turnTime'],
]
const KEYS = Object.keys(OPTIONS) as Key[]

/** A typed label as kept: one line, no control characters, at most LABEL_MAX long. */
export function cleanLabel(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, LABEL_MAX)
}

/** Stored settings over the defaults; anything unknown or malformed falls back per key. */
export function loadSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const valid = (k: Key) => (isText(k) ? typeof r[k] === 'string' : valuesOf(k).includes(r[k] as string))
  const picked = Object.fromEntries(KEYS.filter(valid).map(k => [k, isText(k) ? cleanLabel(r[k] as string) : r[k]]))
  const legacy = Object.fromEntries(LEGACY.filter(([old, value, site]) => r[old] === value && r[site] === undefined).map(([, , site]) => [site, 'claude']))
  return { ...DEFAULTS, ...picked, ...legacy } as Settings
}

export const borderOf = (s: Settings, v: 'global' | Border) => (v === 'global' ? s.border : v)
export const colorOf = (s: Settings, v: 'global' | Accent): Color | undefined => paint(s, v === 'global' ? s.accent : v)
export const accentOf = (s: Settings): Color | undefined => paint(s, s.accent)

// Tool families and the slot or role each draws in when coloring by tool.
const TOOL_COLORS: [RegExp, Parameters<typeof paint>[1]][] = [
  [/^Bash$/, 'bash'],
  [/^(Edit|MultiEdit|Write|NotebookEdit)$/, 'claude'],
  [/^(Read|Grep|Glob|LS)$/, 'suggestion'],
  [/^mcp__/, 'ide'],
  [/^(Agent|Task)$/, 'planMode'],
]

export function toolColor(s: Settings, tool: string, running: boolean, errored: boolean): Color | undefined {
  if (s.toolColor === 'mono') return accentOf(s)
  if (s.toolColor === 'status') return paint(s, errored ? 'error' : running ? 'warning' : 'success')
  return paint(s, TOOL_COLORS.find(([re]) => re.test(tool))?.[1] ?? 'subtle')
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
