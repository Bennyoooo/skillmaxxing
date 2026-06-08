import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankCandidates } from '../../src/discover/rank.js';
import type { DiscoveryCandidate } from '../../src/discover/types.js';

function cand(p: Partial<DiscoveryCandidate> & { name: string }): DiscoveryCandidate {
  return {
    name: p.name,
    description: p.description ?? '',
    source: p.source ?? 'owner/repo',
    origin: p.origin ?? 'index',
    tags: p.tags ?? [],
    commitSha: p.commitSha,
    installed: p.installed ?? false,
  };
}

test('ranks a name match above an unrelated skill', () => {
  const ranked = rankCandidates('code review', [
    cand({ name: 'weather-report', description: 'forecasts' }),
    cand({ name: 'code-review', description: 'reviews code changes' }),
  ]);
  assert.equal(ranked[0].name, 'code-review');
  assert.ok(ranked[0].score > ranked[1].score);
});

test('dedupes same-named skills across sources, recording alternates', () => {
  const ranked = rankCandidates('code review', [
    cand({ name: 'code-review', origin: 'index', source: 'a/x', description: 'reviews code' }),
    cand({ name: 'code-review', origin: 'local', source: '', installed: true }),
  ]);
  const entry = ranked.find((r) => r.name === 'code-review')!;
  assert.equal(ranked.filter((r) => r.name === 'code-review').length, 1);
  assert.equal(entry.installed, true); // merged installed flag
  assert.equal(entry.alternates.length, 1);
});

test('ranking is deterministic for identical input', () => {
  const input = [
    cand({ name: 'b-skill', description: 'review' }),
    cand({ name: 'a-skill', description: 'review' }),
    cand({ name: 'code-review', description: 'review code' }),
  ];
  const first = rankCandidates('review code', input).map((r) => r.name);
  const second = rankCandidates('review code', input).map((r) => r.name);
  assert.deepEqual(first, second);
});

test('tags contribute to relevance', () => {
  const ranked = rankCandidates('security', [
    cand({ name: 'helper', description: 'does things', tags: ['security', 'audit'] }),
    cand({ name: 'helper-2', description: 'unrelated' }),
  ]);
  assert.equal(ranked[0].name, 'helper');
});

test('empty intent returns all candidates (no filtering at rank layer)', () => {
  const ranked = rankCandidates('', [cand({ name: 'one' }), cand({ name: 'two' })]);
  assert.equal(ranked.length, 2);
});
