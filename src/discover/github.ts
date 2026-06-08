import { parseSource } from '../source/parser.js';
import { resolveSource, cleanupResolved } from '../source/resolver.js';
import type { DiscoveryCandidate } from './types.js';

/**
 * Clone-and-scan a repo (or local path) source into discovery candidates.
 *
 * This is the always-works baseline (KTD10): it reuses the hardened
 * parseSource/resolveSource path (depth-1 clone, one-level scan, entry-name
 * validation). An optional GitHub Trees/Search API fast path (when GITHUB_TOKEN
 * is set) is deferred per the plan; clone-scan needs no token. The pinned
 * commitSha is carried so a later install can avoid re-resolving (review F1/F2).
 */
export async function discoverFromRepo(source: string): Promise<DiscoveryCandidate[]> {
  const parsed = parseSource(source);
  const resolved = await resolveSource(parsed);
  const origin = parsed.type === 'local' ? 'local' : 'github';
  const candidates: DiscoveryCandidate[] = resolved.map((s) => ({
    name: s.name,
    description: s.meta.description,
    source,
    origin,
    tags: Array.isArray(s.meta.tags) ? (s.meta.tags as string[]) : [],
    commitSha: s.commitSha,
    installed: false,
  }));
  cleanupResolved(resolved);
  return candidates;
}
