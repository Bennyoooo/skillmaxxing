# Skill Maxing

Skill Maxing is a stack for making AI agent skills abundant, installable, self-improving, and manageable at team scale.

The goal is simple: when people think about AI agent skills, they should think about the Skill Maxing ecosystem.

## Vision

Skill Maxing should become the default layer for:

- installing as many useful skills as possible across agents;
- improving those skills as agents use them;
- creating new skills from observed work patterns, chat sessions, and company-tool workflows;
- giving teams a shared system for skill ownership, review, rollout, and maintenance.

## Product Pillars

1. **Skill distribution**
   Install curated skill packs into Codex, Claude Code, Cursor, OpenCode, Hermes, and other agents from one CLI.

2. **Skill creation**
   Convert a chat description, repo scan, agent session, or workflow trace into a `SKILL.md` plus tests, scripts, triggers, and metadata.

3. **Skill improvement**
   Treat skill documents as trainable artifacts. Run tasks, score outcomes, propose bounded edits, validate candidates, and only promote improvements that pass gates.

4. **Team governance**
   Support shared registries, owners, approval rules, rollout channels, deprecation, audit trails, and workspace-level policy.

5. **Context connectors**
   Learn from approved sources such as code repos, docs, tasks, calendars, chat, wikis, ticketing systems, and prior agent sessions without leaking private data by default.

## Reference Systems Studied

- **Aria Labs** at `/Users/bennyjiang/Desktop/projects/aria_agents`
  Local reference for skill maintenance, team/workspace sharing, chat-driven skill creation, and scanning. This session could not read the directory because macOS denied access, so it is tracked as a follow-up reference.

- **Hermes Agent**
  Relevant ideas: a closed learning loop, persistent memory, skill creation from experience, routine/webhook/cron triggers, model-agnostic execution, and agent skills as procedural memory.

- **Microsoft SkillOpt**
  Relevant ideas: skill documents as trainable state, rollout/reflection/update/validation loops, learning-rate-like edit budgets, held-out validation gates, slow updates, and meta-skill memory.

- **Vercel Labs `skills`**
  Relevant ideas: `npx` distribution, GitHub/local source parsing, cross-agent install targets, project/global scopes, symlink/copy strategies, lock files, list/update/remove commands, and agent path detection.

- **gbrain `skillify`**
  Relevant ideas: a concrete quality checklist for durable skills: frontmatter, deterministic scripts, evals, resolver triggers, integration tests, end-to-end smoke tests, and review receipts.

## Proposed CLI

```bash
npx skill-maxing init
npx skill-maxing install --pack core --agent codex --global
npx skill-maxing observe --from codex --since 7d
npx skill-maxing skillify "turn my weekly release workflow into a skill"
npx skill-maxing optimize skills/release-notes
npx skill-maxing team publish skills/release-notes --channel beta
npx skill-maxing doctor
```

## Repository Status

This is the initial planning scaffold. The implementation sequence is documented in [`docs/implementation-phases.md`](docs/implementation-phases.md).
