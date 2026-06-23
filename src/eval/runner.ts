import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EvalManifest, EvalTask } from './schema.js';
import { scoreExact, scoreNormalized, scoreSuccessSignal } from './scorers.js';
import { runSandboxed } from '../util/exec.js';
import { makeTempDir, cleanTempDir } from '../util/git.js';

/** The output a skill produced for a task during rollout (supplied by the host agent). */
export interface RolloutOutput {
  taskId: string;
  output: string;
}

export interface ScoreResult {
  taskId: string;
  scorer: string;
  /** 0..1. For pending agent-judge tasks this is 0 until the agent fills it in. */
  score: number;
  passed: boolean;
  /** True when this task needs host-agent judgment (agent-judge). */
  pending: boolean;
  detail?: string;
}

export interface PendingJudgment {
  taskId: string;
  rubric: string;
  output: string;
}

export interface EvalRunResult {
  perTask: ScoreResult[];
  /** Mean score over deterministically-scored tasks (excludes pending AND missing); null if none. */
  aggregate: number | null;
  pendingJudgments: PendingJudgment[];
  /** Task ids that had no rollout output — excluded from aggregate, surfaced for re-rollout. */
  missing: string[];
}

export interface RunOptions {
  /** Skill identity for the sandbox trust gate (code-exec scorer). */
  skillId?: string;
  /** Allow executing an untrusted skill's code-exec tasks. */
  allowExec?: boolean;
}

async function scoreCodeExec(
  task: EvalTask,
  output: string,
  opts: RunOptions,
): Promise<{ score: number; detail?: string }> {
  const dir = makeTempDir('eval');
  try {
    fs.writeFileSync(path.join(dir, 'output'), output);
    const [cmd, ...args] = task.command!;
    const res = await runSandboxed(cmd, args, {
      cwd: dir,
      skillId: opts.skillId,
      allowExec: opts.allowExec,
      timeoutMs: 30_000,
    });
    const okExit = res.ok;
    const okStdout = task.expect === undefined || res.stdout.trim() === task.expect.trim();
    const score = okExit && okStdout ? 1 : 0;
    return { score, detail: okExit ? undefined : `exit ${res.code}${res.timedOut ? ' (timeout)' : ''}` };
  } finally {
    cleanTempDir(dir);
  }
}

/**
 * Score a set of rollout outputs against an eval manifest. Deterministic scorers
 * run here; `agent-judge` tasks are returned as pending judgments (with output +
 * rubric) for the host agent to score — keeping the CLI model-agnostic (KTD7/KTD8).
 */
export async function scoreRollouts(
  manifest: EvalManifest,
  outputs: RolloutOutput[],
  opts: RunOptions = {},
): Promise<EvalRunResult> {
  const outById = new Map(outputs.map((o) => [o.taskId, o.output]));
  const perTask: ScoreResult[] = [];
  const pendingJudgments: PendingJudgment[] = [];
  const missing: string[] = [];

  for (const task of manifest.tasks) {
    const raw = outById.get(task.id);
    if (task.scorer === 'agent-judge') {
      perTask.push({ taskId: task.id, scorer: task.scorer, score: 0, passed: false, pending: true });
      pendingJudgments.push({ taskId: task.id, rubric: task.rubric ?? '', output: raw ?? '' });
      continue;
    }

    // A missing rollout output is NOT a score of 0 — that would silently tank the
    // aggregate and mislead the gate (review: missing != failure). Flag it and
    // exclude it from the aggregate so the caller re-rolls it out.
    if (raw === undefined) {
      missing.push(task.id);
      perTask.push({ taskId: task.id, scorer: task.scorer, score: 0, passed: false, pending: false, detail: 'no rollout output' });
      continue;
    }
    const output = raw;

    let score = 0;
    let detail: string | undefined;
    if (task.scorer === 'exact') {
      score = scoreExact(output, task.expect ?? '');
    } else if (task.scorer === 'normalized') {
      score = scoreNormalized(output, task.expect ?? '');
    } else if (task.scorer === 'success-signal') {
      score = scoreSuccessSignal(output, task.expect);
    } else if (task.scorer === 'code-exec') {
      const r = await scoreCodeExec(task, output, opts);
      score = r.score;
      detail = r.detail;
    }
    perTask.push({
      taskId: task.id,
      scorer: task.scorer,
      score,
      passed: score >= 1,
      pending: false,
      detail,
    });
  }

  const missingSet = new Set(missing);
  const scored = perTask.filter((r) => !r.pending && !missingSet.has(r.taskId));
  const aggregate =
    scored.length > 0 ? scored.reduce((sum, r) => sum + r.score, 0) / scored.length : null;

  return { perTask, aggregate, pendingJudgments, missing };
}
