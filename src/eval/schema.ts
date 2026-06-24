import * as fs from 'node:fs';
import { parse as parseYaml } from 'yaml';

/**
 * One eval format shared by create scaffolds and the optimize loop (R7). Each
 * task self-declares its scorer (the per-task scorer menu): deterministic where
 * possible, `agent-judge` (rubric-scored by the host agent) where the skill
 * produces prose/judgment that has no exact answer. The CLI stays model-agnostic
 * — it scores deterministic tasks and defers `agent-judge` to the host agent.
 */
export const SCORER_TYPES = [
  'exact',
  'normalized',
  'code-exec',
  'success-signal',
  'agent-judge',
] as const;

export type ScorerType = (typeof SCORER_TYPES)[number];

export interface EvalTask {
  id: string;
  /** The input/prompt that exercises the skill during rollout. */
  input: string;
  scorer: ScorerType;
  /** Expected output for exact/normalized/code-exec scorers. */
  expect?: string;
  /** Rubric/criteria for agent-judge scoring. */
  rubric?: string;
  /** argv for the code-exec scorer (run in the sandbox; reads ./output). */
  command?: string[];
}

export interface EvalManifest {
  skill: string;
  tasks: EvalTask[];
  /** Task ids reserved for held-out validation (overfitting guard). */
  heldOut?: string[];
}

/** Return a human-readable error if the manifest is invalid, or null if valid. */
export function validateManifest(m: unknown): string | null {
  if (!m || typeof m !== 'object') return 'manifest must be an object';
  const man = m as Partial<EvalManifest>;
  if (typeof man.skill !== 'string' || !man.skill) return 'manifest.skill must be a non-empty string';
  if (!Array.isArray(man.tasks) || man.tasks.length === 0) {
    return 'manifest.tasks must be a non-empty array'; // optimize cannot run on an empty set (AE3)
  }
  const ids = new Set<string>();
  for (const [i, task] of man.tasks.entries()) {
    if (!task || typeof task !== 'object') return `task ${i} must be an object`;
    if (typeof task.id !== 'string' || !task.id) return `task ${i} missing id`;
    if (ids.has(task.id)) return `duplicate task id "${task.id}"`;
    ids.add(task.id);
    if (typeof task.input !== 'string') return `task "${task.id}" missing input`;
    if (!SCORER_TYPES.includes(task.scorer)) {
      return `task "${task.id}" has invalid scorer "${task.scorer}"`;
    }
    if (
      (task.scorer === 'exact' || task.scorer === 'normalized') &&
      typeof task.expect !== 'string'
    ) {
      return `task "${task.id}" (${task.scorer}) requires expect`;
    }
    if (task.scorer === 'code-exec' && (!Array.isArray(task.command) || task.command.length === 0)) {
      return `task "${task.id}" (code-exec) requires a command array`;
    }
    if (task.scorer === 'agent-judge' && typeof task.rubric !== 'string') {
      return `task "${task.id}" (agent-judge) requires a rubric`;
    }
  }
  if (man.heldOut) {
    for (const id of man.heldOut) {
      if (!ids.has(id)) return `heldOut references unknown task "${id}"`;
    }
  }
  return null;
}

/** Parse a YAML/JSON eval manifest string. Throws on invalid content (hard-fail). */
export function parseEvalManifest(raw: string): EvalManifest {
  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (e) {
    throw new Error(`eval manifest is not valid YAML/JSON: ${e instanceof Error ? e.message : e}`);
  }
  const err = validateManifest(data);
  if (err) throw new Error(`invalid eval manifest: ${err}`);
  return data as EvalManifest;
}

/** Load and validate an eval manifest from disk. Throws on missing/invalid. */
export function loadEvalManifest(manifestPath: string): EvalManifest {
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  return parseEvalManifest(raw);
}
