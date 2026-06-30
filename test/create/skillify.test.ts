import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';
import type { SkillDraft } from '../../src/create/skillify.js';

const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let sk: typeof import('../../src/create/skillify.js');
let store: typeof import('../../src/state/store.js');
let trust: typeof import('../../src/state/trust.js');

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  sk = await import('../../src/create/skillify.js');
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

const draft = (over: Partial<SkillDraft> = {}): SkillDraft => ({
  name: 'made-skill',
  description: 'A synthesized skill.',
  body: '# Made Skill\n\nDo the thing.\n',
  tools: ['Bash'],
  eval: {
    skill: 'made-skill',
    tasks: [{ id: 't1', input: 'in', scorer: 'exact', expect: 'out' }],
  },
  ...over,
});

test('stageDraft writes SKILL.md, eval.yaml, scripts and sets staged state', async () => {
  const res = await sk.stageDraft(draft({ scripts: [{ path: 'scripts/run.sh', content: 'echo hi' }] }));
  assert.equal(res.ok, true);
  assert.ok(fs.existsSync(path.join(res.dir, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(res.dir, 'eval.yaml')));
  assert.ok(fs.existsSync(path.join(res.dir, 'scripts', 'run.sh')));
  assert.equal(store.loadState('made-skill')!.lifecycle, 'staged');
  assert.equal(store.loadState('made-skill')!.trusted, false);
});

test('stageDraft requires a non-empty eval scaffold (create->optimize seam)', async () => {
  const missing = await sk.stageDraft(draft({ name: 'no-eval', eval: undefined }));
  assert.equal(missing.ok, false);
  assert.match(missing.detail!, /must ship an eval scaffold with at least one task/);

  const empty = await sk.stageDraft(draft({ name: 'empty-eval', eval: { skill: 'empty-eval', tasks: [] } }));
  assert.equal(empty.ok, false);
  assert.match(empty.detail!, /must ship an eval scaffold with at least one task/);
});

test('stageDraft rejects a malformed (non-empty) eval scaffold (review A3)', async () => {
  // exact scorer with no `expect` — has a task but fails validateManifest.
  const res = await sk.stageDraft(
    draft({ name: 'bad-eval', eval: { skill: 'bad-eval', tasks: [{ id: 't1', input: 'in', scorer: 'exact' }] } }),
  );
  assert.equal(res.ok, false);
  assert.match(res.detail!, /eval scaffold invalid/);
});

test('script paths with traversal are dropped', async () => {
  const res = await sk.stageDraft(draft({ name: 'safe-paths', scripts: [{ path: '../escape.sh', content: 'x' }] }));
  assert.equal(res.ok, true);
  assert.ok(!fs.existsSync(path.join(path.dirname(res.dir), 'escape.sh')));
});

test('smoke test runs only with allowExec (review A7) and passing smoke is ok', async () => {
  const skipped = await sk.stageDraft(draft({ name: 'smoke-skip', smokeTest: ['node', '-e', 'process.exit(0)'] }));
  assert.equal(skipped.smokePassed, null); // skipped without allowExec
  const ran = await sk.stageDraft(
    draft({ name: 'smoke-skip', smokeTest: ['node', '-e', 'process.exit(0)'] }),
    { allowExec: true },
  );
  assert.equal(ran.smokePassed, true);
});

test('commitDraft installs into a target agent and marks committed', async () => {
  await sk.stageDraft(draft({ name: 'committed-skill' }));
  await sk.commitDraft('committed-skill', { scope: 'global', agents: ['claude'] });
  const installed = path.join(tmpHome, '.claude', 'skills', 'committed-skill', 'SKILL.md');
  assert.ok(fs.existsSync(installed));
  assert.equal(store.loadState('committed-skill')!.lifecycle, 'committed');
  assert.equal(sk.listDrafts().includes('committed-skill'), false); // draft cleaned up
});

test('commitDraft throws when no staged draft exists', async () => {
  await assert.rejects(() => sk.commitDraft('never-staged', { scope: 'global', agents: ['claude'] }));
});
