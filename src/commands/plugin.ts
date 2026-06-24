import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { ensureDir } from '../util/fs.js';
import { SKILLS_GUIDANCE, REFLECT_NUDGE } from '../plugin/guidance.js';
import { recordToolUse, shouldReflect, markReflected } from '../plugin/sessions.js';
import { runReflectionDetached, isReflecting, type ReflectAgent } from '../plugin/reflect.js';
import * as log from '../util/log.js';

export type ReflectMode = 'auto' | 'nudge';

export interface PluginArgs {
  action: 'install' | 'uninstall' | 'status' | 'guidance' | 'on-tool' | 'on-stop';
  agent?: ReflectAgent;
  mode?: ReflectMode;
  threshold?: number;
  project?: boolean;
}

const DEFAULT_THRESHOLD = 10;
const HOOK_TAG = 'skill-maxing plugin'; // identifies hooks we own, for clean uninstall

// ---------- shared helpers ----------

function resolveCli(): string {
  for (const bin of ['skill-maxing', 'skillmax']) {
    try {
      execSync(`command -v ${bin}`, { stdio: 'ignore' });
      return bin;
    } catch {
      /* not on PATH */
    }
  }
  return 'npx -y skill-maxing';
}

function readStdin(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(0, 'utf-8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function claudeSettingsPath(project: boolean): string {
  return project
    ? path.join(process.cwd(), '.claude', 'settings.json')
    : path.join(os.homedir(), '.claude', 'settings.json');
}

function readJson(file: string): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

function writeJson(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

interface HookEntry {
  matcher?: string;
  hooks: { type: 'command'; command: string }[];
}

/** Drop any hook groups in `list` that belong to skill-maxing. */
function stripOurs(list: HookEntry[] | undefined): HookEntry[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (g) => !(g.hooks ?? []).some((h) => typeof h.command === 'string' && h.command.includes(HOOK_TAG)),
  );
}

// ---------- install / uninstall / status ----------

function install(args: PluginArgs): void {
  const agent: ReflectAgent = args.agent ?? 'claude';
  const mode: ReflectMode = args.mode ?? 'auto';
  const threshold = args.threshold ?? DEFAULT_THRESHOLD;
  const cli = resolveCli();

  if (agent === 'codex') {
    installCodex();
    return;
  }

  const file = claudeSettingsPath(args.project ?? false);
  const settings = readJson(file);
  settings.hooks = settings.hooks ?? {};

  // SessionStart: standing guidance (Layer A) — always wired.
  settings.hooks.SessionStart = [
    ...stripOurs(settings.hooks.SessionStart),
    { hooks: [{ type: 'command', command: `${cli} plugin guidance` }] },
  ];

  // PostToolUse + Stop: the background reflection loop (Layer B) — auto mode only.
  if (mode === 'auto') {
    settings.hooks.PostToolUse = [
      ...stripOurs(settings.hooks.PostToolUse),
      { matcher: '*', hooks: [{ type: 'command', command: `${cli} plugin on-tool` }] },
    ];
    settings.hooks.Stop = [
      ...stripOurs(settings.hooks.Stop),
      {
        hooks: [
          {
            type: 'command',
            command: `${cli} plugin on-stop --agent ${agent} --mode ${mode} --threshold ${threshold}`,
          },
        ],
      },
    ];
  } else {
    // nudge mode: remove any auto hooks we previously installed
    settings.hooks.PostToolUse = stripOurs(settings.hooks.PostToolUse);
    settings.hooks.Stop = stripOurs(settings.hooks.Stop);
  }

  writeJson(file, settings);

  log.success(`Skill Maxing installed for Claude Code (${mode} mode).`);
  log.info(`  hooks written to ${file}`);
  log.info(`  SessionStart: standing skill-creation guidance`);
  if (mode === 'auto') {
    log.info(`  Stop: background reflection after ${threshold}+ tool calls (claude -p, trusted:false drafts)`);
  }
  log.info('No explicit trigger needed — restart your agent session to activate.');
  log.info('Uninstall any time with: skill-maxing plugin uninstall');
}

const CODEX_MARK_START = '<!-- skill-maxing:start -->';
const CODEX_MARK_END = '<!-- skill-maxing:end -->';

function installCodex(): void {
  // Codex lacks programmatic Stop/PostToolUse hooks, so we deliver the standing
  // guidance via AGENTS.md (Layer A). The agent then self-evolves per instruction.
  const file = path.join(process.cwd(), 'AGENTS.md');
  let body = '';
  try {
    body = fs.readFileSync(file, 'utf-8');
  } catch {
    /* new file */
  }
  const block = `${CODEX_MARK_START}\n## Skill Maxing\n\n${SKILLS_GUIDANCE}\n${CODEX_MARK_END}`;
  const re = new RegExp(`${CODEX_MARK_START}[\\s\\S]*?${CODEX_MARK_END}`);
  body = re.test(body) ? body.replace(re, block) : `${body.trimEnd()}\n\n${block}\n`;
  fs.writeFileSync(file, body.replace(/^\n+/, ''));
  log.success('Skill Maxing installed for Codex (guidance written to AGENTS.md).');
  log.info('Codex has no Stop hook; self-evolution runs in-session via standing guidance.');
}

function uninstall(args: PluginArgs): void {
  const agent: ReflectAgent = args.agent ?? 'claude';
  if (agent === 'codex') {
    const file = path.join(process.cwd(), 'AGENTS.md');
    try {
      const body = fs.readFileSync(file, 'utf-8');
      const re = new RegExp(`\\n*${CODEX_MARK_START}[\\s\\S]*?${CODEX_MARK_END}\\n*`);
      fs.writeFileSync(file, body.replace(re, '\n'));
      log.success('Removed Skill Maxing guidance from AGENTS.md.');
    } catch {
      log.info('Nothing to uninstall.');
    }
    return;
  }
  const file = claudeSettingsPath(args.project ?? false);
  const settings = readJson(file);
  if (settings.hooks) {
    settings.hooks.SessionStart = stripOurs(settings.hooks.SessionStart);
    settings.hooks.PostToolUse = stripOurs(settings.hooks.PostToolUse);
    settings.hooks.Stop = stripOurs(settings.hooks.Stop);
    for (const k of ['SessionStart', 'PostToolUse', 'Stop']) {
      if (Array.isArray(settings.hooks[k]) && settings.hooks[k].length === 0) delete settings.hooks[k];
    }
  }
  writeJson(file, settings);
  log.success(`Removed Skill Maxing hooks from ${file}.`);
}

function status(args: PluginArgs): void {
  const file = claudeSettingsPath(args.project ?? false);
  const settings = readJson(file);
  const owned: string[] = [];
  for (const k of ['SessionStart', 'PostToolUse', 'Stop']) {
    const groups: HookEntry[] = settings.hooks?.[k] ?? [];
    if (groups.some((g) => (g.hooks ?? []).some((h) => h.command?.includes(HOOK_TAG)))) owned.push(k);
  }
  if (owned.length > 0) {
    log.success(`Skill Maxing is active for Claude Code: ${owned.join(', ')} hooks (${file}).`);
  } else {
    log.info('Skill Maxing is not installed for Claude Code. Run: skill-maxing plugin install');
  }
}

// ---------- hook entrypoints ----------

function guidance(): void {
  // SessionStart additionalContext — injects the standing nudge into the agent.
  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: SKILLS_GUIDANCE },
    }),
  );
}

