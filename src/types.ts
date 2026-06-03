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

export interface InstallOptions {
  source: string;
  agents?: string[];
  scope: Scope;
  copy?: boolean;
  skipPrompts?: boolean;
}
