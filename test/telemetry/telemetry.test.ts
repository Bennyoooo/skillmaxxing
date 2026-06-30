import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

const saved = {
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
  CI: process.env.CI,
  DO_NOT_TRACK: process.env.DO_NOT_TRACK,
  SKILLMAX_TELEMETRY: process.env.SKILLMAX_TELEMETRY,
  SKILLMAX_POSTHOG_KEY: process.env.SKILLMAX_POSTHOG_KEY,
  SKILLMAX_REFLECT: process.env.SKILLMAX_REFLECT,
};

let tmpHome: string;
let tele: typeof import('../../src/telemetry/index.js');
let cmd: typeof import('../../src/commands/telemetry.js');

before(async () => {
  tele = await import('../../src/telemetry/index.js');
  cmd = await import('../../src/commands/telemetry.js');
});

beforeEach(() => {
  // Fresh HOME + clean env each test so config + suppression are deterministic.
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  delete process.env.CI;
  delete process.env.DO_NOT_TRACK;
  delete process.env.SKILLMAX_TELEMETRY;
  delete process.env.SKILLMAX_REFLECT;
  process.env.SKILLMAX_POSTHOG_KEY = ''; // no backend -> capture is a no-op
  tele.resetCacheForTests();
});

after(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else process.env[k] = v;
  }
  cleanTmpDir(tmpHome);
});

test('newConfig is anonymous, disabled, unprompted; save/load round-trips', () => {
  const c = tele.newConfig(new Date().toISOString());
  assert.match(c.anonId, /[0-9a-f-]{36}/);
  assert.equal(c.enabled, false);
  assert.equal(c.prompted, false);

  tele.saveConfig(c);
  const back = tele.loadConfig();
  assert.deepEqual(back, c);
  assert.ok(fs.existsSync(path.join(tmpHome, '.skillmax', 'telemetry.json')));
});

test('telemetry on/off persists the decision', () => {
  cmd.telemetry({ action: 'on' });
  assert.equal(tele.loadConfig()!.enabled, true);
  assert.equal(tele.loadConfig()!.prompted, true);

  cmd.telemetry({ action: 'off' });
  assert.equal(tele.loadConfig()!.enabled, false);
  assert.equal(tele.loadConfig()!.prompted, true);
});

test('isEnabled requires consent AND a configured backend', () => {
  cmd.telemetry({ action: 'on' });
  tele.resetCacheForTests();
  // enabled in config, but no key shipped -> still off.
  assert.equal(tele.isEnabled(), false);

  process.env.SKILLMAX_POSTHOG_KEY = 'phc_testkey';
  assert.equal(tele.isEnabled(), true);
});

test('suppressed honors CI, DO_NOT_TRACK, and SKILLMAX_TELEMETRY=off', () => {
  process.env.SKILLMAX_POSTHOG_KEY = 'phc_testkey';
  cmd.telemetry({ action: 'on' });
  tele.resetCacheForTests();
  assert.equal(tele.isEnabled(), true);

  process.env.DO_NOT_TRACK = '1';
  assert.equal(tele.suppressed(), true);
  assert.equal(tele.isEnabled(), false);
  delete process.env.DO_NOT_TRACK;

  process.env.CI = 'true';
  assert.equal(tele.suppressed(), true);
  delete process.env.CI;

  process.env.SKILLMAX_TELEMETRY = 'off';
  assert.equal(tele.suppressed(), true);
});

test('init first-run (non-interactive) defaults to enabled and prompts once', async () => {
  // stdin is not a TTY under the test runner -> non-interactive default-yes path.
  await tele.init('9.9.9');
  const c = tele.loadConfig()!;
  assert.equal(c.prompted, true);
  assert.equal(c.enabled, true); // default yes
  assert.equal(c.lastActive, new Date().toISOString().slice(0, 10));
});

test('init is fully dark under suppression (no config written)', async () => {
  process.env.DO_NOT_TRACK = '1';
  await tele.init('9.9.9');
  assert.equal(tele.loadConfig(), null);
  assert.equal(fs.existsSync(path.join(tmpHome, '.skillmax', 'telemetry.json')), false);
});

test('init does not prompt or enable inside the reflector', async () => {
  process.env.SKILLMAX_REFLECT = '1';
  await tele.init('9.9.9');
  // A fresh unprompted config is created but left disabled until a real session.
  const c = tele.loadConfig();
  assert.ok(c);
  assert.equal(c!.prompted, false);
  assert.equal(c!.enabled, false);
});
