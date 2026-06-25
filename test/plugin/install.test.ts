import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeTmpDir, cleanTmpDir } from '../helpers/tmp.js';

const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
let tmpHome: string;
let plugin: typeof import('../../src/commands/plugin.js');
let reflect: typeof import('../../src/plugin/reflect.js');

before(async () => {
  tmpHome = makeTmpDir('home');
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  plugin = await import('../../src/commands/plugin.js');
  reflect = await import('../../src/plugin/reflect.js');
});

after(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  cleanTmpDir(tmpHome);
});

const settingsPath = () => path.join(tmpHome, '.claude', 'settings.json');
const readSettings = () => JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'));
function ownsHook(groups: any[]): boolean {
  return (groups ?? []).some((g: any) =>
    (g.hooks ?? []).some((h: any) => typeof h.command === 'string' && h.command.includes('skillmaxxing plugin')),
  );
}

beforeEach(() => {
  try {
    fs.rmSync(path.join(tmpHome, '.claude'), { recursive: true });
  } catch {
    /* ignore */
  }
});

test('install (auto) wires SessionStart, PostToolUse, and Stop hooks', async () => {
  await plugin.plugin({ action: 'install', agent: 'claude', mode: 'auto', threshold: 10 });
  const s = readSettings();
  assert.ok(ownsHook(s.hooks.SessionStart), 'SessionStart owned');
  assert.ok(ownsHook(s.hooks.PostToolUse), 'PostToolUse owned');
  assert.ok(ownsHook(s.hooks.Stop), 'Stop owned');
  const stopCmd = s.hooks.Stop.flatMap((g: any) => g.hooks).find((h: any) => h.command.includes('on-stop')).command;
  assert.match(stopCmd, /--threshold 10/);
});

test('install (nudge) wires SessionStart only, not the background loop', async () => {
  await plugin.plugin({ action: 'install', agent: 'claude', mode: 'nudge' });
  const s = readSettings();
  assert.ok(ownsHook(s.hooks.SessionStart));
  assert.ok(!ownsHook(s.hooks.PostToolUse ?? []));
  assert.ok(!ownsHook(s.hooks.Stop ?? []));
});

test('install preserves unrelated hooks; uninstall removes only ours', async () => {
  fs.mkdirSync(path.join(tmpHome, '.claude'), { recursive: true });
  fs.writeFileSync(
    settingsPath(),
    JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo custom' }] }] } }),
  );

  await plugin.plugin({ action: 'install', agent: 'claude', mode: 'auto' });
  let s = readSettings();
  const hasCustom = () =>
    s.hooks.SessionStart.some((g: any) => g.hooks.some((h: any) => h.command === 'echo custom'));
  assert.ok(hasCustom(), 'custom hook preserved after install');
  assert.ok(ownsHook(s.hooks.SessionStart), 'ours added alongside');

  await plugin.plugin({ action: 'uninstall', agent: 'claude' });
  s = readSettings();
  assert.ok(hasCustom(), 'custom hook still present after uninstall');
  assert.ok(!ownsHook(s.hooks.SessionStart ?? []), 'ours removed');
});

test('reinstall is idempotent (no duplicate hook groups)', async () => {
  await plugin.plugin({ action: 'install', agent: 'claude', mode: 'auto' });
  await plugin.plugin({ action: 'install', agent: 'claude', mode: 'auto' });
  const s = readSettings();
  const ourSessionGroups = s.hooks.SessionStart.filter((g: any) =>
    g.hooks.some((h: any) => h.command.includes('skillmaxxing plugin')),
  );
  assert.equal(ourSessionGroups.length, 1);
});

test('reflect prompt names the transcript and recursion guard reads env', () => {
  const prompt = reflect.buildReflectionPrompt('/tmp/session.jsonl');
  assert.match(prompt, /\/tmp\/session\.jsonl/);
  assert.match(prompt, /skillmaxxing/);
  assert.equal(reflect.isReflecting(), false);
  process.env[reflect.REFLECT_ENV] = '1';
  assert.equal(reflect.isReflecting(), true);
  delete process.env[reflect.REFLECT_ENV];
});
