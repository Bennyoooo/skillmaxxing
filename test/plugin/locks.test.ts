import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let locks: typeof import('../../src/plugin/locks.js');

const lockPath = () => path.join(tmpHome, '.skillmax', 'reflector.lock');

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  locks = await import('../../src/plugin/locks.js');
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
});

test('single-flight: held lock blocks a second acquire; release frees it', () => {
  assert.equal(locks.acquireReflectorLock(), true);
  assert.equal(locks.acquireReflectorLock(), false); // live + fresh holder
  locks.releaseReflectorLock();
  assert.equal(locks.acquireReflectorLock(), true);
  locks.releaseReflectorLock();
});

test('a stale lock (older than LOCK_STALE_MS) is stolen', () => {
  fs.mkdirSync(path.dirname(lockPath()), { recursive: true });
  fs.writeFileSync(lockPath(), JSON.stringify({ pid: process.pid, at: Date.now() - 10 * 60 * 1000 }));
  assert.equal(locks.acquireReflectorLock(), true);
  locks.releaseReflectorLock();
});

test('a dead-pid lock is stolen', () => {
  fs.writeFileSync(lockPath(), JSON.stringify({ pid: 2147483646, at: Date.now() }));
  assert.equal(locks.acquireReflectorLock(), true);
  locks.releaseReflectorLock();
});

test('release only removes a lock this process owns', () => {
  fs.writeFileSync(lockPath(), JSON.stringify({ pid: 2147483646, at: Date.now() }));
  locks.releaseReflectorLock(); // not ours -> must NOT remove
  assert.ok(fs.existsSync(lockPath()));
  fs.rmSync(lockPath());
});
