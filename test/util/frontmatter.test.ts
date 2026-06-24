import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  serializeFrontmatter,
  parseFrontmatter,
  writeSkillFile,
} from '../../src/util/frontmatter.js';
import { withTmpDir } from '../helpers/tmp.js';
import type { SkillMeta } from '../../src/types.js';

test('serialize → parse round-trips frontmatter', () => {
  const meta: SkillMeta = {
    name: 'round-trip',
    description: 'A round-tripping skill.',
    version: '1.0.0',
    tools: ['Bash', 'Read'],
    triggers: ['when X happens'],
  };
  const text = serializeFrontmatter(meta, '# Body\n');
  const parsed = parseFrontmatter(text)!;
  assert.equal(parsed.meta.name, 'round-trip');
  assert.equal(parsed.meta.description, 'A round-tripping skill.');
  assert.deepEqual(parsed.meta.tools, ['Bash', 'Read']);
  assert.deepEqual(parsed.meta.triggers, ['when X happens']);
  assert.equal(parsed.content.trim(), '# Body');
});

test('terminal escapes are stripped on serialize', () => {
  const meta: SkillMeta = {
    name: 'esc',
    description: 'red \x1b[31mtext\x1b[0m here',
  };
  const text = serializeFrontmatter(meta);
  assert.ok(!text.includes('\x1b'), 'escape bytes must not survive serialization');
  const parsed = parseFrontmatter(text)!;
  assert.equal(parsed.meta.description, 'red text here');
});

test('executable-looking content serializes as plain data, never a tag', () => {
  const meta: SkillMeta = {
    name: 'safe',
    description: '!!js/function function(){return 1}',
  };
  const text = serializeFrontmatter(meta);
  // The value must be quoted/escaped as a scalar string, not emitted as a YAML tag.
  const parsed = parseFrontmatter(text)!;
  assert.equal(typeof parsed.meta.description, 'string');
  assert.equal(parsed.meta.description, '!!js/function function(){return 1}');
});

test('function values are coerced to strings, not executed/serialized as code', () => {
  const meta = {
    name: 'fn',
    description: 'has a function field',
    // simulate a polluted object
    evil: (() => 'boom') as unknown,
  } as unknown as SkillMeta;
  const text = serializeFrontmatter(meta);
  const parsed = parseFrontmatter(text)!;
  assert.equal(typeof parsed.meta.evil, 'string');
});

test('writeSkillFile produces a parseable file', () => {
  withTmpDir((dir) => {
    const p = path.join(dir, 'SKILL.md');
    writeSkillFile(p, { name: 'written', description: 'Written skill.' }, '# Hi\n');
    const parsed = parseFrontmatter(fs.readFileSync(p, 'utf-8'))!;
    assert.equal(parsed.meta.name, 'written');
  });
});
