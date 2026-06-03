# Implementation Phases

This plan builds Skill Maxing from a useful installer into a self-improving skill ecosystem.

Sharing (team governance) and scanning (observation/workflow mining) are deferred to later phases because they require external infrastructure and more rigorous design. The core loop — install, create, improve, discover — ships first.

## Phase 0: Product Definition And Repo Foundation

Goal: make the project understandable and contributor-ready.

Status: complete.

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
- `skill-maxing install` (from GitHub shorthand, URL, git URL, local path);
- `skill-maxing list`;
- `skill-maxing update`;
- `skill-maxing remove`;
- `skill-maxing doctor` (agent integration health check);
- agent adapter map using a declarative `HostConfig`-style interface;
- initial agent support: Codex, Claude Code, Cursor, OpenCode, Hermes;
- project/global scope support;
- symlink/copy install modes;
- lock file for reproducible skill installs;
- path sanitization and name validation.

Reference influence:

- Vercel `skills` package for source parsing, supported-agent paths, lock file format, and `npx` distribution.
- gstack `HostConfig` interface for declarative agent adapter definitions.

Exit criteria:

- install a local skill folder and a GitHub skill repo into Codex and Claude Code;
- list and remove installed skills cleanly;
- `doctor` detects broken symlinks, missing agents, stale installs;
- lock file records exact commit SHA for remote sources;
- CI covers path traversal, name sanitization, and cross-platform path handling.

## Phase 2: Curated Skill Packs And Discovery

Goal: make the product valuable immediately after install, and discoverable.

Deliverables:

- `core` pack with broadly useful coding-agent skills;
- `team` pack for repo review, release notes, task triage, docs updates, and planning;
- `personal` pack for memory, preference capture, and workflow automation;
- pack metadata, dependency support, and compatibility tags;
- `skill-maxing discover` / `skill-maxing search` for semantic matching against installed and available skills;
- capability-based search (by tool, by agent, by use case).

Exit criteria:

- `npx skill-maxing install --pack core --agent codex --global` gives a meaningful default skill set;
- skills are searchable by capability, agent, tools, and mutating behavior;
- `skill-maxing discover "code review"` finds relevant skills across installed packs.

## Phase 3: Skillify Pipeline And In-Session Skill Capture

Goal: create high-quality skills from descriptions, repo scans, and repeated workflows. Also enable the "create skills as you work" loop.

### Phase 3a: Explicit skill creation

Deliverables:

- `skill-maxing skillify` (explicit creation from description or workflow);
- frontmatter and body templates;
- deterministic script extraction when needed;
- resolver trigger generation;
- unit test and eval scaffold generation;
- quality checklist command;
- review receipt format;
- eval schema definition (task set + scoring contract) — defined here, not deferred to Phase 4.

Reference influence:

- gbrain `skillify` for the atomic stage-test-approve-commit pipeline and quality checklist.
- Aria Labs for chat-driven creation once the local reference can be inspected.

Exit criteria:

- a user can say "turn my release notes process into a skill" and get a reviewable skill directory;
- generated skills pass structural validation and have at least one executable smoke test;
- every generated skill includes an eval scaffold.

### Phase 3b: In-session skill capture ("create skills as you work")

This is the Hermes-inspired post-task reflection loop. The mechanism:

1. After completing a task, the agent reflects on whether the workflow is reusable.
2. If it identifies a repeated or generalizable pattern, it proposes crystallizing it as a skill.
3. The user approves, and the skillify pipeline (3a) handles creation.
4. The skill is stored with confidence tracking — how many times it's been used and succeeded.

Deliverables:

- post-task reflection hook that any agent can trigger;
- pattern detection: identify when a workflow has been done 2+ times in similar form;
- confidence tracking on created skills (usage count, success rate);
- retrieval-augmented execution: search existing skills before starting a new task;
- JSONL-based operational learning log (inspired by gstack's learn system).

Reference influence:

- Hermes Agent for the always-on reflection loop, procedural memory, and confidence tracking.
- gstack `learn` system for JSONL operational learning with search, prune, and export.

Exit criteria:

- after completing a task, the system can identify whether it matches an existing skill or should become one;
- repeated workflows are flagged for skill creation without the user explicitly requesting it;
- skills track usage confidence and surface high-confidence skills preferentially.

## Phase 4: Evaluation-Gated Skill Optimization

Goal: make skills improve over time without uncontrolled prompt drift.

Deliverables:

- `skill-maxing optimize`;
- skill eval set format (defined in Phase 3a, extended here);
- rollout runner (execute skill on target tasks);
- scoring adapters: deterministic checks, LLM judges, and human review;
- bounded edit generation with edit budget (max changes per iteration);
- validation gate (score improvement + no regression on held-out tasks);
- rejected edit buffer (prevents repeated bad updates);
- promotion/rejection logs with score deltas;
- meta-skill memory for longitudinal learning across optimization runs.

Reference influence:

- SkillOpt for the five-phase loop (rollout, reflection, aggregation, edit generation, validation), edit budgets, rejected edit buffer, and meta-skill memory.
- Hermes Agent for confidence-based skill selection and continuous improvement.

Exit criteria:

- an optimization run produces candidate edits and promotes only validated improvements;
- every accepted skill version has a score delta, test result, and rollback path;
- failed edits are stored as learning data with rejection reasons;
- the edit budget prevents catastrophic drift between versions.

## Phase 5: Observation And Workflow Mining

Goal: learn from how people actually use agents. Deferred from earlier phases because it requires external connectors, privacy infrastructure, and integration with agent session formats.

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

## Phase 6: Team Registry And Governance

Goal: make skills maintainable in teams and workspaces. Deferred because it requires registry infrastructure, authentication, and multi-user coordination.

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
