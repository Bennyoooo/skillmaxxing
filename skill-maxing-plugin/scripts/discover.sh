#!/usr/bin/env bash
# Thin wrapper over the skillmaxxing CLI's `discover` command.
# Prefers a globally installed `skillmaxxing`/`skillmax` binary; falls back to npx.
set -euo pipefail

if command -v skillmaxxing >/dev/null 2>&1; then
  exec skillmaxxing discover "$@"
elif command -v skillmax >/dev/null 2>&1; then
  exec skillmax discover "$@"
else
  exec npx --yes skillmaxxing discover "$@"
fi
