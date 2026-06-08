---
name: create-skill
description: Create a new reusable agent skill — either explicitly ("turn this workflow into a skill") or by reflecting on a just-completed task that you might do again. Synthesizes SKILL.md, scripts, and a real eval scaffold, then stages it for review before committing. Use when the user asks to make/save/capture a skill, or after finishing a non-trivial workflow worth reusing.
version: 1.0.0
tools: [Bash, Read, Write]
triggers:
  - turn this into a skill
  - make a skill
  - save this workflow
  - capture this as a skill
mutating: true
---

# create-skill

Crystallize a workflow into a durable, tested skill. The CLI is model-agnostic: **you** synthesize the content (name, body, scripts, real eval tasks); the CLI stages, smoke-tests, and commits it atomically.

## Two entry points

1. **Explicit** — the user says "turn X into a skill."
2. **Reflection** — after completing a non-trivial task, consider whether it is reusable. Fire this **sparingly** (review fatigue is real): only when the work was non-trivial (several steps, a fixed bug, a discovered workflow) AND plausibly recurs. When in doubt, don't interrupt.

## Step 0 — Prefer update over create

Before creating, search for an existing skill that already covers this:

```bash
scripts/discover.sh "<capability>" --json
```

If a close match exists, **update or optimize it** instead of making a near-duplicate. The skillify step also runs this check and will refuse with a suggestion unless you pass `--new`.

## Step 1 — Synthesize a draft

Write a draft JSON file. The eval scaffold MUST contain real, scorable tasks (not a stub) — pick a scorer per task: `exact`/`normalized`/`code-exec`/`success-signal` for deterministic outputs, `agent-judge` (with a `rubric`) for prose/judgment skills.

```json
{
  "name": "release-notes",
  "description": "Draft release notes from a git log range.",
  "body": "# release-notes\n\n...instructions...\n",
  "tools": ["Bash"],
  "scripts": [{ "path": "scripts/changelog.sh", "content": "#!/usr/bin/env bash\n..." }],
  "eval": {
    "skill": "release-notes",
    "tasks": [
      { "id": "happy", "input": "v1.0..v1.1", "scorer": "agent-judge", "rubric": "Groups changes by type; no raw SHAs; user-facing tone." }
    ]
  },
  "smokeTest": ["bash", "scripts/changelog.sh", "--help"]
}
```

## Step 2 — Stage (with the human approval gate)

```bash
scripts/skillify.sh --draft draft.json            # stage; smoke test skipped unless authorized
scripts/skillify.sh --draft draft.json --allow-exec   # stage AND run the smoke test in the sandbox
```

Only pass `--allow-exec` after the user has reviewed the generated scripts — a freshly synthesized skill is `trusted: false`, and running its code is a deliberate, user-authorized step. Show the staged `SKILL.md` and scripts to the user and get explicit approval before committing.

## Step 3 — Commit

```bash
scripts/skillify.sh --commit <name> [--global] [--agent <name>]
```

This installs the skill (`trusted: false`) and clears the draft. Staged drafts persist across sessions — resume with `--list-drafts` then `--commit`.

## Safety

- The smoke-test/exec gate is yours to honor: never pass `--allow-exec` without fresh user authorization for the specific scripts.
- Do not commit a skill whose smoke test failed; fix the draft and re-stage.
