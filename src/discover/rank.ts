import type { DiscoveryCandidate } from './types.js';

export interface RankedCandidate extends DiscoveryCandidate {
  score: number;
  /** Same-named candidates from other sources, ranked lower. */
  alternates: DiscoveryCandidate[];
}

/**
 * Deterministic lexical + metadata ranking. Embeddings are intentionally NOT
 * abstracted here yet (review SG2: a one-implementation interface is YAGNI) — a
 * ranking strategy can be added when a second implementation actually exists.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function scoreCandidate(intentTokens: string[], c: DiscoveryCandidate): number {
  const nameLower = c.name.toLowerCase();
  const nameTokens = new Set(tokenize(c.name));
  const tagTokens = new Set(c.tags.flatMap(tokenize));
  const descTokens = new Set(tokenize(c.description));
  let score = 0;
  for (const t of intentTokens) {
    if (nameTokens.has(t)) score += 3;
    else if (nameLower.includes(t)) score += 2; // partial name hit
    if (tagTokens.has(t)) score += 2;
    if (descTokens.has(t)) score += 1;
  }
  return score;
}

function originRank(origin: string): number {
  return origin === 'local' ? 0 : origin === 'index' ? 1 : 2;
}

/**
 * Rank candidates against the user's intent, de-duplicating same-named skills
 * across sources (the highest-scoring wins; the rest become `alternates`).
 * Fully deterministic: equal inputs always produce equal output ordering.
 */
export function rankCandidates(
  intent: string,
  candidates: DiscoveryCandidate[],
): RankedCandidate[] {
  const intentTokens = [...new Set(tokenize(intent))];

  const groups = new Map<string, DiscoveryCandidate[]>();
  for (const c of candidates) {
    const key = c.name.toLowerCase();
    const arr = groups.get(key);
    if (arr) arr.push(c);
    else groups.set(key, [c]);
  }

  const ranked: RankedCandidate[] = [];
  for (const group of groups.values()) {
    const scored = group
      .map((c) => ({ c, s: scoreCandidate(intentTokens, c) }))
      .sort(
        (a, b) =>
          b.s - a.s ||
          originRank(a.c.origin) - originRank(b.c.origin) ||
          a.c.source.localeCompare(b.c.source),
      );
    const primary = scored[0];
    ranked.push({
      ...primary.c,
      installed: group.some((c) => c.installed),
      score: primary.s,
      alternates: scored.slice(1).map((x) => x.c),
    });
  }

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.installed) - Number(a.installed) ||
      a.name.localeCompare(b.name),
  );
  return ranked;
}
