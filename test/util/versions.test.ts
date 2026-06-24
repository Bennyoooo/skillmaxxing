import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

// Retained versions live under ~/.skillmax/versions — redirect HOME before import.
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let versions: typeof import('../../src/util/versions.js');

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  versions = await import('../../src/util/versions.js');
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
});

test('atomicReplaceDir replaces target contents', () => {
  const base = makeTmpDir('vers');
  try {
    const target = path.join(base, 'live');
    const source = path.join(base, 'cand');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'a.txt'), 'OLD');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'b.txt'), 'NEW');
    versions.atomicReplaceDir(target, source);
    assert.ok(!fs.existsSync(path.join(target, 'a.txt')));
    assert.equal(fs.readFileSync(path.join(target, 'b.txt'), 'utf-8'), 'NEW');
  } finally {
    cleanTmpDir(base);
  }
});

test('atomicReplaceDir leaves target intact when source missing (crash-safety)', () => {
  const base = makeTmpDir('vers');
  try {
    const target = path.join(base, 'live');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'a.txt'), 'KEEP');
    assert.throws(() => versions.atomicReplaceDir(target, path.join(base, 'nope')));
    assert.equal(fs.readFileSync(path.join(target, 'a.txt'), 'utf-8'), 'KEEP');
  } finally {
    cleanTmpDir(base);
  }
});

test('promote retains prior version; revert restores it exactly', () => {
  const base = makeTmpDir('vers');
  try {
    const live = path.join(base, 'live');
    const cand = path.join(base, 'cand');
    fs.mkdirSync(live);
    fs.writeFileSync(path.join(live, 's.txt'), 'V1');
    fs.mkdirSync(cand);
    fs.writeFileSync(path.join(cand, 's.txt'), 'V2');

    versions.promote({ id: 'demo', liveDir: live, candidateDir: cand, priorVersion: '1.0.0' });
    assert.equal(fs.readFileSync(path.join(live, 's.txt'), 'utf-8'), 'V2');
    assert.deepEqual(versions.listVersions('demo'), ['1.0.0']);

    versions.revert('demo', '1.0.0', live);
    assert.equal(fs.readFileSync(path.join(live, 's.txt'), 'utf-8'), 'V1');
  } finally {
    cleanTmpDir(base);
  }
});

test('revert throws on a version that was never retained', () => {
  assert.throws(() => versions.revert('nope', '9.9.9', makeTmpDir('vers')));
});

test('pruneVersions keeps only the most recent N', () => {
  const base = makeTmpDir('vers');
  try {
    const src = path.join(base, 'src');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'x'), 'x');
    for (let i = 0; i < versions.MAX_RETAINED_VERSIONS + 3; i++) {
      versions.snapshot('pruneme', `1.0.${i}`, src);
    }
    assert.equal(versions.listVersions('pruneme').length, versions.MAX_RETAINED_VERSIONS);
  } finally {
    cleanTmpDir(base);
  }
});
