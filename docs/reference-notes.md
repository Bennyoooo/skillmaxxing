# Reference Notes

## Aria Labs

Path: `/Users/bennyjiang/Desktop/projects/aria_agents`

Status: not inspected in this session. macOS returned `Operation not permitted` when reading the directory.

Expected areas to study next:

- team/workspace skill sharing;
- skill maintenance workflows;
- chat-driven skill creation;
- scan-based skill creation;
- storage and permissions model.

## Hermes Agent

Useful patterns:

- self-improving agent positioned around a built-in learning loop;
- skills as procedural memory;
- skills created from experience;
- model-agnostic execution;
- persistent memory and session search;
- cron, webhook, and API-triggered automations;
- delivery into messaging platforms and local files.

Implication for Skill Maxing:

- do not make skill improvement a one-shot generator;
- build a recurring loop that observes, proposes, validates, and promotes;
- keep execution model-agnostic and agent-agnostic.

## SkillOpt

Useful patterns:

- skill document is the trainable state;
- optimizer model proposes bounded textual edits;
- target model stays frozen;
- validation gates prevent regressions;
- rejected edit buffer prevents repeated bad updates;
- slow updates and meta-skill memory capture longitudinal learning.

Implication for Skill Maxing:

- every auto-improvement needs evaluation evidence;
- accepted skill versions should be score-linked and reversible;
- inference should use the compact skill artifact, not the training machinery.

## Vercel Labs `skills`

Useful patterns:

- `npx`-first distribution;
- GitHub shorthand, full URL, git URL, and local path sources;
- project and global install scopes;
- cross-agent adapter table;
- symlink and copy modes;
- list/find/update/remove/init commands;
- lock files and path sanitization tests.

Implication for Skill Maxing:

- Phase 1 should be a solid installer before advanced self-improvement work;
- compatibility should be metadata-driven rather than hardcoded throughout the codebase.

## gbrain `skillify`

Useful patterns:

- "properly skilled" means more than `SKILL.md`;
- require triggers, code extraction, tests, evals, resolver routing, and smoke checks;
- quality gates should happen before tests lock in mediocre behavior;
- receipts make skill quality auditable.

Implication for Skill Maxing:

- generated skills should be reviewable artifacts with tests and provenance;
- team promotion should require receipts, not just author confidence.
