import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParsedSource, SkillMeta } from '../types.js';
import { gitClone, gitGetHeadSha, makeTempDir, cleanTempDir } from '../util/git.js';
import { readSkillMeta } from '../util/frontmatter.js';

export interface ResolvedSkill {
  name: string;
  meta: SkillMeta;
  dir: string;
  commitSha?: string;
  isTemp: boolean;
}

/**
 * Defense-in-depth guard for directory entries read from untrusted cloned repos
 * (review S5): reject names that are path-traversal or separator-bearing before
 * joining them into a filesystem path. readdir normally returns plain segments,
 * but a maliciously crafted archive should never escape the scan root.
 */
export function isSafeEntryName(name: string): boolean {
  return (
    name !== '' &&
    name !== '.' &&
    name !== '..' &&
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('\0')
  );
}

export async function resolveSource(source: ParsedSource): Promise<ResolvedSkill[]> {
  if (source.type === 'local') {
    return resolveLocal(source.localPath!);
  }
  return resolveRemote(source);
}

function resolveLocal(localPath: string): ResolvedSkill[] {
  const resolved = path.resolve(localPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Local path does not exist: ${resolved}`);
  }

  const skillMd = path.join(resolved, 'SKILL.md');
  if (fs.existsSync(skillMd)) {
    const content = fs.readFileSync(skillMd, 'utf-8');
    const meta = readSkillMeta(content);
    if (!meta) throw new Error(`Invalid SKILL.md frontmatter at ${skillMd}`);
    return [{ name: meta.name, meta, dir: resolved, isTemp: false }];
  }

  const skills: ResolvedSkill[] = [];
  for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!isSafeEntryName(entry.name)) continue;
    const sub = path.join(resolved, entry.name, 'SKILL.md');
    if (!fs.existsSync(sub)) continue;
    const content = fs.readFileSync(sub, 'utf-8');
    const meta = readSkillMeta(content);
    if (meta) {
      skills.push({ name: meta.name, meta, dir: path.join(resolved, entry.name), isTemp: false });
    }
  }

  if (skills.length === 0) {
    throw new Error(`No SKILL.md found in ${resolved} or its subdirectories`);
  }
  return skills;
}

async function resolveRemote(source: ParsedSource): Promise<ResolvedSkill[]> {
  const tmpDir = makeTempDir('clone');
  try {
    await gitClone(source.url!, tmpDir, source.ref);
    const sha = await gitGetHeadSha(tmpDir);

    let searchDir = tmpDir;
    if (source.subpath) {
      searchDir = path.join(tmpDir, source.subpath);
      if (!fs.existsSync(searchDir)) {
        throw new Error(`Subpath '${source.subpath}' not found in ${source.url}`);
      }
    }

    const skillMd = path.join(searchDir, 'SKILL.md');
    if (fs.existsSync(skillMd)) {
      const content = fs.readFileSync(skillMd, 'utf-8');
      const meta = readSkillMeta(content);
      if (!meta) throw new Error(`Invalid SKILL.md frontmatter in ${source.url}`);
      return [{ name: meta.name, meta, dir: searchDir, commitSha: sha, isTemp: true }];
    }

    const skills: ResolvedSkill[] = [];
    for (const entry of fs.readdirSync(searchDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (!isSafeEntryName(entry.name)) continue;
      const sub = path.join(searchDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(sub)) continue;
      const content = fs.readFileSync(sub, 'utf-8');
      const meta = readSkillMeta(content);
      if (meta) {
        skills.push({ name: meta.name, meta, dir: path.join(searchDir, entry.name), commitSha: sha, isTemp: true });
      }
    }

    if (skills.length === 0) {
      throw new Error(`No SKILL.md found in ${source.url}`);
    }
    return skills;
  } catch (err) {
    cleanTempDir(tmpDir);
    throw err;
  }
}

export function cleanupResolved(skills: ResolvedSkill[]): void {
  const cleaned = new Set<string>();
  for (const skill of skills) {
    if (!skill.isTemp) continue;
    let dir = skill.dir;
    while (dir.includes('skillmax-clone-')) {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    if (!cleaned.has(dir)) {
      cleaned.add(dir);
      cleanTempDir(dir);
    }
  }
}
