# Implementation Phases

This plan builds Skill Maxing from a useful installer into a self-improving skill ecosystem.

## Phase 0: Product Definition And Repo Foundation

Goal: make the project understandable and contributor-ready.

Deliverables:

- public repo, README, license, and roadmap;
- CLI package skeleton;
- architecture document;
- reference analysis from Aria Labs, Hermes Agent, SkillOpt, Vercel `skills`, and gbrain `skillify`;
- initial issue backlog.

Exit criteria:

- a new contributor can understand the product surface in under 10 minutes;
- the CLI builds and prints planned commands.

## Phase 1: Cross-Agent Skill Installer

Goal: install skills into many agents reliably.

Deliverables:

- `skill-maxing init`;
- `skill-maxing install`;
- `skill-maxing list`;
- `skill-maxing update`;
- `skill-maxing remove`;
- agent adapter map for Codex, Claude Code, Cursor, OpenCode, and Hermes;
- project/global scope support;
- symlink/copy install modes;
- lock file for reproducible skill installs.

Reference influence:

- Vercel `skills` package for source parsing, supported-agent paths, and `npx` distribution.

Exit criteria:

- install a local skill folder and a GitHub skill repo into Codex and Claude Code;
- list and remove installed skills cleanly;
- CI covers path traversal, name sanitization, and cross-platform path handling.

## Phase 2: Curated Skill Packs

Goal: make the product valuable immediately after install.

Deliverables:

- `core` pack with broadly useful coding-agent skills;
- `team` pack for repo review, release notes, task triage, docs updates, and planning;
- `personal` pack for memory, preference capture, and workflow automation;
- pack metadata, dependency support, and compatibility tags.

Exit criteria:

- `npx skill-maxing install --pack core --agent codex --global` gives a meaningful default skill set;
- skills are searchable by capability, agent, tools, and mutating behavior.

## Phase 3: Skillify Pipeline

Goal: create high-quality skills from descriptions, repo scans, and repeated workflows.

Deliverables:

- `skill-maxing skillify`;
- frontmatter and body templates;
- deterministic script extraction when needed;
- resolver trigger generation;
- unit test and eval scaffold generation;
- quality checklist command;
- review receipt format.

Reference influence:

- gbrain `skillify` for the checklist: `SKILL.md`, code, evals, resolver triggers, integration tests, end-to-end tests, and filing rules.
- Aria Labs for chat-driven creation and scanning once the local reference can be inspected.

Exit criteria:

- a user can say "turn my release notes process into a skill" and get a reviewable skill directory;
- generated skills pass structural validation and have at least one executable smoke test.

## Phase 4: Observation And Workflow Mining

Goal: learn from how people actually use agents.

Deliverables:

- opt-in local trace store;
- adapters for Codex/Claude/Hermes session logs where available;
- shell/tool-call summarization;
- repeated workflow clustering;
- connector interface for docs, tasks, chats, calendars, repos, and wikis;
- redaction pipeline and privacy policy.

Exit criteria:

- the system can identify repeated workflows from local sessions and propose candidate skills;
- raw trace export is disabled by default;
- users can inspect, delete, or approve every candidate before skill creation.

## Phase 5: Evaluation-Gated Skill Optimization

Goal: make skills improve over time without uncontrolled prompt drift.

Deliverables:

- `skill-maxing optimize`;
- skill eval set format;
- rollout runner;
- scoring adapters: deterministic checks, LLM judges, and human review;
- bounded edit generation;
- validation gate;
- promotion/rejection logs;
- meta-skill memory for longitudinal guidance.

Reference influence:

- SkillOpt for rollout, reflection, aggregation, edit-budget selection, validation gates, slow updates, and meta-skill memory.
- Hermes Agent for a closed loop where skills improve during use.

Exit criteria:

- an optimization run produces candidate edits and promotes only validated improvements;
- every accepted skill version has a score delta, test result, and rollback path;
- failed edits are stored as learning data, not silently discarded.

## Phase 6: Team Registry And Governance

Goal: make skills maintainable in teams and workspaces.

Deliverables:

- private team registry;
- ownership metadata;
- review and approval flow;
- release channels: `dev`, `beta`, `stable`;
- workspace policy file;
- skill deprecation and migration notices;
- audit log;
- team sync command.

Reference influence:

- Aria Labs for team/workspace skill sharing and maintenance once readable.

Exit criteria:

- teams can publish a skill to beta, collect feedback, and promote it to stable;
- mutating skills require explicit policy approval;
- installs can be pinned to stable versions.

## Phase 7: Automation And Self-Maintenance

Goal: make the ecosystem run regular upkeep with minimal human effort.

Deliverables:

- scheduled skill health checks;
- stale skill detection;
- docs drift detection;
- connector-driven candidate generation;
- webhook/API triggers;
- notification integrations.

Reference influence:

- Hermes routines: cron, webhook, API-triggered work, delivery targets, and model-agnostic execution.

Exit criteria:

- teams can schedule weekly skill maintenance reports;
- the system opens reviewable proposals instead of mutating stable skills directly.

## Phase 8: Public Ecosystem

Goal: make Skill Maxing the default place to discover and distribute skills.

Deliverables:

- public skill index;
- publisher workflow;
- trust signals and verified packs;
- compatibility badges;
- search UI/API;
- contribution guide;
- examples and templates.

Exit criteria:

- external authors can publish skills;
- users can search, inspect, install, update, and review skills from one ecosystem.
