#!/usr/bin/env bash
# Thin wrapper over the skill-maxing CLI's `optimize` command.
set -euo pipefail

if command -v skill-maxing >/dev/null 2>&1; then
  exec skill-maxing optimize "$@"
elif command -v skillmax >/dev/null 2>&1; then
  exec skillmax optimize "$@"
else
  exec npx --yes skill-maxing optimize "$@"
fi
