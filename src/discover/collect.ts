import type { DiscoveryCandidate } from './types.js';
import { loadCuratedIndex } from './index.js';
import { scanLocalSkills } from './local.js';
import { discoverFromRepo } from './github.js';

export interface CollectOptions {
  /** Include the curated index (default true). */
  index?: boolean;
  /** Include locally-installed skills (default true). */
  local?: boolean;
  /** Explicit repo/path sources to clone-and-scan. */
  repos?: string[];
  indexPath?: string;
  projectDir?: string;
}

export interface SourceError {
  source: string;
  message: string;
}

export interface CollectResult {
  candidates: DiscoveryCandidate[];
  errors: SourceError[];
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Gather candidates from all enabled sources with per-source isolation: a
 * failure in one source (bad repo, rate limit, unreadable index) yields partial
 * results plus a recorded error, never a total abort (review I7).
 */
export async function collectSources(opts: CollectOptions = {}): Promise<CollectResult> {
  const candidates: DiscoveryCandidate[] = [];
  const errors: SourceError[] = [];

  if (opts.index !== false) {
    try {
      candidates.push(...loadCuratedIndex(opts.indexPath));
    } catch (e) {
      errors.push({ source: 'index', message: msg(e) });
    }
  }

  if (opts.local !== false) {
    try {
      candidates.push(...scanLocalSkills(opts.projectDir));
    } catch (e) {
      errors.push({ source: 'local', message: msg(e) });
    }
  }

  for (const repo of opts.repos ?? []) {
    try {
      candidates.push(...(await discoverFromRepo(repo)));
    } catch (e) {
      errors.push({ source: repo, message: msg(e) });
    }
  }

  return { candidates, errors };
}
