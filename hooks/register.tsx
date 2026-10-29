import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { drawBand, drawDuration, drawHint, drawMode, drawNotice, drawPreview, drawPrompt, drawQuestion, drawReply, drawResult, drawTool } from './draw'
import { PANE, drawPane } from './pane'
import { DEFAULTS, loadSettings, ours } from './settings'
import type { StyleSettings as Settings } from '../types'

export { DEFAULTS, OPTIONS, cleanLabel, duration, loadSettings, outputText, rule, shown, target, toolColor } from './settings'
export { PALETTES, paint } from './palettes'

const settings = atom({ plugin: 'style', key: 'settings' } as const, DEFAULTS)
const opened = atom({ plugin: 'style', key: 'opened' } as const, [] as string[])

async function changeSettings($: EngineInterface, change: (s: Settings) => Settings) {
  await $.store.set('settings', await update($, settings, change))
}

// A border takes one column each side.
const BORDER = 2

// Tools the dialog stands for: their row draws nothing, and a card around it would be empty.
const BARE = /^AskUserQuestion$/

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'style', description: 'Style settings: palettes, borders, labels and styles; /style preview shows each' })
    const saved = loadSettings(await $.store.get('settings'))
    await update($, settings, () => saved)
    return next(e)
  })

  on('command.run', { command: 'style' }, async ($, e) => {
    if (e.args.trim() === 'preview') return { text: 'Style preview' }
    await $.ui.open({ id: PANE, title: 'Style', focus: true, closeOnEscape: true, rows: 80, columns: 66 })
    return { text: 'Style settings opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const act = {
      change: (change: (s: Settings) => Settings) => void changeSettings($, change),
      reset: () => void changeSettings($, () => DEFAULTS),
      preview: () => void $.command.run({ command: 'style', args: 'preview' }),
      close: () => void $.ui.close({ id: PANE }),
    }
    return drawPane(act, $.ui.resolve(e), await read($, settings))
  })

  // Each site: the engine's drawing when the site is left to it, else ours.
  on('ui.render', { component: 'UserMessage', props: { origin: { kind: 'composer' } } }, async ($, e, next) => {
    return drawPrompt($.ui.resolve(e), await read($, settings), e.props.text) ?? next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    return drawReply($.ui.resolve(e), await read($, settings), e.props, e.viewport?.columns ?? 80) ?? next(e)
  }).catch(($, e, next) => next(e))

  // The band above the prompt, only when a plugin drew something there: the
  // engine's own drawing is usually empty, and an empty frame is clutter.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, settings)
    if (!ours(s, 'bands')) return next(e)
    const inner = await next({ ...e, props: { ...e.props, bodyColumns: e.props.bodyColumns - BORDER } })
    return inner.type === 'engine' ? inner : drawBand($.ui.resolve(e), s, inner)
  }).catch(($, e, next) => next(e))

  // An expanded row (ctrl+o, an unfolded group) is the engine's: it draws the call's output inline.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (BARE.test(e.props.tool) || e.props.isExpanded) return next(e)
    return drawTool($.ui.resolve(e), await read($, settings), e.props) ?? next(e)
  }).catch(($, e, next) => next(e))

  // A folded result opens and folds again on a press of its toggle, per call.
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (BARE.test(e.props.tool)) return next(e)
    const id = e.props.tool_use_id
    const open = await read($, opened)
    const fold = {
      key: `fold:${id}`,
      isOpen: open.includes(id),
      toggle: () => void update($, opened, ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])),
    }
    return drawResult($.ui.resolve(e), await read($, settings), e.props, () => next(e), fold)
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
