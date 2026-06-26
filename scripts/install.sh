#!/usr/bin/env sh
# One-line installer for the Skill Maxing self-evolving plugin.
#   curl -fsSL https://raw.githubusercontent.com/Bennyoooo/skillmaxxing/main/scripts/install.sh | sh
#
# Installs the CLI globally and wires the agent hooks. Falls back to npx-based
# hooks if a global install isn't possible (e.g. permissions). Extra args after
# `-s --` are forwarded to `plugin install` (e.g. --agent codex, --mode nudge).
set -eu

if ! command -v node >/dev/null 2>&1; then
  echo "Skill Maxing needs Node.js >= 20. Install it from https://nodejs.org and re-run." >&2
  exit 1
fi

major=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
if [ "$major" -lt 20 ]; then
  echo "Skill Maxing needs Node.js >= 20 (found $(node -v)). Please upgrade." >&2
  exit 1
fi

if npm i -g skillmaxxing >/dev/null 2>&1; then
  echo "Installed skillmaxxing globally."
  skillmaxxing plugin install "$@"
else
  echo "Global install unavailable (permissions?) — wiring npx-based hooks instead." >&2
  npx -y skillmaxxing plugin install "$@"
fi

echo "Done. Restart your agent session to activate Skill Maxing."
