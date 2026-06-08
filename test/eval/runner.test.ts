import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';
import type { EvalManifest } from '../../src/eval/schema.js';

// code-exec scoring runs in the sandbox → needs trust state (HOME redirect).
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let runner: typeof import('../../src/eval/runner.js');
let store: typeof import('../../src/state/store.js');
let trust: typeof import('../../src/state/trust.js');

const NOW = '2026-06-08T00:00:00.000Z';

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  runner = await import('../../src/eval/runner.js');
  store = await import('../../src/state/store.js');
  trust = await import('../../src/state/trust.js');
  store.ensureState({ name: 'demo', origin: 'created' }, NOW);
  trust.grantTrust('demo', NOW);
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
});

test('scores deterministic tasks and computes aggregate', async () => {
  const manifest: EvalManifest = {
    skill: 'demo',
    tasks: [
      { id: 'a', input: 'i', scorer: 'exact', expect: 'yes' },
      { id: 'b', input: 'i', scorer: 'exact', expect: 'no' },
    ],
  };
  const res = await runner.scoreRollouts(manifest, [
    { taskId: 'a', output: 'yes' },
    { taskId: 'b', output: 'wrong' },
  ]);
  assert.equal(res.aggregate, 0.5);
  assert.equal(res.perTask.find((t) => t.taskId === 'a')!.passed, true);
  assert.equal(res.perTask.find((t) => t.taskId === 'b')!.passed, false);
});

test('is deterministic for the same inputs', async () => {
  const manifest: EvalManifest = {
    skill: 'demo',
    tasks: [{ id: 'a', input: 'i', scorer: 'normalized', expect: 'Hello World' }],
  };
  const a = await runner.scoreRollouts(manifest, [{ taskId: 'a', output: 'hello   world' }]);
  const b = await runner.scoreRollouts(manifest, [{ taskId: 'a', output: 'hello   world' }]);
  assert.deepEqual(a.aggregate, b.aggregate);
  assert.equal(a.aggregate, 1);
});

test('defers agent-judge tasks as pending judgments', async () => {
  const manifest: EvalManifest = {
    skill: 'demo',
    tasks: [
      { id: 'p', input: 'write a haiku', scorer: 'agent-judge', rubric: '5-7-5 and evocative' },
      { id: 'd', input: 'i', scorer: 'exact', expect: 'ok' },
    ],
  };
  const res = await runner.scoreRollouts(manifest, [
    { taskId: 'p', output: 'some haiku text' },
    { taskId: 'd', output: 'ok' },
  ]);
  assert.equal(res.pendingJudgments.length, 1);
  assert.equal(res.pendingJudgments[0].taskId, 'p');
  assert.equal(res.pendingJudgments[0].rubric, '5-7-5 and evocative');
  assert.equal(res.perTask.find((t) => t.taskId === 'p')!.pending, true);
  // aggregate excludes the pending task → only the exact task counts
  assert.equal(res.aggregate, 1);
});

test('code-exec scorer runs in the sandbox and reflects exit status', async () => {
  const pass: EvalManifest = {
    skill: 'demo',
    tasks: [{ id: 'c', input: 'i', scorer: 'code-exec', command: ['node', '-e', 'process.exit(0)'] }],
  };
  const fail: EvalManifest = {
    skill: 'demo',
    tasks: [{ id: 'c', input: 'i', scorer: 'code-exec', command: ['node', '-e', 'process.exit(1)'] }],
  };
  const rp = await runner.scoreRollouts(pass, [{ taskId: 'c', output: '' }], { skillId: 'demo' });
  const rf = await runner.scoreRollouts(fail, [{ taskId: 'c', output: '' }], { skillId: 'demo' });
  assert.equal(rp.aggregate, 1);
  assert.equal(rf.aggregate, 0);
});

test('code-exec refuses an untrusted skill without allowExec', async () => {
  store.ensureState({ name: 'untrusted-demo', origin: 'discovered' }, NOW);
  const m: EvalManifest = {
    skill: 'untrusted-demo',
    tasks: [{ id: 'c', input: 'i', scorer: 'code-exec', command: ['node', '-e', 'process.exit(0)'] }],
  };
  await assert.rejects(() => runner.scoreRollouts(m, [{ taskId: 'c', output: '' }], { skillId: 'untrusted-demo' }));
});
