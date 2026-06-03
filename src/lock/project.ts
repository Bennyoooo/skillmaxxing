import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { ProjectLockFile, ProjectLockEntry } from '../types.js';

const LOCK_FILENAME = 'skills-lock.json';

function empty(): ProjectLockFile {
  return { version: 1, skills: {} };
}

export function projectLockPath(projectDir: string): string {
  return path.join(projectDir, LOCK_FILENAME);
}

export function readProjectLock(projectDir: string): ProjectLockFile {
  try {
    const raw = fs.readFileSync(projectLockPath(projectDir), 'utf-8');
    const data = JSON.parse(raw);
    if (data.version !== 1) return empty();
    return data as ProjectLockFile;
  } catch {
    return empty();
  }
}

export function writeProjectLock(projectDir: string, lock: ProjectLockFile): void {
  const sorted: Record<string, ProjectLockEntry> = {};
  for (const key of Object.keys(lock.skills).sort()) {
    sorted[key] = lock.skills[key];
  }
  lock.skills = sorted;

  const tmp = projectLockPath(projectDir) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(lock, null, 2) + '\n');
  fs.renameSync(tmp, projectLockPath(projectDir));
}

export function addProjectLockEntry(
  projectDir: string,
  name: string,
  entry: ProjectLockEntry
): void {
  const lock = readProjectLock(projectDir);
  lock.skills[name] = entry;
  writeProjectLock(projectDir, lock);
}

export function removeProjectLockEntry(projectDir: string, name: string): void {
  const lock = readProjectLock(projectDir);
  delete lock.skills[name];
  writeProjectLock(projectDir, lock);
}

export function computeSkillHash(dir: string): string {
  const hash = crypto.createHash('sha256');
  const files = collectFiles(dir).sort();
  for (const file of files) {
    const rel = path.relative(dir, file);
    hash.update(rel);
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex').substring(0, 16);
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}
