import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { discover } from '../../src/commands/discover.js';

afterEach(() => {
  process.exitCode = 0;
});

test('discover sets a non-zero exit code when nothing matches (review I2)', async () => {
  // A query no installed/local/index skill could match → empty results.
  await discover({ query: 'qwxzptlk zvbnmqq', scope: 'project' });
  assert.equal(process.exitCode, 1);
});

test('discover --install of a name not in results errors, not throws', async () => {
  await discover({
    query: 'qwxzptlk zvbnmqq',
    install: 'not-there',
    scope: 'project',
  });
  assert.equal(process.exitCode, 1);
});
