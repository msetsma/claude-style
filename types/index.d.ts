// The terminal's border styles a frame may take, and the theme keys a frame may be colored with.
export type Border = 'round' | 'single' | 'double' | 'bold' | 'dashed' | 'classic'
export type Accent =
  | 'subtle'
  | 'claude'
  | 'suggestion'
  | 'promptBorder'
  | 'permission'
  | 'success'
  | 'warning'
  | 'ide'
  | 'planMode'
// A per-site setting that says 'global' takes the global border or accent.
export type SiteBorder = 'global' | Border
export type SiteColor = 'global' | Accent
// Who draws a site: this mod, in the settings below it, or Claude Code as it would without the mod.
export type DrawnBy = 'style' | 'claude'

export type Settings = {
  border: Border
  accent: Accent
  density: 'compact' | 'normal' | 'roomy'
  prompts: DrawnBy
  promptStyle: 'bubble' | 'bar' | 'plain'
  promptColor: SiteColor
  bands: DrawnBy
  bandBorder: SiteBorder
  tools: DrawnBy
  toolStyle: 'card' | 'rail' | 'compact'
  toolColor: 'tool' | 'status' | 'mono'
  toolResult: 'full' | 'summary' | 'hidden'
  notices: DrawnBy
  noticeStyle: 'card' | 'line'
  noticeColor: SiteColor
  mode: DrawnBy
  modeStyle: 'pills' | 'brackets' | 'plain'
  modeColor: SiteColor
  hint: DrawnBy
  hintColor: SiteColor
  hintDim: 'on' | 'off'
  questions: DrawnBy
  questionFrame: SiteBorder
  questionColor: SiteColor
  turnTime: DrawnBy
  durationStyle: 'rule' | 'compact' | 'hidden'
  durationVerb: 'on' | 'off'
}
// Inside the block below `Settings` names claude-code's own type, so refer to ours by another name.
export type StyleSettings = Settings

declare module 'claude-code' {
  interface PluginState {
    style: { settings: StyleSettings }
  }
}
