import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DiscoveryCandidate } from './types.js';

export interface CuratedIndexEntry {
  name: string;
  description?: string;
  source: string;
  tags?: string[];
  license?: string;
}

export interface CuratedIndex {
  version: number;
  skills: CuratedIndexEntry[];
}

/** Path to the shipped curated index (index/index.json at the package root). */
export function defaultIndexPath(): string {
  return fileURLToPath(new URL('../../index/index.json', import.meta.url));
}

/**
 * Load the curated index into candidates. Returns [] on a missing/corrupt/empty
 * index so discovery degrades gracefully to other sources (review: empty index
 * must not break discovery).
 */
export function loadCuratedIndex(indexPath = defaultIndexPath()): DiscoveryCandidate[] {
  let raw: string;
  try {
    raw = fs.readFileSync(indexPath, 'utf-8');
  } catch {
    return [];
  }
  let data: CuratedIndex;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!data || !Array.isArray(data.skills)) return [];
  return data.skills
    .filter((e) => e && typeof e.name === 'string' && typeof e.source === 'string')
    .map((e) => ({
      name: e.name,
      description: e.description ?? '',
      source: e.source,
      origin: 'index' as const,
      tags: Array.isArray(e.tags) ? e.tags : [],
      installed: false,
    }));
}
