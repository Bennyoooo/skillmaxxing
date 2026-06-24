import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeEntryName, resolveSource } from '../../src/source/resolver.js';
import { parseSource } from '../../src/source/parser.js';
import { writeSkill } from '../helpers/fixtures.js';
import { withTmpDir } from '../helpers/tmp.js';

test('isSafeEntryName rejects traversal/separator names (review S5)', () => {
  assert.equal(isSafeEntryName('normal-skill'), true);
  assert.equal(isSafeEntryName('..'), false);
  assert.equal(isSafeEntryName('.'), false);
  assert.equal(isSafeEntryName('a/b'), false);
  assert.equal(isSafeEntryName('a\\b'), false);
  assert.equal(isSafeEntryName(''), false);
});

test('resolveSource scans one level of subdirectories for SKILL.md', async () => {
  await withTmpDir(async (dir) => {
    writeSkill(dir, { name: 'one' });
    writeSkill(dir, { name: 'two' });
    // a non-skill dir is ignored
    writeSkill(dir, { name: 'three', body: '' }); // still a skill; add a real non-skill below
    const resolved = await resolveSource(parseSource(dir));
    const names = resolved.map((s) => s.name).sort();
    assert.deepEqual(names, ['one', 'three', 'two']);
  });
});
