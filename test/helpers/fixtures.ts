import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureDir } from '../../src/util/fs.js';

export interface FixtureSkill {
  name: string;
  description?: string;
  body?: string;
  /** Extra scalar frontmatter fields rendered as `key: value`. */
  extraFrontmatter?: Record<string, string>;
}

/**
 * Write a minimal SKILL.md-bearing skill directory under `parent`.
 * Returns the absolute path to the created skill directory.
 */
export function writeSkill(parent: string, skill: FixtureSkill): string {
  const dir = path.join(parent, skill.name);
  ensureDir(dir);
  const fm: string[] = [
    '---',
    `name: ${skill.name}`,
    `description: ${skill.description ?? 'A test skill.'}`,
  ];
  for (const [key, value] of Object.entries(skill.extraFrontmatter ?? {})) {
    fm.push(`${key}: ${value}`);
  }
  fm.push('---', '');
  const content = fm.join('\n') + (skill.body ?? `# ${skill.name}\n`);
  fs.writeFileSync(path.join(dir, 'SKILL.md'), content);
  return dir;
}
