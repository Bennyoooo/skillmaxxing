#!/usr/bin/env bash
# Thin wrapper over the skill-maxing CLI's `skillify` command.
set -euo pipefail

if command -v skill-maxing >/dev/null 2>&1; then
  exec skill-maxing skillify "$@"
elif command -v skillmax >/dev/null 2>&1; then
  exec skillmax skillify "$@"
else
  exec npx --yes skill-maxing skillify "$@"
fi
