import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { collectSources } from '../../src/discover/collect.js';
import { discoverFromRepo } from '../../src/discover/github.js';
import { scanLocalSkills } from '../../src/discover/local.js';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';
import { writeSkill } from '../helpers/fixtures.js';

function writeIndex(dir: string): string {
  const p = path.join(dir, 'index.json');
  fs.writeFileSync(
    p,
    JSON.stringify({
      version: 1,
      skills: [{ name: 'indexed-skill', description: 'd', source: 'owner/repo' }],
    }),
  );
  return p;
}

test('collectSources isolates a failing source and returns partial results (review I7)', async () => {
  const dir = makeTmpDir('collect');
  try {
    const indexPath = writeIndex(dir);
    const result = await collectSources({
      index: true,
      indexPath,
      local: false,
      repos: ['/no/such/repo/path-zzz'], // resolveLocal throws → isolated error
    });
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].name, 'indexed-skill');
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].source, /path-zzz/);
  } finally {
    cleanTmpDir(dir);
  }
});

test('discoverFromRepo resolves a local path source into candidates', async () => {
  const dir = makeTmpDir('repo');
  try {
    writeSkill(dir, { name: 'found-skill', description: 'Found it.' });
    const cands = await discoverFromRepo(dir);
    assert.equal(cands.length, 1);
    assert.equal(cands[0].name, 'found-skill');
    assert.equal(cands[0].origin, 'local');
  } finally {
    cleanTmpDir(dir);
  }
});

test('scanLocalSkills finds project-scoped installed skills', () => {
  const project = makeTmpDir('proj');
  try {
    // simulate an installed skill under a project agent dir
    const skillsDir = path.join(project, '.claude', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    writeSkill(skillsDir, { name: 'unique-local-xyz', description: 'Local.' });
    const found = scanLocalSkills(project);
    assert.ok(found.some((c) => c.name === 'unique-local-xyz' && c.installed));
  } finally {
    cleanTmpDir(project);
  }
});
