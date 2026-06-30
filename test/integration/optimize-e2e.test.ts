import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

/**
 * End-to-end proof of the create → optimize seam: a skill is created WITH its
 * eval scaffold, the eval ships on disk, a bounded edit produces a scored
 * candidate, the gate accepts it, promotion swaps it in (retaining the prior
 * version), and revert restores the original. This is the path the self-evolving
 * loop drives — the gap these fixes closed.
 */

const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;

let sk: typeof import('../../src/create/skillify.js');
let store: typeof import('../../src/state/store.js');
let schema: typeof import('../../src/eval/schema.js');
let runner: typeof import('../../src/eval/runner.js');
let opt: typeof import('../../src/commands/optimize.js');
let loop: typeof import('../../src/optimize/loop.js');
let versions: typeof import('../../src/util/versions.js');

const NAME = 'demo-answerer';

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  // Import AFTER HOME is set: these modules freeze ~/.skillmax paths at load time.
  sk = await import('../../src/create/skillify.js');
  store = await import('../../src/state/store.js');
  schema = await import('../../src/eval/schema.js');
  runner = await import('../../src/eval/runner.js');
  opt = await import('../../src/commands/optimize.js');
  loop = await import('../../src/optimize/loop.js');
  versions = await import('../../src/util/versions.js');
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
});

test('create→score→apply→gate→promote→revert on a real skill', async () => {
  const liveDir = path.join(tmpHome, '.claude', 'skills', NAME);

  // 1. CREATE with a real eval scaffold and commit it (G1 + G2).
  const staged = await sk.stageDraft({
    name: NAME,
    description: 'Answers a fixed question.',
    body: '# Demo Answerer\n\nWhen asked the question, reply: WRONG\n',
    tools: ['Bash'],
    eval: { skill: NAME, tasks: [{ id: 't1', input: 'the question', scorer: 'exact', expect: 'RIGHT' }] },
  });
  assert.equal(staged.ok, true, staged.detail);
  await sk.commitDraft(NAME, { scope: 'global', agents: ['claude'] });

  // The committed skill is a real copy (not a dangling symlink) and ships its eval.
  assert.ok(fs.existsSync(path.join(liveDir, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(liveDir, 'eval.yaml')), 'eval.yaml must ship with the skill');
  assert.equal(fs.lstatSync(liveDir).isSymbolicLink(), false);
  assert.equal(store.loadState(NAME)!.lifecycle, 'committed');
  assert.equal(store.loadState(NAME)!.version, '1.0.0');

  // 2. SCORE the baseline rollout (the agent ran the skill and got it WRONG).
  const manifest = schema.loadEvalManifest(path.join(liveDir, 'eval.yaml'));
  const baseline = await runner.scoreRollouts(manifest, [{ taskId: 't1', output: 'WRONG' }]);
  assert.equal(baseline.aggregate, 0);

  // 3. APPLY a bounded edit -> a managed candidate copy (never touches live).
  const editsPath = path.join(tmpHome, 'edits.json');
  fs.writeFileSync(
    editsPath,
    JSON.stringify([{ op: 'replace', target: 'WRONG', content: 'RIGHT', sourceType: 'failure' }]),
  );
  await opt.optimize({ action: 'apply', skillName: NAME, skillDir: liveDir, editsPath, step: 0, total: 1 });
  const candidateDir = path.join(tmpHome, '.skillmax', 'candidates', NAME);
  const candBody = fs.readFileSync(path.join(candidateDir, 'SKILL.md'), 'utf-8');
  assert.match(candBody, /RIGHT/);
  assert.doesNotMatch(candBody, /WRONG/);
  // Live is untouched until promotion.
  assert.match(fs.readFileSync(path.join(liveDir, 'SKILL.md'), 'utf-8'), /WRONG/);

  // 4. SCORE the candidate rollout (now RIGHT) and 5. GATE on strict improvement.
  const cand = await runner.scoreRollouts(manifest, [{ taskId: 't1', output: 'RIGHT' }]);
  assert.equal(cand.aggregate, 1);
  assert.equal(loop.gate(baseline.aggregate ?? 0, cand.aggregate ?? 0, baseline.aggregate ?? 0).action, 'accept_new_best');

  // 6. PROMOTE: atomic swap, prior version retained, version bumped.
  await opt.optimize({ action: 'promote', skillName: NAME, liveDir, candidateDir, score: cand.aggregate ?? 0 });
  assert.match(fs.readFileSync(path.join(liveDir, 'SKILL.md'), 'utf-8'), /RIGHT/);
  assert.equal(store.loadState(NAME)!.version, '1.0.1');
  assert.equal(store.loadState(NAME)!.lifecycle, 'live');
  assert.ok(versions.listVersions(NAME).includes('1.0.0'), 'prior version must be retained');

  // 7. REVERT: restore the retained prior version exactly.
  await opt.optimize({ action: 'revert', skillName: NAME, version: '1.0.0', liveDir });
  assert.match(fs.readFileSync(path.join(liveDir, 'SKILL.md'), 'utf-8'), /WRONG/);
  assert.equal(store.loadState(NAME)!.lifecycle, 'reverted');
});
