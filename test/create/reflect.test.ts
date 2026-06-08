import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  workflowSignature,
  similarity,
  repeatedWorkflows,
  hasRepeatedWorkflow,
} from '../../src/create/reflect.js';

test('workflowSignature normalizes and orders steps', () => {
  assert.equal(workflowSignature(['  Git Log ', 'group  changes']), 'git log > group changes');
});

test('similarity is order-insensitive jaccard of step sets', () => {
  const a = { steps: ['git log', 'group changes', 'write notes'] };
  const b = { steps: ['write notes', 'git log', 'group changes'] };
  assert.equal(similarity(a, b), 1);
});

test('repeatedWorkflows flags a workflow shape that recurs', () => {
  const records = [
    { steps: ['git log', 'group changes', 'write notes'] },
    { steps: ['git log', 'group changes', 'write notes'] },
    { steps: ['deploy', 'smoke test'] }, // unrelated, single occurrence
  ];
  const clusters = repeatedWorkflows(records, { minRepeat: 2, threshold: 0.7 });
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].count, 2);
  assert.equal(hasRepeatedWorkflow(records), true);
});

test('a single occurrence does not signal repetition (no false positive)', () => {
  const records = [
    { steps: ['git log', 'group changes'] },
    { steps: ['totally different', 'other thing'] },
  ];
  assert.equal(hasRepeatedWorkflow(records), false);
});
