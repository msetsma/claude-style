# Regenerate with `vhs demo/demo.tape` (or `demo-gif demo/demo.tape`) from the repo root.
# Needs: vhs, node, claude. Runs offline against demo/fake-api.mjs.
Output "demo/demo.gif"

Set Shell bash
Set FontSize 18
Set Width 1440
Set Height 820
Set Padding 16
Set Theme "Catppuccin Mocha"
Set TypingSpeed 60ms
Set Framerate 15

# Hidden setup: a throwaway HOME keeps your real config and paths out of the
# recording. pwd -P matters on macOS, where temp dirs resolve under /private.
# One scripted turn runs, then the /style pane opens beside it.
Hide
Type@1ms `REPO="$PWD"; export HOME="$(cd "$(mktemp -d)" && pwd -P)" PS1='$ '; source "$REPO/demo/setup.sh"; clear`
Enter
Type@1ms `claude --plugin-dir "$REPO" "fix the login bug"`
Enter
Wait+Screen@60s /[A-Z][a-z]+ [0-9]+s ─/
Type@1ms "/style"
Sleep 300ms
Enter
Wait+Screen@10s /Press a row/
Sleep 500ms
Show

# Defaults: the border every site inherits. The pane opens with nothing focused.
Sleep 300ms
Tab Sleep 500ms
Enter Sleep 1.2s
Enter Sleep 1.5s

# Defaults: the accent color.
Tab Sleep 600ms
Enter Sleep 1.5s

# Your prompts: bubble to bar.
Tab@200ms 3 Sleep 600ms
Enter Sleep 2s

# Tool calls: handed back to Claude Code, then style's compact and card.
Tab@200ms 4 Sleep 600ms
Enter Sleep 2.5s
Enter Sleep 1.2s
Tab Sleep 600ms
Enter Sleep 2s
Enter Sleep 2.5s
