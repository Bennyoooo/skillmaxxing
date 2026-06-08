import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir, withTmpDir } from '../helpers/tmp.js';
import { writeSkill } from '../helpers/fixtures.js';
import { readSkillMeta } from '../../src/util/frontmatter.js';

test('harness runs a real assertion', () => {
  assert.equal(1 + 1, 2);
});

test('makeTmpDir creates and cleanTmpDir removes a temp dir', () => {
  const dir = makeTmpDir('harness');
  assert.ok(fs.existsSync(dir));
  cleanTmpDir(dir);
  assert.ok(!fs.existsSync(dir));
});

test('writeSkill fixture produces a parseable SKILL.md', () => {
  withTmpDir((dir) => {
    const skillDir = writeSkill(dir, { name: 'demo-skill', description: 'Demo.' });
    const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
    const meta = readSkillMeta(content);
    assert.equal(meta?.name, 'demo-skill');
    assert.equal(meta?.description, 'Demo.');
  });
});
