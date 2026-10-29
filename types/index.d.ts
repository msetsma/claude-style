// The terminal's border styles a frame may take, and the color slots a frame may be colored with.
export type Border = 'round' | 'single' | 'double' | 'bold' | 'dashed' | 'classic'
// The nine color slots, numbered 1-9 in the pane. Under the `theme` palette each is the Claude
// Code theme key of its name; under a built-in palette, that palette's color in the slot.
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
export type PaletteName =
  | 'theme'
  | 'catppuccin'
  | 'dracula'
  | 'tokyonight'
  | 'gruvbox'
  | 'nord'
  | 'onedark'
  | 'solarized'
  | 'rosepine'
  | 'monokai'
  | 'everforest'
// A per-site setting that says 'global' takes the global border or accent.
export type SiteBorder = 'global' | Border
export type SiteColor = 'global' | Accent
// A card's background: none, the palette's surface tint, or a slot's color with dark text.
export type Fill = 'none' | 'surface' | Accent
// Who draws a site: this mod, in the settings below it, or Claude Code as it would without the mod.
export type DrawnBy = 'style' | 'claude'

export type Settings = {
  palette: PaletteName
  border: Border
  accent: Accent
  density: 'compact' | 'normal' | 'roomy'
  labels: 'border' | 'inside'
  prompts: DrawnBy
  promptStyle: 'bubble' | 'bar' | 'plain'
  promptAlign: 'left' | 'right'
  promptColor: SiteColor
  promptFill: Fill
  promptLabel: string
  replies: DrawnBy
  replyStyle: 'card' | 'rail' | 'rule'
  replyColor: SiteColor
  replyFill: Fill
  replyLabel: 'on' | 'off'
  replyName: string
  replyWidth: 'full' | 'fit'
  bands: DrawnBy
  bandBorder: SiteBorder
  bandLabel: string
  tools: DrawnBy
  toolStyle: 'card' | 'rail' | 'compact'
  toolColor: 'tool' | 'status' | 'mono'
  toolFill: Fill
  toolResult: 'full' | 'summary' | 'hidden'
  notices: DrawnBy
  noticeStyle: 'card' | 'line'
  noticeColor: SiteColor
  noticeLabel: string
  mode: DrawnBy
  modeStyle: 'pills' | 'caps' | 'nerd' | 'brackets' | 'plain'
  modeColor: SiteColor
  hint: DrawnBy
  hintColor: SiteColor
  hintDim: 'on' | 'off'
  questions: DrawnBy
  questionFrame: SiteBorder
  questionColor: SiteColor
  questionLabel: string
  turnTime: DrawnBy
  durationStyle: 'rule' | 'compact' | 'hidden'
  durationVerb: 'on' | 'off'
}
// Inside the block below `Settings` names claude-code's own type, so refer to ours by another name.
export type StyleSettings = Settings

declare module 'claude-code' {
  interface PluginState {
    style: {
      settings: StyleSettings
      // Tool calls whose folded output the person opened, by tool_use_id.
      opened: string[]
    }
  }
}
