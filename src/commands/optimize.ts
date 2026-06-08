import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ensureDir, removeDir, copyDir, fileExists } from '../util/fs.js';
import { applyEdits, type Edit } from '../optimize/diff.js';
import { editBudget, type Scheduler } from '../optimize/budget.js';
import { selectEdits, gate, noHeldOutRegression } from '../optimize/loop.js';
import { loadEvalManifest } from '../eval/schema.js';
import { scoreRollouts, type RolloutOutput } from '../eval/runner.js';
import { promote, revert } from '../util/versions.js';
import { loadState, ensureState, saveState, setLifecycle } from '../state/store.js';
import * as log from '../util/log.js';

const CANDIDATES_DIR = path.join(os.homedir(), '.skillmax', 'candidates');

export interface OptimizeArgs {
  action: 'score' | 'apply' | 'gate' | 'promote' | 'revert';
  skillName?: string;
  skillDir?: string;
  editsPath?: string;
  evalPath?: string;
  rolloutsPath?: string;
  liveDir?: string;
  candidateDir?: string;
  version?: string;
  step?: number;
  total?: number;
  base?: number;
  min?: number;
  scheduler?: Scheduler;
  current?: number;
  candidate?: number;
  best?: number;
  score?: number;
  allowExec?: boolean;
  json?: boolean;
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
}

function bumpPatch(version: string): string {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return `${version}+1`;
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

export async function optimize(args: OptimizeArgs): Promise<void> {
  switch (args.action) {
    case 'score':
      return scoreAction(args);
    case 'apply':
      return applyAction(args);
    case 'gate':
      return gateAction(args);
    case 'promote':
      return promoteAction(args);
    case 'revert':
      return revertAction(args);
    default:
      log.error(`Unknown optimize action: ${args.action}`);
      process.exitCode = 1;
  }
}

// Score rollout outputs against an eval manifest (deterministic; defers agent-judge).
async function scoreAction(args: OptimizeArgs): Promise<void> {
  if (!args.evalPath || !args.rolloutsPath) {
    log.error('Usage: optimize score --eval <manifest> --rollouts <rollouts.json>');
    process.exitCode = 1;
    return;
  }
  const manifest = loadEvalManifest(args.evalPath); // throws on empty/invalid (AE3)
  const rollouts = readJson<RolloutOutput[]>(args.rolloutsPath);
  const result = await scoreRollouts(manifest, rollouts, {
    skillId: args.skillName,
    allowExec: args.allowExec,
  });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  log.heading(`Score: ${result.aggregate ?? 'n/a'}`);
  for (const t of result.perTask) {
    log.info(`  ${t.taskId}: ${t.pending ? 'PENDING (agent-judge)' : t.score}${t.detail ? ` (${t.detail})` : ''}`);
  }
  if (result.pendingJudgments.length > 0) {
    log.warn(`${result.pendingJudgments.length} task(s) need agent-judge scoring before the gate can run.`);
  }
}

// Apply bounded edits to a managed COPY (never the symlinked source — KTD5).
function applyAction(args: OptimizeArgs): void {
  if (!args.skillDir || !args.editsPath) {
    log.error('Usage: optimize apply --skill-dir <dir> --edits <edits.json> [--step N --total M]');
    process.exitCode = 1;
    return;
  }
  const name = args.skillName ?? path.basename(args.skillDir);
  const skillMd = path.join(args.skillDir, 'SKILL.md');
  if (!fileExists(skillMd)) {
    log.error(`no SKILL.md in ${args.skillDir}`);
    process.exitCode = 1;
    return;
  }
  const candidateDir = path.join(CANDIDATES_DIR, name);
  removeDir(candidateDir);
  ensureDir(path.dirname(candidateDir));
  copyDir(args.skillDir, candidateDir); // managed working copy

  const edits = readJson<Edit[]>(args.editsPath);
  const budget = editBudget(args.step ?? 0, args.total ?? 1, {
    base: args.base,
    min: args.min,
    scheduler: args.scheduler,
  });
  const selected = selectEdits(edits, budget);
  const content = fs.readFileSync(path.join(candidateDir, 'SKILL.md'), 'utf-8');
  const result = applyEdits(content, selected);
  fs.writeFileSync(path.join(candidateDir, 'SKILL.md'), result.content);

  if (args.json) {
    console.log(JSON.stringify({ candidateDir, budget, applied: result.applied.length, rejected: result.rejected }, null, 2));
    return;
  }
  log.success(`Candidate at ${candidateDir} (budget ${budget}, applied ${result.applied.length})`);
  for (const r of result.rejected) log.warn(`  rejected ${r.edit.op}: ${r.reason}`);
}

// Deterministic gate decision (exit 1 on reject so the loop can branch).
function gateAction(args: OptimizeArgs): void {
  if (args.current === undefined || args.candidate === undefined) {
    log.error('Usage: optimize gate --current <score> --candidate <score> [--best <score>]');
    process.exitCode = 1;
    return;
  }
  const res = gate(args.current, args.candidate, args.best ?? args.current);
  log.info(`gate: ${res.action}`);
  if (res.action === 'reject') process.exitCode = 1;
}

// Human-approved promotion: atomic swap, prior version retained, score recorded.
function promoteAction(args: OptimizeArgs): void {
  if (!args.skillName || !args.liveDir || !args.candidateDir) {
    log.error('Usage: optimize promote --skill <name> --live <dir> --candidate <dir> [--score S]');
    process.exitCode = 1;
    return;
  }
  const now = new Date().toISOString();
  const state = loadState(args.skillName) ?? ensureState({ name: args.skillName, origin: 'optimized' }, now);
  const priorVersion = state.version;
  const newVersion = bumpPatch(priorVersion);

  promote({
    id: args.skillName,
    liveDir: args.liveDir,
    candidateDir: args.candidateDir,
    priorVersion,
  });

  state.version = newVersion;
  state.lifecycle = 'live';
  state.origin = 'optimized';
  state.updatedAt = now;
  if (args.score !== undefined) {
    state.scoreHistory.push({ version: newVersion, score: args.score, at: now });
  }
  saveState(state);
  log.success(`Promoted ${args.skillName} ${priorVersion} → ${newVersion} (prior retained, reversible).`);
}

// Revert to a retained version (atomic).
function revertAction(args: OptimizeArgs): void {
  if (!args.skillName || !args.version || !args.liveDir) {
    log.error('Usage: optimize revert --skill <name> --version <v> --live <dir>');
    process.exitCode = 1;
    return;
  }
  revert(args.skillName, args.version, args.liveDir);
  const now = new Date().toISOString();
  setLifecycle(args.skillName, 'reverted', now);
  log.success(`Reverted ${args.skillName} to ${args.version}.`);
}

export { noHeldOutRegression };
