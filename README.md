# Skill Maxing

Skill Maxing is a stack for making AI agent skills abundant, installable, self-improving, and manageable at team scale.

The goal is simple: when people think about AI agent skills, they should think about the Skill Maxing ecosystem.

## Vision

Skill Maxing should become the default layer for:

- installing as many useful skills as possible across agents;
- creating new skills as you work — the agent gets smarter with every task;
- improving those skills through evaluation-gated optimization;
- discovering the right skill from a pool of thousands;
- giving teams a shared system for skill ownership, review, rollout, and maintenance.

## Product Pillars

1. **Skill creation maxxing**
   Create skills as you work, whatever agent you are using. The agent reflects on completed tasks, identifies reusable patterns, and crystallizes them as skills. It gets smarter over time.

2. **Skill discovery maxxing**
   Find the right skill from a pool of over 1000 skills. Semantic search by capability, agent, tools, and use case. Curated packs for immediate value.

3. **Skill evolvement maxxing**
   Treat skill documents as trainable artifacts. Run tasks, score outcomes, propose bounded edits, validate candidates, and only promote improvements that pass gates. Every version is score-linked and reversible.

4. **Skill distribution**
   Install curated skill packs into Codex, Claude Code, Cursor, OpenCode, Hermes, and other agents from one CLI. Lock files for reproducibility. Doctor command for health.

5. **Skill sharing maxxing** (later phase — requires external infra)
   Share skills with your team per your approval. Team knowledge compounds. Private registries, release channels, review flows, audit trails.

6. **Skills scanning maxxing** (later phase — requires rigorous design)
   Scan your tools, email, code, chat, and discover skillable traces. Create skills from observed workflow patterns automatically.

## Reference Systems Studied

- **Hermes Agent** ([repo](https://github.com/NousResearch/hermes-agent))
  The "create skills as you work" reference. Post-task reflection loop, procedural memory, confidence tracking, retrieval-augmented execution, cron/webhook routines, model-agnostic execution.

- **Microsoft SkillOpt** ([repo](https://github.com/microsoft/SkillOpt))
  The skill optimization reference. Skill documents as trainable state, five-phase optimization loop, edit budgets, rejected edit buffer, validation gates, meta-skill memory.

- **Vercel Labs `skills`** ([repo](https://github.com/vercel-labs/skills))
  The installer reference. `npx` distribution, GitHub/local source parsing, cross-agent install targets, lock files, doctor command, path sanitization.

- **gbrain `skillify` (gstack)** (local: `/Users/bennyjiang/Desktop/projects/skillmaxxing/gstack`)
  The quality reference. 11-step atomic stage-test-approve-commit pipeline, HostConfig cross-agent adapter system, JSONL operational learning, quality checklist with receipts.

- **Aria Labs** (local: `/Users/bennyjiang/Desktop/projects/aria_agents`)
  Team sharing reference. Not yet inspected (macOS permission block). Expected: team/workspace skill sharing, chat-driven creation, scan-based creation.

## Proposed CLI

```bash
npx skill-maxing init
npx skill-maxing install --pack core --agent codex --global
npx skill-maxing discover "code review"
npx skill-maxing skillify "turn my weekly release workflow into a skill"
npx skill-maxing optimize skills/release-notes
npx skill-maxing doctor
npx skill-maxing learn                           # show what the agent has learned
npx skill-maxing team publish skills/release-notes --channel beta  # later phase
npx skill-maxing observe --from codex --since 7d                   # later phase
```

## Implementation Phases (reordered)

| Phase | Name | Status | Key reference |
|-------|------|--------|---------------|
| 0 | Repo foundation | Done | — |
| 1 | Cross-agent installer | Next | Vercel skills, gstack HostConfig |
| 2 | Curated packs + discovery | — | — |
| 3a | Skillify pipeline | — | gstack skillify |
| 3b | In-session skill capture | — | Hermes Agent |
| 4 | Evaluation-gated optimization | — | SkillOpt |
| 5 | Observation / workflow mining | Deferred | Hermes routines |
| 6 | Team registry / governance | Deferred | Aria Labs |
| 7 | Automation | — | Hermes routines |
| 8 | Public ecosystem | — | — |

Sharing (Phase 6) and scanning (Phase 5) are deferred because they require external infrastructure and more rigorous design. The core loop ships first.

Full details: [`docs/implementation-phases.md`](docs/implementation-phases.md).

## Repository Status

The implementation sequence and reference analysis are documented in:
- [`docs/implementation-phases.md`](docs/implementation-phases.md) — phased plan
- [`docs/architecture.md`](docs/architecture.md) — system layers
- [`docs/reference-notes.md`](docs/reference-notes.md) — deep analysis of reference repos
