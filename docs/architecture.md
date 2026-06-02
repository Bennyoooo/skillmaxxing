# Architecture

Skill Maxing is organized as a layered platform. Each layer can ship independently, but the full value comes from connecting them into a feedback loop.

## Layers

### 1. Agent Adapter Layer

Detects supported agents and knows where project/global skills live.

Initial targets:

- Codex: `~/.codex/skills`, project `.agents/skills`
- Claude Code: `~/.claude/skills`, project `.claude/skills`
- Cursor/OpenCode/Hermes-compatible paths as the adapter map grows

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
- support project, user, team, and public scopes.

### 3. Observation Layer

Collects opt-in traces that can become future skills.

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

### 4. Skill Creation Layer

Turns candidate workflows into durable skill artifacts.

Artifacts:

- `SKILL.md`;
- scripts for deterministic logic;
- resolver trigger entries;
- unit tests;
- integration tests;
- LLM eval cases;
- examples and fixtures.

The quality checklist follows the spirit of `skillify`: do not stop at a prompt file if the skill needs code, tests, triggers, and evaluation.

### 5. Optimization Layer

Improves skills using an evaluation-gated loop inspired by SkillOpt.

Loop:

1. Run target tasks with the current skill.
2. Score outputs with deterministic checks, human review, or LLM judges.
3. Reflect on failures and propose bounded edits.
4. Apply candidate edits.
5. Validate on held-out cases.
6. Promote only if the score improves and regression checks pass.

The deployed skill remains a compact artifact. The optimization machinery is not required at inference time.

### 6. Team Governance Layer

Makes skills maintainable across teams.

Responsibilities:

- ownership metadata;
- review and approval flows;
- release channels such as `dev`, `beta`, and `stable`;
- deprecation and migration notices;
- audit logs;
- policy for mutating skills and external connectors.

### 7. Automation Layer

Runs recurring skill maintenance.

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
- `Trace`: an observed workflow input.
- `Candidate`: a proposed skill derived from traces or chat.
- `Eval`: a task set and scoring contract.
- `OptimizationRun`: a sequence of candidate edits and validation outcomes.
- `TeamPolicy`: ownership, rollout, approval, and connector rules.

## Privacy And Safety Defaults

- Observation is opt-in.
- Raw traces stay local unless explicitly published.
- Secrets are redacted before indexing or model calls.
- Team registries can require review before a skill reaches stable.
- Mutating skills declare their tools and side effects in metadata.