function onTool(): void {
  if (isReflecting()) return; // don't count the reflector's own work
  const input = readStdin();
  const id = typeof input.session_id === 'string' ? input.session_id : 'default';
  recordToolUse(id);
}

function onStop(args: PluginArgs): void {
  if (isReflecting()) return; // recursion guard: the reflector must never re-trigger
  const input = readStdin();
  const id = typeof input.session_id === 'string' ? input.session_id : 'default';
  const transcriptPath = typeof input.transcript_path === 'string' ? input.transcript_path : '';
  const mode: ReflectMode = args.mode ?? 'auto';
  const threshold = args.threshold ?? DEFAULT_THRESHOLD;

  if (!shouldReflect(id, threshold)) return; // not enough substantive work yet

  if (mode === 'nudge') {
    // Surface a one-line reminder to the user; the agent acts on standing guidance.
    console.log(JSON.stringify({ systemMessage: `Skill Maxing: ${REFLECT_NUDGE}` }));
    markReflected(id, new Date().toISOString());
    return;
  }

  // auto mode: fire the background reflector and reset the counter.
  markReflected(id, new Date().toISOString());
  if (transcriptPath) {
    runReflectionDetached({ agent: args.agent ?? 'claude', transcriptPath, cwd: process.cwd() });
  }
}

export async function plugin(args: PluginArgs): Promise<void> {
  switch (args.action) {
    case 'install':
      return install(args);
    case 'uninstall':
      return uninstall(args);
    case 'status':
      return status(args);
    case 'guidance':
      return guidance();
    case 'on-tool':
      return onTool();
    case 'on-stop':
      return onStop(args);
    default:
      log.error(`Unknown plugin action: ${args.action}`);
      process.exitCode = 1;
  }
}
