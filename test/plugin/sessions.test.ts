import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let sessions: typeof import('../../src/plugin/sessions.js');

const NOW = '2026-06-26T00:00:00.000Z';

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  sessions = await import('../../src/plugin/sessions.js');
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
});

test('countToolUses counts tool_use blocks and ignores tool_use_id', () => {
  const dir = makeTmpDir('tx');
  try {
    const p = path.join(dir, 'transcript.jsonl');
    fs.writeFileSync(
      p,
      [
        '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash"}]}}',
        '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"abc"}]}}',
        '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read"}]}}',
      ].join('\n'),
    );
    assert.equal(sessions.countToolUses(p), 2);
    assert.equal(sessions.countToolUses('/no/such/transcript'), 0);
  } finally {
    cleanTmpDir(dir);
  }
});

test('shouldReflect gates on new tool calls since the last reflection', () => {
  assert.equal(sessions.shouldReflect('s1', 4, 4), true);
  assert.equal(sessions.shouldReflect('s1', 3, 4), false);
  sessions.markReflected('s1', 4, NOW);
  assert.equal(sessions.shouldReflect('s1', 7, 4), false); // only 3 new since reflection
  assert.equal(sessions.shouldReflect('s1', 8, 4), true); // 4 new
});

test('sessions are independent', () => {
  sessions.markReflected('a', 10, NOW);
  assert.equal(sessions.shouldReflect('b', 4, 4), true);
});
