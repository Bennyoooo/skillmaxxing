export type DiscoverySource = 'index' | 'github' | 'local';

/** A normalized skill candidate from any discovery source. */
export interface DiscoveryCandidate {
  name: string;
  description: string;
  /** Installable source string (owner/repo, path); empty for local-only skills. */
  source: string;
  origin: DiscoverySource;
  tags: string[];
  /** Pinned commit when resolved from a repo (used for re-resolve-free install). */
  commitSha?: string;
  installed: boolean;
}
