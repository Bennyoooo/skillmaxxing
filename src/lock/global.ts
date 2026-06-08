import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { GlobalLockFile, GlobalLockEntry } from '../types.js';
import { ensureDir } from '../util/fs.js';

const LOCK_DIR = path.join(os.homedir(), '.skillmax');
const LOCK_PATH = path.join(LOCK_DIR, 'skill-lock.json');

function empty(): GlobalLockFile {
  return { version: 1, skills: {} };
}

export function readGlobalLock(): GlobalLockFile {
  try {
    const raw = fs.readFileSync(LOCK_PATH, 'utf-8');
    const data = JSON.parse(raw);
    if (data.version !== 1) return empty();
    return data as GlobalLockFile;
  } catch {
    return empty();
  }
}

export function writeGlobalLock(lock: GlobalLockFile): void {
  ensureDir(LOCK_DIR);
  // Sort skill keys for merge-friendliness before any team use (review C5/U13):
  // independent additions then produce diffs that don't collide on unrelated keys.
  const sorted: GlobalLockFile = { version: 1, skills: {} };
  for (const key of Object.keys(lock.skills).sort()) {
    sorted.skills[key] = lock.skills[key];
  }
  const tmp = LOCK_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(sorted, null, 2) + '\n');
  fs.renameSync(tmp, LOCK_PATH);
}

export function addGlobalLockEntry(
  name: string,
  entry: Omit<GlobalLockEntry, 'installedAt' | 'updatedAt'>
): void {
  const lock = readGlobalLock();
  const now = new Date().toISOString();
  const existing = lock.skills[name];
  lock.skills[name] = {
    ...entry,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
    agents: [...new Set([...(existing?.agents ?? []), ...entry.agents])],
  };
  writeGlobalLock(lock);
}

export function removeGlobalLockEntry(name: string): void {
  const lock = readGlobalLock();
  delete lock.skills[name];
  writeGlobalLock(lock);
}

export function getGlobalLockEntry(name: string): GlobalLockEntry | undefined {
  return readGlobalLock().skills[name];
}
