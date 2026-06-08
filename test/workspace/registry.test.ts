import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';
import { writeSkill } from '../helpers/fixtures.js';

const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let reg: typeof import('../../src/workspace/registry.js');
let store: typeof import('../../src/state/store.js');

const NOW = '2026-06-08T00:00:00.000Z';

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  reg = await import('../../src/workspace/registry.js');
  store = await import('../../src/state/store.js');
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
});

test('publish writes skill files + index entry; list filters by channel', () => {
  const work = makeTmpDir('ws');
  try {
    const src = makeTmpDir('src');
    const skillDir = writeSkill(src, { name: 'team-skill', description: 'A team skill.' });
    const registry = path.join(work, 'registry');

    reg.publish(skillDir, registry, { channel: 'dev', publishedBy: 'alice', at: NOW });
    assert.ok(fs.existsSync(path.join(registry, 'skills', 'dev', 'team-skill', 'SKILL.md')));

    const all = reg.listRegistry(registry);
    assert.equal(all.length, 1);
    assert.equal(all[0].publishedBy, 'alice');
    assert.equal(reg.listRegistry(registry, 'stable').length, 0);
    cleanTmpDir(src);
  } finally {
    cleanTmpDir(work);
  }
});

test('sync materializes registry skills and records workspace state', () => {
  const work = makeTmpDir('ws');
  try {
    const src = makeTmpDir('src');
    const registry = path.join(work, 'registry');
    reg.publish(writeSkill(src, { name: 'synced-only' }), registry, { channel: 'dev', publishedBy: 'bob', at: NOW });

    const synced = reg.sync(registry, { registryId: 'team', at: NOW });
    assert.equal(synced.length, 1);
    assert.equal(synced[0].collided, false);
    assert.ok(fs.existsSync(path.join(synced[0].dir, 'SKILL.md')));
    const st = store.loadState('synced-only')!;
    assert.equal(st.origin, 'workspace');
    assert.equal(st.trusted, false);
    assert.equal(st.channel, 'dev');
    cleanTmpDir(src);
  } finally {
    cleanTmpDir(work);
  }
});

test('sync of a name colliding with a local skill namespaces it (review AE2)', () => {
  const work = makeTmpDir('ws');
  try {
    const src = makeTmpDir('src');
    const registry = path.join(work, 'registry');
    // a pre-existing LOCAL skill of the same name (origin: created), trusted
    store.ensureState({ name: 'shared-name', origin: 'created' }, NOW);
    store.ensureState({ name: 'shared-name', origin: 'created' }, NOW); // idempotent
    const before = store.loadState('shared-name')!;

    reg.publish(writeSkill(src, { name: 'shared-name' }), registry, { channel: 'dev', publishedBy: 'c', at: NOW });
    const synced = reg.sync(registry, { registryId: 'team-acme', at: NOW });

    assert.equal(synced[0].collided, true);
    assert.notEqual(synced[0].id, 'shared-name'); // namespaced
    // local state untouched
    const after = store.loadState('shared-name')!;
    assert.equal(after.origin, before.origin);
    // namespaced state exists separately
    assert.ok(store.loadState(synced[0].id));
    cleanTmpDir(src);
  } finally {
    cleanTmpDir(work);
  }
});
