import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../../src/util/frontmatter.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pluginDir = path.join(root, 'skill-maxing-plugin');

test('plugin.json parses and references four real skills', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf-8'));
  assert.equal(manifest.skills.length, 4);
  for (const rel of manifest.skills) {
    const skillMd = path.join(pluginDir, rel, 'SKILL.md');
    assert.ok(fs.existsSync(skillMd), `${rel}/SKILL.md should exist`);
    const parsed = parseFrontmatter(fs.readFileSync(skillMd, 'utf-8'));
    assert.ok(parsed, `${rel}/SKILL.md should have valid frontmatter`);
  }
});

test('every plugin skill has a matching wrapper script', () => {
  const expected = ['discover.sh', 'skillify.sh', 'optimize.sh', 'workspace.sh'];
  for (const s of expected) {
    assert.ok(fs.existsSync(path.join(pluginDir, 'scripts', s)), `scripts/${s} should exist`);
  }
});
