import type { DiscoveryCandidate } from '../discover/types.js';
import { tokenSet, jaccard } from '../util/similarity.js';

/**
 * Prefer-update-over-create matcher (KTD12 / review I4): before synthesizing a
 * new skill, check whether an existing one should be updated instead -- an exact
 * name match, or a description similar enough to be the same capability. This is
 * the guard against `code-review`, `code-review-2`, `review-code` proliferation.
 */

export interface MatchResult {
  target: DiscoveryCandidate | null;
  reason: string;
  similarity: number;
}

export const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

export function findUpdateTarget(
  name: string,
  description: string,
  existing: DiscoveryCandidate[],
  threshold = DEFAULT_SIMILARITY_THRESHOLD,
): MatchResult {
  const lower = name.toLowerCase();
  const exact = existing.find((e) => e.name.toLowerCase() === lower);
  if (exact) return { target: exact, reason: `a skill named "${exact.name}" already exists`, similarity: 1 };

  const descTokens = tokenSet(description);
  let best: { c: DiscoveryCandidate; sim: number } | null = null;
  for (const e of existing) {
    const sim = jaccard(descTokens, tokenSet(e.description));
    if (!best || sim > best.sim) best = { c: e, sim };
  }
  if (best && best.sim >= threshold) {
    return {
      target: best.c,
      reason: `"${best.c.name}" is ${(best.sim * 100).toFixed(0)}% similar — consider updating/optimizing it`,
      similarity: best.sim,
    };
  }
  return { target: null, reason: 'no sufficiently similar existing skill', similarity: best?.sim ?? 0 };
}
