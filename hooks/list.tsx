import type { ClientModule, ClientSurface, RenderNode } from 'claude-code'

// The settings list, drawn on the drawing thread so it has the keys: up and down move the cursor,
// left and right step the value under it, and on a label row typing edits it and Enter saves it.
// It reaches the hooks module only through `post`: `{ key, step }` or `{ key, text }`.

export type Span = { text: string; color?: string; bg?: string; dim?: boolean; bold?: boolean }
export type ListRow =
  | { kind: 'gap' }
  | { kind: 'head'; title: string; about: string; color?: string }
  | { kind: 'set'; key: string; label: string; value: string; raw: string; text: boolean; off: boolean; sample: Span[] }
export type ListProps = { rows: ListRow[]; accent?: string }

type State = { cursor: number; draft?: string }

const LABEL_WIDTH = 14

const settable = (rows: ListRow[]) => rows.flatMap((r, i) => (r.kind === 'set' ? [i] : []))

// The row under the cursor, stepped `by` settable rows and held inside the list.
function moved(rows: ListRow[], cursor: number, by: number): number {
  const stops = settable(rows)
  const at = Math.max(0, stops.indexOf(cursor))
  return stops[Math.min(stops.length - 1, Math.max(0, at + by))] ?? cursor
}

// The rows shown: a window as tall as the region, scrolled to keep the cursor in it.
function windowed(count: number, cursor: number, height: number): [number, number] {
  if (height <= 0 || count <= height) return [0, count]
  const top = Math.min(Math.max(0, cursor - Math.floor(height / 2)), count - height)
  return [top, top + height]
}

function onKey(props: ListProps, surface: ClientSurface<State>) {
  return (e: { key: string; ctrl?: true; meta?: true }) => {
    const state = surface.state ?? { cursor: settable(props.rows)[0] ?? 0 }
    const row = props.rows[state.cursor]
    const set = (next: State) => surface.setState(next)
    if (e.key === 'up' || e.key === 'down') return set({ cursor: moved(props.rows, state.cursor, e.key === 'up' ? -1 : 1) })
    if (e.key === 'pageup' || e.key === 'pagedown') return set({ cursor: moved(props.rows, state.cursor, e.key === 'pageup' ? -10 : 10) })
    if (!row || row.kind !== 'set' || row.off) return
    if (!row.text) {
      if (e.key === 'left' || e.key === 'right' || e.key === 'return' || e.key === ' ')
        surface.post({ key: row.key, step: e.key === 'left' ? -1 : 1 })
      return
    }
    const draft = state.draft ?? row.raw
    if (e.key === 'return') {
      surface.post({ key: row.key, text: draft })
      return set({ cursor: state.cursor })
    }
    if (e.key === 'backspace' || e.key === 'delete') return set({ ...state, draft: draft.slice(0, -1) })
    if (e.key.length === 1 && !e.ctrl && !e.meta) return set({ ...state, draft: draft + e.key })
  }
}

const List: ClientModule<ListProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  const rows = props.rows
  const state = surface.state ?? { cursor: settable(rows)[0] ?? 0 }
  surface.onKey(onKey(props, surface))
  const [from, to] = windowed(rows.length, state.cursor, surface.rows)
  surface.onPointer(e => {
    const i = from + e.y
    if (e.type === 'down' && rows[i]?.kind === 'set') surface.setState({ cursor: i })
  })
  const span = (s: Span, i: number): RenderNode => (
    <Text key={`s${i}`} color={s.color} backgroundColor={s.bg} dimColor={s.dim} bold={s.bold}>
      {s.text}
    </Text>
  )
  const line = (r: ListRow, i: number): RenderNode => {
    if (r.kind === 'gap') return <Text key={`r${i}`}> </Text>
    if (r.kind === 'head')
      return (
        <Text key={`r${i}`} wrap="truncate">
          <Text bold color={r.color}>{r.title}</Text>
          <Text dimColor>{`  ${r.about}`}</Text>
        </Text>
      )
    const here = i === state.cursor
    const value = r.text ? (here && state.draft !== undefined ? `${state.draft}▏` : r.value) : r.value
    return (
      <Text key={`r${i}`} wrap="truncate">
        <Text color={props.accent} bold>{here ? '❯ ' : '  '}</Text>
        <Text dimColor={!here}>{r.label.padEnd(LABEL_WIDTH)}</Text>
        {r.off ? (
          <Text dimColor>{value}</Text>
        ) : r.text ? (
          <Text bold={here}>{value}</Text>
        ) : (
          <Text>
            <Text dimColor>{here ? '‹ ' : '  '}</Text>
            <Text bold={here}>{value}</Text>
            <Text dimColor>{here ? ' ›' : '  '}</Text>
          </Text>
        )}
        {r.off || r.sample.length === 0 ? null : <Text>{'  '}{r.sample.map(span)}</Text>}
        {here && r.text && !r.off ? <Text dimColor>  type, Enter saves</Text> : null}
      </Text>
    )
  }
  return <Box flexDirection="column">{rows.slice(from, to).map((r, i) => line(r, from + i))}</Box>
}

export default List
