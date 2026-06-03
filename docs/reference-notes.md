# Reference Notes

## Aria Labs

Path: `/Users/bennyjiang/Desktop/projects/aria_agents`
Repo: (local only — no public URL)

Status: not inspected. macOS returned `Operation not permitted` when reading the directory.

Expected areas to study next:

- team/workspace skill sharing;
- skill maintenance workflows;
- chat-driven skill creation;
- scan-based skill creation;
- storage and permissions model.

## Hermes Agent

Repo: https://github.com/NousResearch/hermes-agent

### Architecture

Hermes is a TypeScript/Python autonomous agent with a self-improving learning loop. Skills are "procedural memory" — stored alongside declarative facts (MEMORY.md) and episodic session logs (FTS5 search). The agent runs on any provider via a transport abstraction layer (Anthropic, OpenAI, Bedrock, Gemini, Codex).

### How "create skills as you work" works (three layers)

**Layer A: System prompt nudge (always-on)**

Every system prompt includes `SKILLS_GUIDANCE`:

> "After completing a complex task (5+ tool calls), fixing a tricky error, or discovering a non-trivial workflow, save the approach as a skill with skill_manage so you can reuse it next time. When using a skill and finding it outdated, patch it immediately — don't wait to be asked."

This makes the agent continuously aware it should crystallize reusable knowledge.

**Layer B: Background self-improvement review (the core learning loop)**

After every N tool-call iterations (default 10, configurable via `skills.creation_nudge_interval`), a background daemon thread spawns a **forked copy of the agent** with:

- Full conversation history inherited from parent
- Tool whitelist limited to `memory` and `skills` tools only
- A review prompt that evaluates the conversation

The forked agent decides what to save based on these signals:
- User corrected style, tone, format, verbosity
- User corrected workflow, approach, or sequence
- Non-trivial technique, fix, workaround emerged
- A loaded skill was wrong, missing a step, or outdated

**Critical: the preference hierarchy prevents skill proliferation:**
1. UPDATE a currently-loaded skill (patch the one in play)
2. UPDATE an existing umbrella skill (find and patch the right class-level skill)
3. ADD a support file under an existing umbrella (references/, templates/, scripts/)
4. CREATE a new class-level umbrella only when nothing exists

**Layer C: Provenance tracking**

A `ContextVar` tracks whether a skill write comes from the background review vs. user-directed work. Only background-review-created skills are eligible for automatic curation. User-created skills are never auto-touched.

### Skill file format

```
~/.hermes/skills/
  my-skill/
    SKILL.md           # Main instructions (YAML frontmatter + markdown body)
    references/        # Session-specific detail, API docs, domain notes
    templates/         # Starter files to copy/modify
    scripts/           # Re-runnable automation scripts
    assets/            # Supplementary files
```

SKILL.md frontmatter:

```yaml
---
name: skill-name
description: Brief description
version: 1.0.0
platforms: [macos, linux]
metadata:
  hermes:
    tags: [tag1, tag2]
    related_skills: [other-skill]
    config:
      - key: wiki.path
        description: Path to wiki
        default: "~/wiki"
---
```

### Curator (periodic maintenance)

The Curator runs when idle (not cron-based):
- Triggers after `min_idle_hours` (default 2 hours) and `interval_hours` (default 7 days)
- Two phases: automatic state transitions (pure, no LLM) then LLM consolidation

Automatic transitions:
- `active → stale`: unused > 30 days
- `stale → archived`: unused > 90 days
- `stale → active`: skill used again (reactivation)

LLM consolidation pass:
- Identifies skill clusters sharing domain keywords
- Merges narrow siblings into class-level umbrella skills
- Demotes session-specific content to support subdirectories
- Archives absorbed skills (never deletes — always recoverable)
- Never touches pinned, bundled, or hub-installed skills

### Usage telemetry sidecar

`~/.hermes/skills/.usage.json` — per-skill tracking:
- `use_count`, `view_count`, `patch_count`
- timestamps for first/last use
- state (active/stale/archived)
- pinned flag

### Key patterns for Skill Maxing

