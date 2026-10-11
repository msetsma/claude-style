# Sourced by demo.tape in a throwaway HOME: a small project, a Claude Code config
# with no first-run screens, and the fake API from fake-api.mjs.
unset ${!CLAUDE@} ${!ANTHROPIC@}
export ANTHROPIC_BASE_URL=http://127.0.0.1:8787 ANTHROPIC_API_KEY=sk-ant-demo-0000000000000000000000
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 DISABLE_AUTOUPDATER=1
node "$REPO/demo/fake-api.mjs" 8787 &

mkdir -p ~/my-project/src ~/.claude && cd ~/my-project
printf 'const live = (exp, now) => !(exp < now)\n' > src/login.ts
printf '{ "name": "my-project", "scripts": { "test": "echo 14 pass; echo 0 fail" } }\n' > package.json

cat > ~/.claude/settings.json <<'JSON'
{
  "permissions": { "defaultMode": "auto", "allow": ["Read", "Edit", "Bash(npm test)"] },
  "spinnerTipsEnabled": false
}
JSON
cat > ~/.claude.json <<JSON
{
  "hasCompletedOnboarding": true,
  "lastOnboardingVersion": "$(claude --version | cut -d' ' -f1)",
  "lastReleaseNotesSeen": "$(claude --version | cut -d' ' -f1)",
  "numStartups": 20,
  "verbose": true,
  "hasSeenAutoModeEntryWarning": true,
  "theme": "dark",
  "autoUpdates": false,
  "customApiKeyResponses": { "approved": ["${ANTHROPIC_API_KEY: -20}"], "rejected": [] },
  "projects": { "$PWD": { "hasTrustDialogAccepted": true, "hasCompletedProjectOnboarding": true } }
}
JSON
