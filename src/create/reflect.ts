/**
 * Deterministic helpers for the in-session reflection loop (Hermes-style). The
 * CLI/library does NOT decide whether to crystallize a skill — that judgment is
 * the host agent's, gated by the user. These helpers only surface the signal:
 * "this workflow shape has repeated", so the agent can propose (sparingly — review
 * P7f) turning it into a skill via the prefer-update-over-create path.
 */

import { jaccard } from '../util/similarity.js';

export interface WorkflowRecord {
  /** Ordered step signatures -- e.g. tool names or normalized commands. */
  steps: string[];
}

function normalizeStep(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** A stable signature for a workflow's ordered steps. */
export function workflowSignature(steps: string[]): string {
  return steps.map(normalizeStep).join(' > ');
}

function stepSet(steps: string[]): Set<string> {
  return new Set(steps.map(normalizeStep));
}

/** Jaccard similarity of two workflows' step sets (order-insensitive). */
export function similarity(a: WorkflowRecord, b: WorkflowRecord): number {
  return jaccard(stepSet(a.steps), stepSet(b.steps));
}

export interface RepeatCluster {
  representative: WorkflowRecord;
  count: number;
  indices: number[];
}

/**
 * Cluster records by approximate similarity and return clusters that recur at
 * least `minRepeat` times — the "this is reusable" signal. Deterministic:
 * processes records in order, greedily assigning each to the first cluster it
 * matches above `threshold`.
 */
export function repeatedWorkflows(
  records: WorkflowRecord[],
  opts: { minRepeat?: number; threshold?: number } = {},
): RepeatCluster[] {
  const minRepeat = opts.minRepeat ?? 2;
  const threshold = opts.threshold ?? 0.7;
  const clusters: RepeatCluster[] = [];
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const existing = clusters.find((c) => similarity(c.representative, rec) >= threshold);
    if (existing) {
      existing.count++;
      existing.indices.push(i);
    } else {
      clusters.push({ representative: rec, count: 1, indices: [i] });
    }
  }
  return clusters.filter((c) => c.count >= minRepeat);
}

/** True when any workflow shape has repeated enough to be worth crystallizing. */
export function hasRepeatedWorkflow(
  records: WorkflowRecord[],
  opts?: { minRepeat?: number; threshold?: number },
): boolean {
  return repeatedWorkflows(records, opts).length > 0;
}
