#!/usr/bin/env bash
# Thin wrapper over the skillmaxxing CLI's `optimize` command.
set -euo pipefail

if command -v skillmaxxing >/dev/null 2>&1; then
  exec skillmaxxing optimize "$@"
elif command -v skillmax >/dev/null 2>&1; then
  exec skillmax optimize "$@"
else
  exec npx --yes skillmaxxing optimize "$@"
fi
