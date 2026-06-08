---
name: optimize-skill
description: Improve an existing skill through an evaluation-gated loop — run it on its eval tasks, analyze failures, propose bounded edits, validate a candidate, and (with your approval) promote a strictly-better version. Use when a skill underperforms or the user asks to optimize/tune/improve a skill that has an eval set.
version: 1.0.0
tools: [Bash, Read, Write]
triggers:
  - optimize the skill
  - improve this skill
  - tune the skill
mutating: true
---

# optimize-skill

Make a skill measurably better without uncontrolled drift. This is an **agent-in-the-loop** loop, not a hands-off run: the CLI owns the deterministic machinery (scoring, edit budget, rejected-edit buffer, the gate, atomic promote/revert); **you** own the reasoning (running the skill, judging prose outputs, proposing edits). Expect several turns per optimization.

## Preconditions

- The skill has an eval manifest (`eval.yaml`) with real tasks. If it has none, stop and offer to create one (`create-skill`) — optimization cannot run without an eval set.
- Optimization edits a **managed copy**, never the installed symlink target.

## The loop (repeat until the gate stops improving)

1. **Rollout.** For each eval task `input`, run the current skill yourself and collect its output. Write `rollouts.json`: `[{ "taskId": "...", "output": "..." }]`.

2. **Score.**

   ```bash
   scripts/optimize.sh score --eval eval.yaml --rollouts rollouts.json --skill <name> --json
   ```

   Deterministic tasks are scored for you. `agent-judge` tasks come back as **pending** — score those yourself against each task's rubric and fold them into the aggregate. Record the current score.

3. **Reflect.** Read the failing trajectories. Diagnose *why* they failed (this is your job — the CLI never judges why). Propose a small set of structured edits to `SKILL.md`. Write `edits.json`: an array of `{ op: append|insert_after|replace|delete, target?, content?, sourceType: "failure"|"success", supportCount? }`. Prefer failure-driven edits.

4. **Apply (bounded).**

   ```bash
   scripts/optimize.sh apply --skill <name> --skill-dir <live-dir> --edits edits.json --step <n> --total <N>
   ```

   The CLI caps edits at the budget (annealed over steps), skips edits to the protected `SLOW_UPDATE` region, and writes a candidate copy. Note the candidate dir it prints.

5. **Validate.** Re-run rollout + score against the candidate (steps 1–2 pointing at the candidate dir), including the held-out tasks. Then gate:

   ```bash
   scripts/optimize.sh gate --current <currentScore> --candidate <candidateScore> --best <bestScore>
   ```

   A non-zero exit means reject — add those edits to your rejected set so you don't re-propose them, and try a different reflection. Also reject if any **held-out** task regressed, even if the aggregate improved.

6. **Promote (human gate).** Only on a strict improvement with no held-out regression, present the candidate and its score delta to the user. On their approval:

   ```bash
   scripts/optimize.sh promote --skill <name> --live <live-dir> --candidate <candidate-dir> --score <candidateScore>
   ```

   The prior version is retained and the change is reversible.

## Revert

```bash
scripts/optimize.sh revert --skill <name> --version <prior-version> --live <live-dir>
```

## Honesty

- "Optimize automatically" means the loop, budget, buffer, and gates are automated — the intelligence (rollout, reflection, edits, agent-judge) is yours. A weak reasoning pass simply makes less progress; the gate guarantees no regression is ever promoted.
- Never promote without explicit user approval, even when the gate passes.
