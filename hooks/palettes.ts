import type { Color, ThemeKey } from 'claude-code'

import type { Accent, Fill, PaletteName, StyleSettings as Settings } from '../types'

// The nine slots in pane order: slot 1 is `subtle`, slot 9 `planMode`.
export const ACCENTS: Accent[] = ['subtle', 'claude', 'suggestion', 'promptBorder', 'permission', 'success', 'warning', 'ide', 'planMode']

// What a slot or role paints in: the theme's key, or a built-in palette's hex.
// `error` and `bash` color tool rows; `surface` is a card's tint; `ink` is text on a slot's fill.
type Role = Accent | 'error' | 'bash' | 'surface' | 'ink'
type Palette = { name: string; colors: Record<Role, string> }

// Nine slots in order (muted, brand, blue, light, purple, green, yellow, cyan, accent), then the roles.
const palette = (name: string, slots: string[], error: string, bash: string, surface: string, ink: string): Palette => ({
  name,
  colors: { ...(Object.fromEntries(ACCENTS.map((a, i) => [a, slots[i]])) as Record<Accent, string>), error, bash, surface, ink },
})

// The ten most used editor and terminal themes, each in its dark variant.
const BUILT_IN: Record<Exclude<PaletteName, 'theme'>, Palette> = {
  catppuccin: palette('Catppuccin', ['#7f849c', '#fab387', '#89b4fa', '#b4befe', '#cba6f7', '#a6e3a1', '#f9e2af', '#89dceb', '#f5c2e7'], '#f38ba8', '#f5c2e7', '#313244', '#1e1e2e'),
  dracula: palette('Dracula', ['#6272a4', '#ffb86c', '#8be9fd', '#f8f8f2', '#bd93f9', '#50fa7b', '#f1fa8c', '#8be9fd', '#ff79c6'], '#ff5555', '#ff79c6', '#44475a', '#282a36'),
  tokyonight: palette('Tokyo Night', ['#565f89', '#ff9e64', '#7aa2f7', '#c0caf5', '#bb9af7', '#9ece6a', '#e0af68', '#7dcfff', '#73daca'], '#f7768e', '#bb9af7', '#292e42', '#1a1b26'),
  gruvbox: palette('Gruvbox', ['#928374', '#fe8019', '#83a598', '#ebdbb2', '#d3869b', '#b8bb26', '#fabd2f', '#8ec07c', '#689d6a'], '#fb4934', '#d3869b', '#3c3836', '#282828'),
  nord: palette('Nord', ['#616e88', '#d08770', '#81a1c1', '#d8dee9', '#b48ead', '#a3be8c', '#ebcb8b', '#88c0d0', '#8fbcbb'], '#bf616a', '#b48ead', '#3b4252', '#2e3440'),
  onedark: palette('One Dark', ['#5c6370', '#d19a66', '#61afef', '#abb2bf', '#c678dd', '#98c379', '#e5c07b', '#56b6c2', '#be5046'], '#e06c75', '#c678dd', '#2c313a', '#282c34'),
  solarized: palette('Solarized', ['#586e75', '#cb4b16', '#268bd2', '#93a1a1', '#6c71c4', '#859900', '#b58900', '#2aa198', '#d33682'], '#dc322f', '#d33682', '#073642', '#002b36'),
  rosepine: palette('Rosé Pine', ['#6e6a86', '#ebbcba', '#9ccfd8', '#e0def4', '#c4a7e7', '#31748f', '#f6c177', '#9ccfd8', '#eb6f92'], '#eb6f92', '#c4a7e7', '#26233a', '#191724'),
  monokai: palette('Monokai', ['#75715e', '#fd971f', '#66d9ef', '#f8f8f2', '#ae81ff', '#a6e22e', '#e6db74', '#66d9ef', '#f92672'], '#f92672', '#ae81ff', '#3e3d32', '#272822'),
  everforest: palette('Everforest', ['#859289', '#e69875', '#7fbbb3', '#d3c6aa', '#d699b6', '#a7c080', '#dbbc7f', '#83c092', '#e67e80'], '#e67e80', '#d699b6', '#374145', '#2d353b'),
}

export const PALETTES: PaletteName[] = ['theme', ...(Object.keys(BUILT_IN) as Exclude<PaletteName, 'theme'>[])]

// The theme palette: each slot is its own theme key, so custom Claude Code themes apply.
const THEME: Record<Role, ThemeKey | undefined> = {
  ...(Object.fromEntries(ACCENTS.map(a => [a, a])) as Record<Accent, ThemeKey>),
  error: 'error',
  bash: 'bashBorder',
  // No theme key is a neutral background; a surface fill under `theme` draws none.
  surface: undefined,
  ink: 'inverseText',
}

export const paletteName = (p: PaletteName) => (p === 'theme' ? 'Claude theme' : BUILT_IN[p].name)

/** The color a slot or role paints in under the settings' palette. */
export function paint(s: Pick<Settings, 'palette'>, role: Role): Color | undefined {
  return s.palette === 'theme' ? THEME[role] : BUILT_IN[s.palette].colors[role]
}

/** A card's background and the text color that reads on it; both undefined for none. */
export function fillOf(s: Pick<Settings, 'palette'>, fill: Fill): { bg?: Color; fg?: Color } {
  if (fill === 'none') return {}
  if (fill === 'surface') return { bg: paint(s, 'surface') }
  return { bg: paint(s, fill), fg: paint(s, 'ink') }
}
