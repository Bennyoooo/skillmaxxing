import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findUpdateTarget } from '../../src/create/match.js';
import type { DiscoveryCandidate } from '../../src/discover/types.js';

function cand(name: string, description: string): DiscoveryCandidate {
  return { name, description, source: '', origin: 'local', tags: [], installed: true };
}

test('exact name match routes to update', () => {
  const m = findUpdateTarget('code-review', 'anything', [cand('code-review', 'reviews code')]);
  assert.equal(m.target?.name, 'code-review');
  assert.equal(m.similarity, 1);
});

test('high description similarity routes to update', () => {
  const existing = [cand('reviewer', 'review pull requests for bugs and style issues')];
  const m = findUpdateTarget('pr-checker', 'review pull requests for bugs and style issues', existing);
  assert.equal(m.target?.name, 'reviewer');
});

test('low similarity creates new (no match)', () => {
  const existing = [cand('weather', 'forecasts the weather for a city')];
  const m = findUpdateTarget('haiku-writer', 'writes poems in five seven five form', existing);
  assert.equal(m.target, null);
});
