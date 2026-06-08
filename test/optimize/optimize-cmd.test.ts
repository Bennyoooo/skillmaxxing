import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let opt: typeof import('../../src/commands/optimize.js');
let store: typeof import('../../src/state/store.js');

const NOW = '2026-06-08T00:00:00.000Z';

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  opt = await import('../../src/commands/optimize.js');
  store = await import('../../src/state/store.js');
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
});

test('apply → promote → revert is reversible and score-linked', async () => {
  const work = makeTmpDir('opt');
  try {
    const liveDir = path.join(work, 'my-skill');
    fs.mkdirSync(liveDir);
    fs.writeFileSync(path.join(liveDir, 'SKILL.md'), '---\nname: my-skill\ndescription: d\n---\n# Body\nORIGINAL\n');
    store.ensureState({ name: 'my-skill', origin: 'optimized' }, NOW);

    const editsPath = path.join(work, 'edits.json');
    fs.writeFileSync(editsPath, JSON.stringify([{ op: 'append', content: 'NEW-LINE' }]));

    // apply → candidate
    await opt.optimize({ action: 'apply', skillName: 'my-skill', skillDir: liveDir, editsPath });
    const candidateDir = path.join(tmpHome, '.skillmax', 'candidates', 'my-skill');
    assert.match(fs.readFileSync(path.join(candidateDir, 'SKILL.md'), 'utf-8'), /NEW-LINE/);

    // promote (human-approved) with a score
    await opt.optimize({
      action: 'promote',
      skillName: 'my-skill',
      liveDir,
      candidateDir,
      score: 0.9,
    });
    assert.match(fs.readFileSync(path.join(liveDir, 'SKILL.md'), 'utf-8'), /NEW-LINE/);
    const s = store.loadState('my-skill')!;
    assert.equal(s.version, '1.0.1');
    assert.equal(s.lifecycle, 'live');
    assert.equal(s.scoreHistory.at(-1)!.score, 0.9);

    // revert to the retained prior version
    await opt.optimize({ action: 'revert', skillName: 'my-skill', version: '1.0.0', liveDir });
    const reverted = fs.readFileSync(path.join(liveDir, 'SKILL.md'), 'utf-8');
    assert.ok(!reverted.includes('NEW-LINE'));
    assert.match(reverted, /ORIGINAL/);
  } finally {
    cleanTmpDir(work);
  }
});

test('gate action sets non-zero exit on reject', async () => {
  process.exitCode = 0;
  await opt.optimize({ action: 'gate', current: 0.5, candidate: 0.5 });
  assert.equal(process.exitCode, 1);
  process.exitCode = 0;
  await opt.optimize({ action: 'gate', current: 0.5, candidate: 0.6 });
  assert.equal(process.exitCode, 0);
});
