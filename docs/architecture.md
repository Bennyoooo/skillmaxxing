# Architecture

Skill Maxing is organized as a layered platform. Each layer can ship independently, but the full value comes from connecting them into a feedback loop.

## Layers

### 1. Agent Adapter Layer

Detects supported agents and knows where project/global skills live.

Initial targets:

- Codex: `~/.codex/skills`, project `.agents/skills`
- Claude Code: `~/.claude/skills`, project `.claude/skills`
- Cursor/OpenCode/Hermes-compatible paths as the adapter map grows

Each agent is defined as a declarative `HostConfig`-style object:

```typescript
interface AgentAdapter {
  name: string;
  displayName: string;
  cliCommand: string;                // for detection via `which`
  globalSkillRoot: string;           // e.g., '~/.claude/skills'
  projectSkillRoot: string;          // e.g., '.claude/skills'
  frontmatter: FrontmatterConfig;    // per-agent field rules
  installStrategy: 'symlink' | 'copy';
}
```

Responsibilities:

- detect installed agents;
- resolve skill install paths;
- install by symlink or copy;
- list, update, and remove installed skills;
- preserve lock files for reproducible installs.

### 2. Skill Registry Layer

Indexes skills from GitHub, local folders, private team repos, and curated packs.

Responsibilities:

- parse `SKILL.md` frontmatter;
- validate names, descriptions, triggers, tools, and mutating behavior;
- expose searchable metadata;
- support project, user, team, and public scopes;
- semantic discovery: match user intent to available skills.

### 3. Skill Creation Layer

Turns candidate workflows into durable skill artifacts. Two modes:

**Explicit creation (skillify):** a user describes a workflow or says "turn this into a skill." The pipeline synthesizes a complete skill directory.

**In-session capture (create as you work):** after completing any task, the agent reflects on whether the workflow is reusable. If it identifies a repeated or generalizable pattern, it proposes crystallizing it as a skill. This is the Hermes-inspired post-task reflection loop — always-on, not a separate command.

Artifacts:

- `SKILL.md`;
- scripts for deterministic logic;
- resolver trigger entries;
- unit tests;
- eval scaffold (task set + scoring contract);
- examples and fixtures.

The quality checklist follows the spirit of gstack `skillify`: do not stop at a prompt file if the skill needs code, tests, triggers, and evaluation. Every created skill goes through the atomic stage-test-approve-commit pipeline.

### 4. Observation Layer

Collects opt-in traces that can become future skills. Deferred to Phase 5 because it requires external connectors and privacy infrastructure.

Inputs:

- agent session transcripts;
- shell/tool calls;
- repo diffs;
- docs, tasks, chats, calendars, and wikis through approved connectors;
- explicit user prompts such as "make this workflow reusable."

Responsibilities:

- redact secrets and sensitive payloads;
- summarize repeated workflows;
- cluster similar tasks;
- produce candidate skill briefs with provenance.

### 5. Optimization Layer

Improves skills using an evaluation-gated loop inspired by SkillOpt.

Loop:

1. **Rollout:** run target tasks with the current skill.
2. **Reflect:** optimizer model analyzes failures and successes.
3. **Aggregate:** group similar failure patterns, prioritize highest-leverage edits.
4. **Select:** rank edits, apply edit budget (bounded changes per iteration).
5. **Update:** apply candidate edits to skill document.
6. **Validate:** run on held-out tasks. Accept only if score improves and no regression.

Key mechanisms from SkillOpt:

- **Edit budget** constrains how much changes per iteration (prevents catastrophic drift).
- **Rejected edit buffer** stores failed edits with reasons (prevents repeated bad updates).
- **Slow updates** capture longitudinal learning in a protected region of the skill.
- **Meta-skill memory** guides the optimizer itself across optimization runs.
- **Two-model architecture:** optimizer model proposes edits; target model stays frozen.

The deployed skill remains a compact artifact. The optimization machinery is not required at inference time.

### 6. Confidence And Learning Layer

Tracks skill performance over time. Inspired by Hermes Agent's confidence tracking.

Responsibilities:

- count usage per skill (how many times invoked);
- track success/failure rate;
- surface high-confidence skills preferentially;
- prune or flag low-confidence skills;
- JSONL-based operational learning log per project.

### 7. Team Governance Layer

Makes skills maintainable across teams. Deferred to Phase 6.

Responsibilities:

- ownership metadata;
- review and approval flows;
- release channels such as `dev`, `beta`, and `stable`;
- deprecation and migration notices;
- audit logs;
- policy for mutating skills and external connectors.

### 8. Automation Layer

Runs recurring skill maintenance. Deferred to Phase 7.

Examples:

- nightly skill health checks;
- weekly skill update proposals;
- docs drift detection;
- repo-specific skill suggestions;
- team registry sync jobs.

Hermes-style cron/webhook/API triggers are a strong reference for this layer.

## Data Model

Core entities:

- `Skill`: a versioned capability artifact.
- `Pack`: a group of skills distributed together.
- `Install`: a skill linked into an agent and scope.
- `Trace`: an observed workflow input (Phase 5+).
- `Candidate`: a proposed skill derived from traces or chat.
- `Eval`: a task set and scoring contract.
- `OptimizationRun`: a sequence of candidate edits and validation outcomes.
- `TeamPolicy`: ownership, rollout, approval, and connector rules (Phase 6+).
- `UsageRecord`: per-skill invocation count and success rate.

## The Core Loop

```
  Task completed
       │
       ▼
  ┌─────────────┐
  │   Reflect    │  Was this workflow reusable?
  └──────┬──────┘
         │ yes
         ▼
  ┌─────────────┐
  │  Skillify    │  Create skill with tests, triggers, eval scaffold
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │   Install    │  Symlink/copy into target agent(s)
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │    Use       │  Agent finds and executes skill on future tasks
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Optimize    │  Evaluate → reflect → edit → validate → promote
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Confidence  │  Track usage, success rate, prune stale skills
  └─────────────┘
```

## Privacy And Safety Defaults

- Observation is opt-in.
- Raw traces stay local unless explicitly published.
- Secrets are redacted before indexing or model calls.
- Team registries can require review before a skill reaches stable.
- Mutating skills declare their tools and side effects in metadata.
- Skills created by agents are marked `trusted: false` by default.
