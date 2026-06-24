import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ensureValidName,
  checkWrite,
  collidesWith,
  namespacedName,
} from '../../src/util/collision.js';
import { withTmpDir } from '../helpers/tmp.js';

test('ensureValidName accepts valid and rejects invalid names', () => {
  assert.equal(ensureValidName('good-name').ok, true);
  assert.equal(ensureValidName('Bad Name').ok, false);
  assert.equal(ensureValidName('-leading').ok, false);
});

test('checkWrite refuses overwrite of an existing dir unless force', () => {
  withTmpDir((dir) => {
    const dest = path.join(dir, 'existing');
    fs.mkdirSync(dest);
    assert.equal(checkWrite(dest, 'existing').ok, false);
    assert.equal(checkWrite(dest, 'existing', { force: true }).ok, true);
    assert.equal(checkWrite(path.join(dir, 'fresh'), 'fresh').ok, true);
  });
});

test('checkWrite refuses an invalid name regardless of destination', () => {
  withTmpDir((dir) => {
    assert.equal(checkWrite(path.join(dir, 'x'), 'Bad Name').ok, false);
  });
});

test('collidesWith is case-insensitive', () => {
  assert.equal(collidesWith('code-review', ['Code-Review']), 'Code-Review');
  assert.equal(collidesWith('code-review', ['other-skill']), null);
});

test('namespacedName yields a valid, sanitized skill name', () => {
  const n = namespacedName('team-acme', 'code-review');
  assert.equal(n, 'team-acme-code-review');
  assert.equal(ensureValidName(n).ok, true);
});
