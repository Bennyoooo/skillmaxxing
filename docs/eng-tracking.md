# Engineering Tracking — Phase 1: Cross-Agent Skill Installer

## Status: Complete (v0.1.0)

## Implementation Order

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 1 | Project setup (deps, tsconfig, structure) | done | yaml dep added, src/ structure created |
| 2 | Core types (`AgentAdapter`, `Skill`, `LockFile`) | done | src/types.ts |
| 3 | Agent adapters (Claude, Codex, Cursor, OpenCode, Hermes) | done | 5 agents + registry with detection |
| 4 | Utilities (name sanitize, path safety, frontmatter parser) | done | 5 util modules |
| 5 | Source parser (GitHub shorthand, URL, local path) | done | GitHub, git SSH, local path support |
| 6 | Lock file system (read, write, update, project + global) | done | Global + project with atomic writes |
| 7 | Install command (symlink/copy, project/global scope) | done | Multi-skill, multi-agent, lock integration |
| 8 | List command | done | Table output with --json flag |
| 9 | Remove command | done | Multi-skill removal, lock cleanup |
| 10 | Update command | done | Re-installs from lock file sources |
| 11 | Init command | done | Template SKILL.md generation |
| 12 | Doctor command | done | Agent detection, CLI check, symlink health |
| 13 | CLI wiring (arg parsing, help, error handling) | done | Manual parser with short flags |

## Test Results

| Test | Result |
|------|--------|
| `skill-maxing --help` | Prints full help with examples |
| `skill-maxing init test-skill` | Creates SKILL.md template |
| `skill-maxing install ./local-skill -a claude` | Installs via symlink, writes project lock |
| `skill-maxing install ./multi-skills -a claude -g` | Discovers and installs 2 skills, writes global lock |
| `skill-maxing list` | Lists 113 installed skills across Claude + Codex |
| `skill-maxing list -a claude` | Filters to Claude only |
| `skill-maxing list --json` | JSON output |
| `skill-maxing remove test-skill` | Removes skill + lock entry |
| `skill-maxing remove debugging testing -g` | Bulk removal |
| `skill-maxing doctor` | Detects 4 agents, reports CLI + config status |
| Type check (`tsc --noEmit`) | Clean — zero errors |

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI framework | Manual arg parsing | Zero deps, same approach as Vercel skills |
| YAML parser | `yaml` npm package | Avoids gray-matter RCE via `---js` blocks (Vercel finding) |
| Git operations | `child_process.execFile` | Avoid `simple-git` dep, we only need clone/fetch |
| Install default | Symlink with copy fallback | Same as Vercel; Windows junction fallback |
| Lock file split | Global + project | Global has timestamps/SHAs; project is VCS-friendly (no timestamps) |
| Frontmatter parser | Custom (yaml only) | Security: no eval, no js blocks |
| Agent detection | existsSync on config dir | Same as Vercel; avoids expensive CLI version checks |

## File Structure (final)

```
src/
  cli.ts                 # Entry point (190 lines)
  types.ts               # Core types (72 lines)
  agents/
    types.ts             # Re-export
    claude.ts            # ~/.claude/skills
    codex.ts             # ~/.codex/skills + .agents/skills
    cursor.ts            # ~/.cursor/skills
    opencode.ts          # ~/.config/opencode/skills
    hermes.ts            # ~/.hermes/skills
    registry.ts          # ALL_AGENTS, detect, lookup
  commands/
    init.ts              # Template generation
    install.ts           # Source → resolve → symlink/copy → lock
    list.ts              # Scan all agents, table/json output
    remove.ts            # Delete + lock cleanup
    update.ts            # Re-install from lock entries
    doctor.ts            # Agent CLI check, symlink health
  source/
    parser.ts            # GitHub shorthand, URL, SSH, local
    resolver.ts          # Clone, scan for SKILL.md, temp cleanup
  lock/
    global.ts            # ~/.skillmax/skill-lock.json
    project.ts           # skills-lock.json (VCS-friendly)
  util/
    sanitize.ts          # Name/path validation, terminal escape strip
    fs.ts                # Symlink/copy, ensureDir, removeDir
    frontmatter.ts       # YAML-only SKILL.md parser
    git.ts               # Clone, SHA, temp dirs
    log.ts               # Colored console output
```

Total: ~750 lines of TypeScript across 20 files. One runtime dependency (yaml).

## Known Limitations

- GitHub subpath install requires full clone (no blob-based fast path yet)
- No interactive agent selection (always auto-detects or requires --agent flag)
- No `--pack` support yet (Phase 2)
- No `discover` / `search` command yet (Phase 2)

## Session Log

- 2026-06-02: Phase 1 implementation started and completed
  - All 6 commands working: init, install, list, remove, update, doctor
  - 5 agent adapters: Claude, Codex, Cursor, OpenCode, Hermes
  - Lock file system: global + project with atomic writes
  - Source parser: GitHub shorthand, URL, SSH, local paths
  - Type-safe throughout, zero TSC errors
