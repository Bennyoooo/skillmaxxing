import { parse as parseYaml } from 'yaml';
import { stripTerminalEscapes } from './sanitize.js';
import type { SkillMeta } from '../types.js';

interface ParseResult {
  meta: SkillMeta;
  content: string;
}

export function parseFrontmatter(raw: string): ParseResult | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  let data: Record<string, unknown>;
  try {
    data = parseYaml(match[1]);
  } catch {
    return null;
  }

  if (!data || typeof data !== 'object') return null;

  const name = data.name;
  const description = data.description;
  if (typeof name !== 'string' || typeof description !== 'string') return null;

  const meta: SkillMeta = {
    ...data,
    name: stripTerminalEscapes(name),
    description: stripTerminalEscapes(description),
  };

  return { meta, content: match[2] };
}

export function readSkillMeta(skillMdContent: string): SkillMeta | null {
  const result = parseFrontmatter(skillMdContent);
  return result?.meta ?? null;
}
