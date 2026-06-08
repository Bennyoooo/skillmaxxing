export interface AgentAdapter {
  name: string;
  displayName: string;
  cliCommand: string;
  globalSkillsDir: string;
  projectSkillsDir: string;
  detectInstalled: () => Promise<boolean>;
}

export interface ParsedSource {
  type: 'github' | 'git' | 'local';
  owner?: string;
  repo?: string;
  subpath?: string;
  ref?: string;
  url?: string;
  localPath?: string;
  raw: string;
}

export interface SkillMeta {
  name: string;
  description: string;
  version?: string;
  tools?: string[];
  triggers?: string[];
  mutating?: boolean;
  [key: string]: unknown;
}

export interface InstalledSkill {
  name: string;
  meta: SkillMeta;
  path: string;
  agent: string;
  scope: 'global' | 'project';
  source?: string;
  isSymlink: boolean;
}

export interface GlobalLockEntry {
  source: string;
  sourceType: string;
  ref?: string;
  commitSha?: string;
  installedAt: string;
  updatedAt: string;
  agents: string[];
}

export interface GlobalLockFile {
  version: 1;
  skills: Record<string, GlobalLockEntry>;
}

export interface ProjectLockEntry {
  source: string;
  sourceType: string;
  ref?: string;
  computedHash: string;
}

export interface ProjectLockFile {
  version: 1;
  skills: Record<string, ProjectLockEntry>;
}

export type Scope = 'global' | 'project';

/** How a skill entered the system. Drives trust and curation policy. */
export type SkillOrigin =
  | 'installed'
  | 'discovered'
  | 'created'
  | 'optimized'
  | 'workspace';

/** Lifecycle state of a skill as it moves through create/optimize/workspace. */
export type SkillLifecycle =
  | 'draft'
  | 'staged'
  | 'committed'
  | 'live'
  | 'candidate'
  | 'reverted'
  | 'published'
  | 'stable';

/** Release channel for workspace-shared skills (Phase 2). */
export type Channel = 'dev' | 'beta' | 'stable';

/** One scored version, recorded by the optimize loop. */
export interface ScoreEntry {
  version: string;
  score: number;
  at: string;
}

/**
 * Per-skill state, stored in a sidecar OUTSIDE the content-hashed skill dir so
 * `computeSkillHash` never churns. Keyed by an origin-namespaced identity (see
 * `state/store.ts` stateKey) so two same-named skills from different origins do
 * not share one record.
 */
export interface SkillState {
  /** Skill name (matches SKILL.md frontmatter `name`). */
  name: string;
  /** Origin-namespaced identity used as the sidecar filename key. */
  id: string;
  origin: SkillOrigin;
  /** Untrusted by default; trust is granted only by explicit user action. */
  trusted: boolean;
  version: string;
  lifecycle: SkillLifecycle;
  /** Append-only, trimmed to the most recent entries (see MAX_SCORE_HISTORY). */
  scoreHistory: ScoreEntry[];
  /** Optional provenance detail (source string, registry origin, channel). */
  source?: string;
  channel?: Channel;
  createdAt: string;
  updatedAt: string;
}

export interface InstallOptions {
  source: string;
  agents?: string[];
  scope: Scope;
  copy?: boolean;
  skipPrompts?: boolean;
}
