#!/usr/bin/env bash
# Thin wrapper over the skillmaxxing CLI's `skillify` command.
set -euo pipefail

if command -v skillmaxxing >/dev/null 2>&1; then
  exec skillmaxxing skillify "$@"
elif command -v skillmax >/dev/null 2>&1; then
  exec skillmax skillify "$@"
else
  exec npx --yes skillmaxxing skillify "$@"
fi
