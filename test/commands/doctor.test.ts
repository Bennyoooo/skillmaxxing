import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
const origCwd = process.cwd();
let tmpHome: string;
let tmpProject: string;
let doc: typeof import('../../src/commands/doctor.js');
let store: typeof import('../../src/state/store.js');

before(async () => {
  tmpHome = makeTmpDir('home');
  tmpProject = makeTmpDir('project');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  // Isolate project scope so doctor never touches the repo's own .claude/skills.
  process.chdir(tmpProject);
  doc = await import('../../src/commands/doctor.js');
  store = await import('../../src/state/store.js');
});

after(() => {
  process.chdir(origCwd);
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
  cleanTmpDir(tmpProject);
});

test('doctor --fix removes dangling skill links and prunes their state', async () => {
  const skillsDir = path.join(tmpHome, '.claude', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  // A dangling link: its target was never created (mimics a deleted draft).
  const link = path.join(skillsDir, 'ghost-skill');
  fs.symlinkSync(path.join(tmpHome, 'gone-draft'), link);
  const now = new Date().toISOString();
  store.ensureState({ name: 'ghost-skill', origin: 'created', lifecycle: 'committed' }, now);

  // A healthy skill that must survive the fix.
  const liveDir = path.join(skillsDir, 'real-skill');
  fs.mkdirSync(liveDir, { recursive: true });
  fs.writeFileSync(path.join(liveDir, 'SKILL.md'), '---\nname: real-skill\n---\nbody\n');
  store.ensureState({ name: 'real-skill', origin: 'created', lifecycle: 'committed' }, now);

  assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  assert.ok(store.loadState('ghost-skill'));

  await doc.doctor({ fix: true });

  assert.equal(fs.existsSync(link), false); // dangling link removed
  assert.equal(fs.lstatSync(link, { throwIfNoEntry: false }), undefined); // gone, not just unresolved
  assert.equal(store.loadState('ghost-skill'), null); // its state pruned
  assert.ok(fs.existsSync(path.join(liveDir, 'SKILL.md'))); // healthy skill intact
  assert.ok(store.loadState('real-skill')); // healthy state intact
});

test('doctor without --fix reports but never mutates', async () => {
  const skillsDir = path.join(tmpHome, '.claude', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });
  const link = path.join(skillsDir, 'ghost2');
  fs.symlinkSync(path.join(tmpHome, 'missing2'), link);
  store.ensureState({ name: 'ghost2', origin: 'created', lifecycle: 'committed' }, new Date().toISOString());

  await doc.doctor(); // report-only

  assert.equal(fs.lstatSync(link).isSymbolicLink(), true); // still present
  assert.ok(store.loadState('ghost2')); // state untouched
});
