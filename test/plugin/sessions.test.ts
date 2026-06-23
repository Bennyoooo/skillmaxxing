import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let sessions: typeof import('../../src/plugin/sessions.js');

const NOW = '2026-06-23T00:00:00.000Z';

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

test('recordToolUse increments and shouldReflect gates on threshold', () => {
  sessions.recordToolUse('s1');
  sessions.recordToolUse('s1');
  sessions.recordToolUse('s1');
  assert.equal(sessions.shouldReflect('s1', 3), true);
  assert.equal(sessions.shouldReflect('s1', 4), false);
});

test('markReflected resets the work-since-reflect window', () => {
  sessions.recordToolUse('s2');
  sessions.recordToolUse('s2');
  sessions.markReflected('s2', NOW);
  assert.equal(sessions.toolsSinceReflect('s2'), 0);
  assert.equal(sessions.shouldReflect('s2', 1), false);
  sessions.recordToolUse('s2');
  assert.equal(sessions.shouldReflect('s2', 1), true); // counts only post-reflection work
});

test('sessions are independent', () => {
  sessions.recordToolUse('a');
  assert.equal(sessions.shouldReflect('b', 1), false);
});
