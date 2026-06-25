#!/usr/bin/env bash
# Thin wrapper over the skillmaxxing CLI's `workspace` command.
set -euo pipefail

if command -v skillmaxxing >/dev/null 2>&1; then
  exec skillmaxxing workspace "$@"
elif command -v skillmax >/dev/null 2>&1; then
  exec skillmax workspace "$@"
else
  exec npx --yes skillmaxxing workspace "$@"
fi
