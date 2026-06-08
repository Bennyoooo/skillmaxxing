import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir, removeDir, copyDir, fileExists } from '../util/fs.js';
import { readRegistry, writeRegistry } from './registry.js';
import type { Channel } from '../types.js';

/**
 * Collaborative optimization + review/promote for the shared registry (U15).
 *
 * - Pooled evals are append-only JSONL (merge-friendly across contributors).
 * - Promotion to a higher channel REQUIRES explicit review/approval (review S2):
 *   the gate refuses without `approve` + an `approver`, and records a receipt.
 * - Divergent versions of the same skill in the target channel are surfaced as a
 *   CONFLICT, never silently merged (review R22/SG7: detection, not auto-resolve).
 */

function appendJsonl(file: string, record: unknown): void {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, JSON.stringify(record) + '\n');
}

function readJsonl<T>(file: string): T[] {
  try {
    return fs
      .readFileSync(file, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

export interface PooledScore {
  skill: string;
  score: number;
  by: string;
  at: string;
}

export function poolEval(registryDir: string, entry: PooledScore): void {
  appendJsonl(path.join(registryDir, 'evals', `${entry.skill}.jsonl`), entry);
}

export function pooledScores(registryDir: string, skill: string): PooledScore[] {
  return readJsonl<PooledScore>(path.join(registryDir, 'evals', `${skill}.jsonl`));
}

export interface PromoteParams {
  skill: string;
  toChannel: Channel;
  approve: boolean;
  approver?: string;
  at: string;
}

export type PromoteResult = { ok: true } | { ok: false; reason: string };

export function reviewPromote(registryDir: string, params: PromoteParams): PromoteResult {
  if (!params.approve) {
    return {
      ok: false,
      reason: `promotion to ${params.toChannel} requires review and approval (pass approve + an approver)`,
    };
  }
  if (!params.approver) {
    return { ok: false, reason: 'an approver is required for promotion' };
  }

  const idx = readRegistry(registryDir);
  const candidates = idx.skills.filter((e) => e.name === params.skill);
  if (candidates.length === 0) {
    return { ok: false, reason: `"${params.skill}" is not in the registry` };
  }

  // Source = the entry being promoted INTO the target: the highest-versioned
  // entry NOT already in the target channel (falls back to the target's own
  // entry if it only exists there — a harmless no-op promote).
  const promotable = candidates.filter((e) => e.channel !== params.toChannel);
  const source = [...(promotable.length > 0 ? promotable : candidates)].sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  )[0];

  // Conflict detection: a different version already occupies the target channel.
  const targetExisting = candidates.find((e) => e.channel === params.toChannel);
  if (targetExisting && targetExisting.version !== source.version) {
    return {
      ok: false,
      reason: `conflict: ${params.skill} is already ${targetExisting.version} in ${params.toChannel} (source ${source.version}); resolve manually`,
    };
  }

  const srcDir = path.join(registryDir, 'skills', source.channel, params.skill);
  if (!fileExists(path.join(srcDir, 'SKILL.md'))) {
    return { ok: false, reason: `registry files missing for ${params.skill} in ${source.channel}` };
  }
  const dstDir = path.join(registryDir, 'skills', params.toChannel, params.skill);
  removeDir(dstDir);
  ensureDir(path.dirname(dstDir));
  copyDir(srcDir, dstDir);

  idx.skills = idx.skills.filter((e) => !(e.name === params.skill && e.channel === params.toChannel));
  idx.skills.push({
    name: params.skill,
    channel: params.toChannel,
    version: source.version,
    publishedBy: source.publishedBy,
    publishedAt: source.publishedAt,
  });
  writeRegistry(registryDir, idx);

  // Append-only approval receipt (auditability; review S10 notes signing as a follow-up).
  appendJsonl(path.join(registryDir, 'approvals.jsonl'), {
    skill: params.skill,
    toChannel: params.toChannel,
    version: source.version,
    approver: params.approver,
    at: params.at,
  });
  return { ok: true };
}
