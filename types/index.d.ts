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

export type Settings = {
  border: Border
  accent: Accent
  density: 'compact' | 'normal' | 'roomy'
  promptStyle: 'bubble' | 'bar' | 'plain' | 'off'
  promptColor: SiteColor
  bandFrame: 'on' | 'off'
  bandBorder: SiteBorder
  toolStyle: 'card' | 'rail' | 'compact' | 'off'
  toolColor: 'tool' | 'status' | 'mono'
  toolResult: 'full' | 'summary' | 'hidden'
  noticeStyle: 'card' | 'line' | 'off'
  noticeColor: SiteColor
  modeStyle: 'pills' | 'brackets' | 'plain' | 'off'
  modeColor: SiteColor
  hintColor: 'original' | SiteColor
  hintDim: 'on' | 'off'
  questionFrame: 'off' | SiteBorder
  questionColor: SiteColor
  durationStyle: 'rule' | 'compact' | 'original' | 'hidden'
  durationVerb: 'on' | 'off'
}
// Inside the block below `Settings` names claude-code's own type, so refer to ours by another name.
export type StyleSettings = Settings

declare module 'claude-code' {
  interface PluginState {
    style: { settings: StyleSettings }
  }
}
