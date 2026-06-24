import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

// Redirect HOME to a temp dir BEFORE importing the store (STATE_DIR is computed
// from os.homedir() at import time). node:test isolates each file in its own
// process, so this does not leak to other test files.
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let store: typeof import('../../src/state/store.js');
let trust: typeof import('../../src/state/trust.js');

const NOW = '2026-06-08T00:00:00.000Z';

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  store = await import('../../src/state/store.js');
  trust = await import('../../src/state/trust.js');
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
});

test('ensureState creates a default trusted:false record', () => {
  const s = store.ensureState({ name: 'alpha', origin: 'created' }, NOW);
  assert.equal(s.trusted, false);
  assert.equal(s.origin, 'created');
  assert.equal(s.lifecycle, 'committed');
  assert.deepEqual(store.loadState('alpha')!.scoreHistory, []);
});

test('saveState/loadState round-trip all fields', () => {
  store.saveState({
    name: 'beta',
    id: 'beta',
    origin: 'optimized',
    trusted: true,
    version: '2.1.0',
    lifecycle: 'live',
    scoreHistory: [{ version: '2.0.0', score: 0.8, at: NOW }],
    source: 'owner/repo',
    createdAt: NOW,
    updatedAt: NOW,
  });
  const got = store.loadState('beta')!;
  assert.equal(got.version, '2.1.0');
  assert.equal(got.lifecycle, 'live');
  assert.equal(got.source, 'owner/repo');
  assert.equal(got.scoreHistory.length, 1);
});

test('loadState returns null for missing or corrupt sidecars', () => {
  assert.equal(store.loadState('does-not-exist'), null);
  // write a corrupt file at the expected path
  const dir = path.join(tmpHome, '.skillmax', 'state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'corrupt.json'), '{not json');
  assert.equal(store.loadState('corrupt'), null);
});

test('score history is trimmed to MAX_SCORE_HISTORY on save', () => {
  store.ensureState({ name: 'gamma', origin: 'optimized' }, NOW);
  for (let i = 0; i < store.MAX_SCORE_HISTORY + 5; i++) {
    store.recordScore('gamma', { version: `1.0.${i}`, score: i, at: NOW });
  }
  const got = store.loadState('gamma')!;
  assert.equal(got.scoreHistory.length, store.MAX_SCORE_HISTORY);
  // most-recent retained
  assert.equal(
    got.scoreHistory[got.scoreHistory.length - 1].version,
    `1.0.${store.MAX_SCORE_HISTORY + 4}`,
  );
});

test('origin-namespaced identities do not collide (review A5)', () => {
  // Two same-named skills from different origins use distinct ids → distinct files.
  store.ensureState({ name: 'code-review', id: 'code-review', origin: 'created' }, NOW);
  store.ensureState({ name: 'code-review', id: 'team-acme__code-review', origin: 'workspace' }, NOW);
  trust.grantTrust('code-review', NOW);

  const local = store.loadState('code-review')!;
  const synced = store.loadState('team-acme__code-review')!;
  assert.equal(local.trusted, true);
  assert.equal(synced.trusted, false); // untouched — no clobber
  assert.equal(synced.origin, 'workspace');
});

test('grantTrust/revokeTrust/isTrusted', () => {
  store.ensureState({ name: 'delta', origin: 'discovered' }, NOW);
  assert.equal(trust.isTrusted('delta'), false);
  assert.equal(trust.grantTrust('delta', NOW), true);
  assert.equal(trust.isTrusted('delta'), true);
  trust.revokeTrust('delta', NOW);
  assert.equal(trust.isTrusted('delta'), false);
  // grant on a non-existent record is a no-op failure
  assert.equal(trust.grantTrust('nobody', NOW), false);
});
