import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isValidChannel, channelRank, nextChannel, CHANNELS } from '../../src/workspace/channels.js';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

test('channel helpers', () => {
  assert.deepEqual(CHANNELS, ['dev', 'beta', 'stable']);
  assert.equal(isValidChannel('beta'), true);
  assert.equal(isValidChannel('prod'), false);
  assert.ok(channelRank('dev') < channelRank('stable'));
  assert.equal(nextChannel('dev'), 'beta');
  assert.equal(nextChannel('stable'), null);
});

const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let lock: typeof import('../../src/lock/global.js');

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  lock = await import('../../src/lock/global.js');
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
});

test('global lock writes skill keys sorted (merge-friendly, review C5)', () => {
  lock.addGlobalLockEntry('zebra', { source: 's', sourceType: 'github', agents: ['claude'] });
  lock.addGlobalLockEntry('alpha', { source: 's', sourceType: 'github', agents: ['claude'] });
  lock.addGlobalLockEntry('mango', { source: 's', sourceType: 'github', agents: ['claude'] });
  const written = lock.readGlobalLock();
  assert.deepEqual(Object.keys(written.skills), ['alpha', 'mango', 'zebra']);
});