1. **Iteration-gated background review.** Count tool iterations, not wall-clock time. Fire the review after N iterations of substantive work.
2. **Forked agent for self-review.** Spawn a restricted copy of the agent with limited tools. Run in a daemon thread after the user gets their response.
3. **Prefer-update-over-create hierarchy.** Prevents skill proliferation. Update > add support file > create new.
4. **Sidecar telemetry.** Usage tracking in a separate file, not in skill content. Enables lifecycle management.
5. **Provenance-based curation boundary.** Only agent-created skills are eligible for automatic curation. User-created skills are hands-off.
6. **Recoverable-only destructive actions.** Archive, never delete. Always recoverable.
7. **Three memory types.** Declarative (facts), procedural (skills), episodic (session logs). Procedures and workflows belong in skills, not memory.

## SkillOpt

Repo: https://github.com/microsoft/SkillOpt

### Architecture

SkillOpt is a research framework for optimizing LLM agent skills through an iterative, evaluation-gated loop. The core insight: treat the skill document (prompt/instructions) as trainable state while keeping the target LLM frozen. Published with arxiv.org/abs/2605.23904.

### Skill document format

The skill is a Markdown file — the literal system prompt given to the target agent. It IS the trainable artifact. No weight updates; the text is what gets optimized.

Key structural conventions:
- Free-form Markdown (headings, tables, bullets)
- A protected slow-update region: `<!-- SLOW_UPDATE_START -->` / `<!-- SLOW_UPDATE_END -->`
- Deployed artifact: `best_skill.md` (typically 300-2,000 tokens)
- Versioned as `skill_v{step:04d}.md` snapshots after every step

### The optimization loop (6 stages per step)

```
For each epoch (default 4):
  For each step:
    For each accumulation batch:
      1. ROLLOUT  — target model executes tasks with current_skill
      2. REFLECT  — optimizer model analyzes trajectories, produces patches
    3. AGGREGATE — hierarchical merge of all patches from accumulation
    4. SELECT    — rank edits, apply edit budget (learning rate)
    5. UPDATE    — apply patch to skill document
    6. EVALUATE  — run on held-out selection set, accept/reject via gate

  End-of-epoch:
    SLOW UPDATE  — longitudinal comparison across epochs
    META SKILL   — optimizer-side memory update
```

### Edit operations (structured diffs)

```python
EditOp = Literal["append", "insert_after", "replace", "delete"]

@dataclass
class Edit:
    op: EditOp
    content: str = ""           # new text
    target: str = ""            # existing text to locate
    support_count: int | None   # how many trajectories support this edit
    source_type: Literal["failure", "success"] | None
```

### Edit budget (the "learning rate")

Maximum edits per iteration. Schedulers: constant, linear decay, cosine annealing, autonomous (LLM decides).

Default: `learning_rate: 4`, `min_learning_rate: 2`, `lr_scheduler: cosine`.

When edits exceed budget, the optimizer LLM ranks by: systematic impact, complementarity, generality, actionability. Top-L selected.

### Validation gate

```python
def evaluate_gate(...) -> GateResult:
    if cand_score > current_score:
        if cand_score > best_score:
            return GateResult(action="accept_new_best")
        return GateResult(action="accept")
    return GateResult(action="reject")
```

- Candidate run on held-out selection set
- Acceptance requires strictly greater score
- Tracks both `current_skill` and `best_skill`
- Content-addressable cache: `skill_hash → (hard, soft)` avoids re-evaluating identical candidates

### Rejected edit buffer

Within an epoch, each step's failure patterns and rejected edits accumulate and are passed to subsequent optimizer calls. The buffer captures:
- Step number, action (accept/reject), failure count
- Failure patterns extracted from analyst patches
- Score before/after
- Rejected edits with operations

Buffer resets at each epoch boundary.

### Slow updates and meta-skill memory

**Slow update** (end of each epoch, starting epoch 2):
1. Run same N tasks with both previous-epoch and current-epoch skill
2. Categorize: improved, regressed, persistent_fail, stable_success
3. Optimizer produces guidance injected into the protected `SLOW_UPDATE` region
4. Step-level edits cannot modify this region

**Meta-skill memory** (separate optimizer-side memory):
- Captures: which kinds of edits tend to help, which are too vague/brittle/harmful
- Loaded at start of each epoch, passed to ALL optimizer calls
- Guides how future edits are proposed (not what the target agent sees)

### Two-model architecture

- **Target model**: frozen, executes tasks with skill as system prompt
- **Optimizer model**: proposes edits, merges patches, ranks edits, writes slow updates and meta-skill
- Never called during the same stage; fully separated

