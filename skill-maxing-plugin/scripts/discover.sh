#!/usr/bin/env bash
# Thin wrapper over the skill-maxing CLI's `discover` command.
# Prefers a globally installed `skill-maxing`/`skillmax` binary; falls back to npx.
set -euo pipefail

if command -v skill-maxing >/dev/null 2>&1; then
  exec skill-maxing discover "$@"
elif command -v skillmax >/dev/null 2>&1; then
  exec skillmax discover "$@"
else
  exec npx --yes skill-maxing discover "$@"
fi
