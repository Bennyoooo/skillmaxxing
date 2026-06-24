import * as fs from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
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

/**
 * Recursively neutralize untrusted values before serialization: strip terminal
 * escapes from strings and coerce functions to strings. The `yaml` package does
 * not support executable tags (`!!js/function`) the way `gray-matter` does — the
 * repo chose `yaml` deliberately to avoid eval-based RCE — but we sanitize
 * defensively so a poisoned description can never round-trip into something a
 * downstream parser treats as more than data (review S3).
 */
function sanitizeYamlValue(value: unknown): unknown {
  if (typeof value === 'string') return stripTerminalEscapes(value);
  if (typeof value === 'function') return String(value);
  if (Array.isArray(value)) return value.map(sanitizeYamlValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = sanitizeYamlValue(v);
    }
    return out;
  }
  return value;
}

/**
 * Serialize skill metadata + body back into SKILL.md text. Data-only YAML — no
 * custom tags, no executable constructs. Pairs with parseFrontmatter so
 * parse(serialize(x)) preserves the frontmatter block.
 */
export function serializeFrontmatter(meta: SkillMeta, body = ''): string {
  const clean = sanitizeYamlValue(meta) as Record<string, unknown>;
  const yaml = stringifyYaml(clean, { lineWidth: 0 }).replace(/\n$/, '');
  const trimmedBody = body.replace(/^\n+/, '');
  return `---\n${yaml}\n---\n${trimmedBody}`;
}

/** Write a SKILL.md file from metadata + body using the safe serializer. */
export function writeSkillFile(skillMdPath: string, meta: SkillMeta, body = ''): void {
  fs.writeFileSync(skillMdPath, serializeFrontmatter(meta, body));
}
