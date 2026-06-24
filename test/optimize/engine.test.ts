import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEdit,
  applyEdits,
  setSlowUpdate,
  SLOW_UPDATE_START,
  type Edit,
} from '../../src/optimize/diff.js';
import { editBudget } from '../../src/optimize/budget.js';
import { RejectedEditBuffer } from '../../src/optimize/buffer.js';
import { gate, noHeldOutRegression, selectEdits } from '../../src/optimize/loop.js';

// --- diff ---

test('applyEdit replace/insert_after/delete/append', () => {
  assert.equal(applyEdit('hello world', { op: 'replace', target: 'world', content: 'there' }).content, 'hello there');
  assert.equal(applyEdit('a c', { op: 'insert_after', target: 'a', content: ' b' }).content, 'a b c');
  assert.equal(applyEdit('a b c', { op: 'delete', target: ' b' }).content, 'a c');
  assert.match(applyEdit('line', { op: 'append', content: 'more' }).content, /line\nmore/);
});

test('applyEdit fails when target is missing', () => {
  const r = applyEdit('hello', { op: 'replace', target: 'absent', content: 'x' });
  assert.equal(r.ok, false);
});

test('edits to the protected slow-update region are rejected (KTD14)', () => {
  const doc = setSlowUpdate('# Skill\n\nbody here', 'protected guidance line');
  assert.ok(doc.includes(SLOW_UPDATE_START));
  const r = applyEdit(doc, { op: 'replace', target: 'protected guidance line', content: 'hacked' });
  assert.equal(r.ok, false);
  assert.match(r.reason!, /protected/);
});

test('applyEdits collects applied and rejected', () => {
  const edits: Edit[] = [
    { op: 'replace', target: 'foo', content: 'bar' },
    { op: 'replace', target: 'missing', content: 'x' },
  ];
  const res = applyEdits('foo baz', edits);
  assert.equal(res.applied.length, 1);
  assert.equal(res.rejected.length, 1);
  assert.equal(res.content, 'bar baz');
});

// --- budget ---

test('editBudget anneals base→min over steps (cosine)', () => {
  assert.equal(editBudget(0, 10, { base: 4, min: 2 }), 4); // start
  assert.equal(editBudget(10, 10, { base: 4, min: 2 }), 2); // end at min
  assert.equal(editBudget(5, 10, { base: 4, min: 2, scheduler: 'constant' }), 4);
});

// --- buffer ---

test('RejectedEditBuffer prevents re-proposing the same edit', () => {
  const buf = new RejectedEditBuffer();
  const e: Edit = { op: 'append', content: 'x' };
  buf.add(e);
  assert.equal(buf.has(e), true);
  assert.deepEqual(buf.filterNew([e, { op: 'append', content: 'y' }]).map((x) => x.content), ['y']);
  buf.reset();
  assert.equal(buf.has(e), false);
});

// --- loop ---

test('gate accepts only strictly-improving candidates', () => {
  assert.equal(gate(0.5, 0.6, 0.55).action, 'accept_new_best'); // beats best
  assert.equal(gate(0.5, 0.55, 0.7).action, 'accept'); // improves current, below best
  assert.equal(gate(0.5, 0.5, 0.7).action, 'reject'); // no strict improvement
});

test('noHeldOutRegression rejects any held-out score drop', () => {
  assert.equal(noHeldOutRegression({ a: 1, b: 1 }, { a: 1, b: 1 }, ['a', 'b']), true);
  assert.equal(noHeldOutRegression({ a: 1, b: 1 }, { a: 1, b: 0 }, ['a', 'b']), false);
});

test('selectEdits respects budget, drops buffered, prioritizes failures', () => {
  const buf = new RejectedEditBuffer();
  buf.add({ op: 'append', content: 'old' });
  const edits: Edit[] = [
    { op: 'append', content: 'old' }, // buffered → dropped
    { op: 'append', content: 'success', sourceType: 'success', supportCount: 5 },
    { op: 'append', content: 'failure', sourceType: 'failure', supportCount: 1 },
  ];
  const selected = selectEdits(edits, 1, buf);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].content, 'failure'); // failure-driven beats success-driven
});
