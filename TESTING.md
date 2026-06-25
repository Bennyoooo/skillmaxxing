# Testing the Skill Maxing plugin (local)

> **Skill Maxing is not on npm yet**, so `npx skillmaxxing ...` returns `E404`.
> For now you test from the **local build** and put the CLI on your PATH with
> `npm link`. Once linked, `plugin install` bakes the linked `skillmaxxing` binary
> into the hooks (not `npx`), so everything works offline.

This walks through verifying that your coding agent **self-evolves** — auto-creates
and auto-improves skills with no command from you — and shows exactly where the
created skills live.

---

## 0. One-time setup (build + link + install)

```bash
cd ~/Desktop/projects/skillmaxxing/skill-maxing
npm install && npm run build
npm link                       # puts `skillmaxxing` + `skillmax` on PATH
skillmaxxing --version         # sanity: prints 0.1.0

# install the plugin globally, with a LOW threshold so it fires on a short test
skillmaxxing plugin install --threshold 4
skillmaxxing plugin status     # -> active for Claude Code: SessionStart, PostToolUse, Stop
```

Confirm the hooks landed (and that they call `skillmaxxing`, not `npx`):

```bash
grep -A2 "skillmaxxing plugin" ~/.claude/settings.json
```

---

## 1. Verify the plumbing fires (~30s)

```bash
mkdir -p ~/skillmax-test && cd ~/skillmax-test && git init -q
claude            # start a FRESH Claude Code session here (so SessionStart runs)
```

**SessionStart guidance (Layer A)** — paste into Claude:

> What does your Skill Maxing guidance tell you to do? Quote it.

If it recites the "crystallize reusable work / improve stale skills" text, the
SessionStart hook injected context correctly.

**Tool counter (PostToolUse)** — after the agent makes a few tool calls, in another
terminal:

```bash
cat ~/.skillmax/sessions/*.json    # -> {"tools": N, ...}  N climbs as the agent works
```

---

## 2. Test auto-CREATION (the main event)

In the Claude session, paste a clearly **reusable, multi-step** task — this is what
the background reflector will want to crystallize:

> Write a bash script `scripts/changelog.sh` that takes two git refs and prints the
> commits between them grouped by conventional-commit type (feat, fix, chore,
> other). Create 4 sample commits, run the script on them, and show me the output.

That is ~8–12 tool calls (write, chmod, commits, run, read) — well past the
threshold. Let the agent finish, then **end your turn / exit** so the **Stop** hook
fires.

Now wait **~30–90 seconds** (the reflector is a separate `claude -p` running in the
background), then inspect:

```bash
skillmaxxing list                                # the created skill should appear
ls ~/skillmax-test/.claude/skills/               # project-scoped skill dir(s)
cat ~/skillmax-test/.claude/skills/*/SKILL.md    # read what it captured
cat ~/.skillmax/state/*.json                     # -> origin:"created", trusted:false
ls ~/.skillmax/drafts/                           # any staged-but-not-committed draft
```

**What success looks like:** a new skill (e.g. `changelog` / `release-notes`) with a
`SKILL.md` (frontmatter + body, maybe a script), recorded `trusted: false`. The
agent taught itself a reusable capability with zero command from you.

Watch the reflector while it runs (optional):

```bash
ps aux | grep "[c]laude -p"
```

---

## 3. Test auto-IMPROVEMENT (optional)

New session, ask the agent to **use** the skill and hit a gap:

> Use the changelog skill on `HEAD~4..HEAD`, but it should also include the commit
> author. Fix the skill if it doesn't.

End the turn; the reflector (or the agent in-session) runs `skillmaxxing optimize`
and bumps the version. Verify:

```bash
cat ~/.skillmax/state/*.json   # version increments; scoreHistory grows
```

---

## 4. Codex variant

```bash
cd ~/skillmax-test
skillmaxxing plugin install --agent codex   # writes guidance into AGENTS.md (no Stop hook)
codex
```

Codex has no background hook, so self-evolution happens **in-session**: per the
`AGENTS.md` guidance, the agent itself runs `skillmaxxing skillify` during a
reusable task. Run the same task as step 2, then `skillmaxxing list`. You'll watch
it create the skill live — the most visible path.

---

## Inspect cheatsheet — where everything lives

| Thing | Location |
|-------|----------|
| Installed/created skills (project) | `<project>/.claude/skills/<name>/SKILL.md` |
| Installed/created skills (global) | `~/.claude/skills/<name>/SKILL.md` |
| Per-skill state (trust, version, scores) | `~/.skillmax/state/<key>.json` |
| Session tool counters | `~/.skillmax/sessions/<id>.json` |
| Staged (not yet committed) drafts | `~/.skillmax/drafts/<name>/` |
| Retained prior versions (for revert) | `~/.skillmax/versions/<name>/` |
| Hooks config | `~/.claude/settings.json` |

List everything skillmaxxing knows about:

```bash
skillmaxxing list          # installed skills across agents
skillmaxxing doctor        # integration + lock health
```

---

## Reset / uninstall

```bash
rm -f ~/.skillmax/sessions/*                 # reset tool counters
skillmaxxing remove <skill-name>             # remove a created skill
rm -rf ~/skillmax-test/.claude/skills/* ~/.skillmax/state/*   # nuke test skills + state
skillmaxxing plugin uninstall                # remove the hooks when done
npm unlink -g skillmaxxing                   # remove the linked CLI
```

---

## Troubleshooting

- **`npm error 404 ... skillmaxxing`** — expected; the package isn't published.
  Use the `npm link` setup above; do not run `npx skillmaxxing`.
- **No skill appeared after step 2** — the reflector is async and *conservative*:
  - Give it ~2 minutes; check `ps aux | grep "[c]laude -p"` (still running?).
  - Make sure `claude` is authenticated (the reflector is a headless `claude -p`).
  - The task must look genuinely reusable — trivial/one-off work intentionally
    produces no skill.
- **Want it in-session and fully visible (no waiting)** — install nudge mode:
  ```bash
  skillmaxxing plugin install --mode nudge --threshold 4
  ```
  The agent then creates/improves skills during the session instead of in the
  background.
- **Hooks call `npx` instead of `skillmaxxing`** — you installed before `npm link`.
  Re-run `skillmaxxing plugin install --threshold 4` after linking.
