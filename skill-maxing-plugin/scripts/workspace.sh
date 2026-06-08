#!/usr/bin/env bash
# Thin wrapper over the skill-maxing CLI's `workspace` command.
set -euo pipefail

if command -v skill-maxing >/dev/null 2>&1; then
  exec skill-maxing workspace "$@"
elif command -v skillmax >/dev/null 2>&1; then
  exec skillmax workspace "$@"
else
  exec npx --yes skill-maxing workspace "$@"
fi
