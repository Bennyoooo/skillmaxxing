import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';
import { writeSkill } from '../helpers/fixtures.js';
import { publish } from '../../src/workspace/registry.js';
import { poolEval, pooledScores, reviewPromote } from '../../src/workspace/collab.js';

const NOW = '2026-06-08T00:00:00.000Z';

function freshRegistry(): { registry: string; cleanup: () => void } {
  const work = makeTmpDir('ws');
  const src = makeTmpDir('src');
  const registry = path.join(work, 'registry');
  publish(writeSkill(src, { name: 'shared', description: 'shared skill' }), registry, {
    channel: 'dev',
    publishedBy: 'alice',
    at: NOW,
  });
  cleanTmpDir(src);
  return { registry, cleanup: () => cleanTmpDir(work) };
}

test('pooled eval results accumulate (merge-friendly JSONL)', () => {
  const { registry, cleanup } = freshRegistry();
  try {
    poolEval(registry, { skill: 'shared', score: 0.7, by: 'alice', at: NOW });
    poolEval(registry, { skill: 'shared', score: 0.9, by: 'bob', at: NOW });
    const scores = pooledScores(registry, 'shared');
    assert.equal(scores.length, 2);
    assert.deepEqual(scores.map((s) => s.by), ['alice', 'bob']);
  } finally {
    cleanup();
  }
});

test('promotion to stable requires review/approval (review S2/AE7)', () => {
  const { registry, cleanup } = freshRegistry();
  try {
    const denied = reviewPromote(registry, { skill: 'shared', toChannel: 'stable', approve: false, at: NOW });
    assert.equal(denied.ok, false);

    const noApprover = reviewPromote(registry, { skill: 'shared', toChannel: 'stable', approve: true, at: NOW });
    assert.equal(noApprover.ok, false);

    const ok = reviewPromote(registry, {
      skill: 'shared',
      toChannel: 'stable',
      approve: true,
      approver: 'carol',
      at: NOW,
    });
    assert.equal(ok.ok, true);
  } finally {
    cleanup();
  }
});

test('divergent versions in the target channel surface a conflict (review SG7)', () => {
  const { registry, cleanup } = freshRegistry();
  try {
    const src = makeTmpDir('src2');
    // publish a DIFFERENT version directly into stable
    publish(writeSkill(src, { name: 'shared', description: 'shared skill' }), registry, {
      channel: 'stable',
      publishedBy: 'dave',
      version: '9.9.9',
      at: NOW,
    });
    cleanTmpDir(src);
    const res = reviewPromote(registry, {
      skill: 'shared',
      toChannel: 'stable',
      approve: true,
      approver: 'carol',
      at: NOW,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.reason, /conflict/);
  } finally {
    cleanup();
  }
});