### Scoring (deterministic only)

No LLM judges in the core evaluation loop. Scoring is deterministic:
- Exact-match answer comparison (with normalization)
- Code execution + output comparison
- Environment success signal (task completed or not)
- Mathematical answer equivalence

LLM is used for reflection (analyzing WHY things failed), not for scoring WHETHER they failed.

### Key patterns for Skill Maxing

1. **Edit budget prevents drift.** Small, bounded changes are more reliable than rewrites. Cosine annealing schedule works well.
2. **Rejected edit buffer prevents oscillation.** Most optimization systems don't have this. It's what prevents circular edits.
3. **Protected slow-update regions.** Step-level edits can't modify epoch-level guidance. Creates a hierarchy of stability.
4. **Content-addressable caching.** Hash the skill text, cache scores. Identical candidates aren't re-evaluated.
5. **Failure-driven edits take priority.** In hierarchical merge, failure patches always win over success patches.
6. **Two-model separation.** The optimizer never interferes with the target's behavior directly.

## Vercel Labs `skills`

Repo: https://github.com/vercel-labs/skills

### Architecture

A TypeScript CLI (`npx skills`) for installing and managing AI agent skills across 55+ agents. Published as npm package `skills` (v1.5.9). It's a package manager for skills, not a creation tool.

### Agent detection (55+ agents)

Each agent defined as:

```typescript
interface AgentConfig {
  name: string;
  displayName: string;
  skillsDir: string;           // project-level path (e.g., '.claude/skills')
  globalSkillsDir: string | undefined;  // absolute path
  detectInstalled: () => Promise<boolean>;  // checks config dir exists
}
```

Two categories:
- **Universal agents**: use `.agents/skills` (Cursor, Codex, Gemini CLI, Cline, OpenCode, Copilot, Zed, Warp, etc.)
- **Non-universal agents**: own paths (Claude at `.claude/skills`, Windsurf at `.windsurf/skills`, etc.)

Detection: `existsSync()` on config directories, all agents checked in parallel.

Runtime detection: `@vercel/detect-agent` detects if running inside an AI agent session (skips interactive prompts).

### Skill source resolution

`parseSource(input)` handles:
- GitHub shorthand: `owner/repo`, `owner/repo/path`
- GitHub shorthand with skill filter: `owner/repo@skill-name`
- GitHub URL with tree path: `https://github.com/o/r/tree/branch/path`
- GitLab (with nested subgroup support)
- Git SSH: `git@github.com:owner/repo.git`
- Local paths: `./path`, `/absolute`
- Fragment syntax: `source#ref@skillFilter`
- Source aliases: `coinbase/agentWallet` → `coinbase/agentic-wallet-skills`

### Install flow (canonical + symlink)

1. Copy skill files to canonical location: `.agents/skills/<name>` (project) or `~/.agents/skills/<name>` (global)
2. Create relative symlinks from each agent's directory to canonical
3. Falls back to copy on symlink failure (Windows without dev mode → junction)
4. Universal agents with global install: already in canonical location, no symlink needed
5. Non-universal agents at project level: skip if agent's config dir doesn't exist in project

Three variants: disk-based (cloned repos), remote (single SKILL.md), well-known (multi-file from registry).

Blob-based fast install: GitHub Trees API → raw.githubusercontent.com → skills.sh CDN, avoids full git clone.

### Two lock files

**Global lock** (`~/.agents/.skill-lock.json`):

```json
{
  "version": 3,
  "skills": {
    "debugging": {
      "source": "vercel-labs/agent-skills",
      "sourceType": "github",
      "sourceUrl": "...",
      "skillFolderHash": "<GitHub tree SHA>",
      "installedAt": "2025-01-15T10:30:00Z",
      "updatedAt": "..."
    }
  },
  "lastSelectedAgents": ["claude", "codex"]
}
```

**Project lock** (`skills-lock.json`, committed to VCS):

```json
{
  "version": 1,
  "skills": {
    "debugging": {
      "source": "owner/repo",
      "sourceType": "github",
      "computedHash": "<SHA-256 of all files>"
    }
  }
}
```

Project lock: no timestamps (reduces merge conflicts), skills sorted alphabetically, hash is SHA-256 over all files sorted by relative path.

### CLI commands

