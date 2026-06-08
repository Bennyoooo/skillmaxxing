import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadCuratedIndex } from '../../src/discover/index.js';
import { withTmpDir } from '../helpers/tmp.js';

test('loadCuratedIndex parses a well-formed index', () => {
  withTmpDir((dir) => {
    const p = path.join(dir, 'index.json');
    fs.writeFileSync(
      p,
      JSON.stringify({
        version: 1,
        skills: [
          { name: 'code-review', description: 'Reviews code', source: 'owner/repo', tags: ['code'] },
          { name: 'release-notes', source: 'owner/notes' },
        ],
      }),
    );
    const got = loadCuratedIndex(p);
    assert.equal(got.length, 2);
    assert.equal(got[0].name, 'code-review');
    assert.equal(got[0].origin, 'index');
    assert.deepEqual(got[0].tags, ['code']);
    assert.deepEqual(got[1].tags, []); // missing tags default to []
  });
});

test('loadCuratedIndex returns [] for missing or corrupt index', () => {
  assert.deepEqual(loadCuratedIndex('/no/such/index.json'), []);
  withTmpDir((dir) => {
    const p = path.join(dir, 'bad.json');
    fs.writeFileSync(p, '{ not json');
    assert.deepEqual(loadCuratedIndex(p), []);
  });
});

test('shipped default index loads without throwing', () => {
  // empty starter seed → [] is correct and must not break discovery
  assert.ok(Array.isArray(loadCuratedIndex()));
});
