import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreExact, scoreNormalized, scoreSuccessSignal } from '../../src/eval/scorers.js';

test('scoreExact matches after trimming only', () => {
  assert.equal(scoreExact('  hello  ', 'hello'), 1);
  assert.equal(scoreExact('Hello', 'hello'), 0);
});

test('scoreNormalized ignores case and collapses whitespace', () => {
  assert.equal(scoreNormalized('Hello   World', 'hello world'), 1);
  assert.equal(scoreNormalized('hello', 'goodbye'), 0);
});

test('scoreSuccessSignal checks the signal token', () => {
  assert.equal(scoreSuccessSignal('PASS'), 1);
  assert.equal(scoreSuccessSignal('done', 'done'), 1);
  assert.equal(scoreSuccessSignal('FAIL'), 0);
});