```
skills add <package>     # Install from source (aliases: a, i, install)
skills remove [skills]   # Remove (aliases: rm, r)
skills list              # List installed (alias: ls)
skills find [query]      # Interactive search (aliases: search, f, s)
skills update [skills]   # Update to latest (aliases: upgrade, check)
skills init [name]       # Create SKILL.md template
```

Flags: `-g` (global), `-a <agents>` (target agents), `-s <skills>` (filter), `-y` (skip prompts), `--copy`, `--all`, `--json`.

### Security layers

1. **Name sanitization**: lowercase + alphanumeric/dots/underscores only, no leading dots/hyphens, max 255 chars
2. **Path containment**: `resolve(target).startsWith(resolve(base) + sep)` before every install/remove
3. **Subpath traversal**: rejects any `..` segments
4. **Terminal escape injection**: strips CSI, OSC, C1 sequences from untrusted frontmatter strings
5. **Archive limits**: 50MB max unpacked, 1000 max files, no symlinks/hardlinks, digest verified
6. **Custom frontmatter parser**: does NOT use `gray-matter` (which enables eval()-based RCE via `---js` blocks)
7. **Git safety**: LFS disabled, terminal prompts disabled, temp dir validated before deletion

### Key patterns for Skill Maxing

1. **Canonical + symlink pattern.** Single source of truth, symlinked per agent. Prevents duplication, makes updates atomic.
2. **Two lock files with different purposes.** Global (user-level, timestamps, GitHub SHAs for update detection) vs. project (committed to VCS, minimal, no timestamps for clean merges).
3. **Graceful degradation.** Symlink → copy fallback. Blob → clone fallback. Unauth → auth API fallback.
4. **Universal vs agent-specific categorization.** Reduces symlink complexity — universal agents are already in canonical location.
5. **Security in depth.** Name sanitization + path containment + subpath validation + terminal escape stripping + archive limits + digest verification + custom YAML parser.
6. **npx zero-install distribution.** Dependencies bundled by build tool, only `yaml` at runtime.

## gbrain `skillify` (gstack)

Repo: https://github.com/garrytan/gstack (private)
Local path: `/Users/bennyjiang/Desktop/projects/skillmaxxing/gstack`

### Architecture

gstack is a skill ecosystem for Claude Code with 40+ skills, a headless browser, and a cross-agent generation pipeline. The relevant components for Skill Maxing:

### Cross-agent adapter system (`hosts/`)

A `HostConfig` TypeScript interface defines everything needed to install and generate skills for a specific agent:
- Path resolution (global/local install dirs)
- Frontmatter transformation (allowlist/denylist fields per host)
- Content rewrites (path and tool name substitutions)
- Generation config (which skills to skip, metadata format)
- Install strategy (symlink vs copy, prefix naming)

10 hosts implemented: Claude, Codex, Factory, Kiro, OpenCode, Slate, Cursor, OpenClaw, Hermes, gbrain.

### Skillify pipeline (11-step atomic write)

1. Provenance guard — verify a source workflow exists
2. Name + trigger proposal — extract from the workflow
3. Script synthesis — write deterministic code from working commands
4. Fixture capture — snapshot current state for replay tests
5. Test generation — at minimum, shape + non-empty assertions
6. SDK resolution — bundle dependencies for self-containment
7. Atomic staging — write to temp dir via `stageSkill()`
8. Test execution — run against staged dir
9. Approval gate — user confirms before committing
10. Atomic commit — `commitSkill()` moves to final tier path
11. Post-commit verification — run the committed skill, confirm output matches

### Quality checklist

- SKILL.md with proper frontmatter
- Deterministic scripts (not just a prompt file)
- Unit tests with shape assertions
- Fixture files for replay
- Resolver trigger entries
- Smoke test execution
- Review receipts for auditability

### Learn system (JSONL operational learning)

- Append-only JSONL file per project
- Fields: skill, type, key, insight, confidence, source, files
- Search, prune (stale file detection), export, stats commands
- Latest-wins dedup by key
- Learnings loaded at session start, injected into agent context

### Key patterns for Skill Maxing

- **The HostConfig interface is directly portable** — 10 agent definitions ready to use.
- **The atomic stage-test-approve-commit pipeline is the gold standard** for skill creation quality.
- **JSONL operational learning** is a lightweight observation layer that can ship early.
- Generated skills should be reviewable artifacts with tests and provenance.
- Team promotion should require receipts, not just author confidence.
