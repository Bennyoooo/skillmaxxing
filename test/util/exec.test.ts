import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

// Trust lookups hit ~/.skillmax/state — redirect HOME before importing.
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
const origToken = process.env.GITHUB_TOKEN;
let tmpHome: string;
let exec: typeof import('../../src/util/exec.js');
let store: typeof import('../../src/state/store.js');
let trust: typeof import('../../src/state/trust.js');

const NOW = '2026-06-08T00:00:00.000Z';

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  process.env.GITHUB_TOKEN = 'super-secret-token';
  exec = await import('../../src/util/exec.js');
  store = await import('../../src/state/store.js');
  trust = await import('../../src/state/trust.js');
  // a trusted skill for the happy paths
  store.ensureState({ name: 'trusted-skill', origin: 'created' }, NOW);
  trust.grantTrust('trusted-skill', NOW);
  // an untrusted skill
  store.ensureState({ name: 'untrusted-skill', origin: 'discovered' }, NOW);
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  if (origToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = origToken;
  cleanTmpDir(tmpHome);
});

test('runs a trusted skill and captures stdout', async () => {
  const dir = makeTmpDir('exec');
  try {
    const res = await exec.runSandboxed('node', ['-e', "process.stdout.write('hi')"], {
      cwd: dir,
      skillId: 'trusted-skill',
    });
    assert.equal(res.ok, true);
    assert.equal(res.stdout, 'hi');
  } finally {
    cleanTmpDir(dir);
  }
});

test('refuses to execute an untrusted skill without allowExec', async () => {
  const dir = makeTmpDir('exec');
  try {
    await assert.rejects(
      () =>
        exec.runSandboxed('node', ['-e', 'process.exit(0)'], {
          cwd: dir,
          skillId: 'untrusted-skill',
        }),
      exec.SandboxRefusedError,
    );
    // allowExec overrides
    const res = await exec.runSandboxed('node', ['-e', 'process.exit(0)'], {
      cwd: dir,
      skillId: 'untrusted-skill',
      allowExec: true,
    });
    assert.equal(res.ok, true);
  } finally {
    cleanTmpDir(dir);
  }
});

test('kills a child that exceeds the timeout', async () => {
  const dir = makeTmpDir('exec');
  try {
    const res = await exec.runSandboxed(
      'node',
      ['-e', 'setTimeout(() => {}, 10000)'],
      { cwd: dir, skillId: 'trusted-skill', timeoutMs: 200 },
    );
    assert.equal(res.timedOut, true);
    assert.equal(res.ok, false);
  } finally {
    cleanTmpDir(dir);
  }
});

test('truncates output beyond the cap', async () => {
  const dir = makeTmpDir('exec');
  try {
    const res = await exec.runSandboxed(
      'node',
      ['-e', "process.stdout.write('x'.repeat(100000))"],
      { cwd: dir, skillId: 'trusted-skill', maxOutputBytes: 1024 },
    );
    assert.equal(res.truncated, true);
  } finally {
    cleanTmpDir(dir);
  }
});

test('credential env vars are scrubbed (review S8)', async () => {
  const dir = makeTmpDir('exec');
  try {
    const res = await exec.runSandboxed(
      'node',
      ['-e', "process.stdout.write(process.env.GITHUB_TOKEN || 'EMPTY')"],
      { cwd: dir, skillId: 'trusted-skill' },
    );
    assert.equal(res.stdout, 'EMPTY');
  } finally {
    cleanTmpDir(dir);
  }
});

test('honors the working directory (relative writes land in cwd)', async () => {
  const dir = makeTmpDir('exec');
  try {
    const res = await exec.runSandboxed(
      'node',
      ['-e', "require('fs').writeFileSync('out.txt', 'ok')"],
      { cwd: dir, skillId: 'trusted-skill' },
    );
    assert.equal(res.ok, true);
    assert.equal(fs.readFileSync(path.join(dir, 'out.txt'), 'utf-8'), 'ok');
  } finally {
    cleanTmpDir(dir);
  }
});
