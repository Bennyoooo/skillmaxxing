import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, parseEvalManifest } from '../../src/eval/schema.js';

const valid = {
  skill: 'demo',
  tasks: [
    { id: 't1', input: 'in', scorer: 'exact', expect: 'out' },
    { id: 't2', input: 'in2', scorer: 'agent-judge', rubric: 'is it good?' },
  ],
};

test('accepts a valid manifest', () => {
  assert.equal(validateManifest(valid), null);
});

test('rejects an empty task set (AE3)', () => {
  assert.match(validateManifest({ skill: 'x', tasks: [] })!, /non-empty/);
});

test('requires expect for exact, rubric for agent-judge, command for code-exec', () => {
  assert.match(validateManifest({ skill: 'x', tasks: [{ id: 'a', input: 'i', scorer: 'exact' }] })!, /requires expect/);
  assert.match(
    validateManifest({ skill: 'x', tasks: [{ id: 'a', input: 'i', scorer: 'agent-judge' }] })!,
    /requires a rubric/,
  );
  assert.match(
    validateManifest({ skill: 'x', tasks: [{ id: 'a', input: 'i', scorer: 'code-exec' }] })!,
    /requires a command/,
  );
});

test('rejects unknown scorer, duplicate ids, and dangling heldOut', () => {
  assert.match(validateManifest({ skill: 'x', tasks: [{ id: 'a', input: 'i', scorer: 'bogus' }] })!, /invalid scorer/);
  assert.match(
    validateManifest({
      skill: 'x',
      tasks: [
        { id: 'a', input: 'i', scorer: 'success-signal' },
        { id: 'a', input: 'i', scorer: 'success-signal' },
      ],
    })!,
    /duplicate task id/,
  );
  assert.match(
    validateManifest({ skill: 'x', tasks: [{ id: 'a', input: 'i', scorer: 'success-signal' }], heldOut: ['z'] })!,
    /unknown task/,
  );
});

test('parseEvalManifest parses YAML and rejects malformed/invalid', () => {
  const yaml = 'skill: demo\ntasks:\n  - id: t1\n    input: hi\n    scorer: success-signal\n';
  const m = parseEvalManifest(yaml);
  assert.equal(m.skill, 'demo');
  assert.equal(m.tasks.length, 1);
  assert.throws(() => parseEvalManifest('skill: demo\ntasks: []\n'), /invalid eval manifest/);
});
