import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ensureDir, copyDir, removeDir } from './fs.js';

const VERSIONS_ROOT = path.join(os.homedir(), '.skillmax', 'versions');

/** Default number of prior versions retained per skill (review SG5: bound growth). */
export const MAX_RETAINED_VERSIONS = 5;

function skillVersionsDir(id: string): string {
  return path.join(VERSIONS_ROOT, id);
}

/**
 * Atomically replace `target`'s contents with a copy of `source`.
 *
 * Crash-safety (review C4): `source` is first copied into a sibling staged dir on
 * the SAME filesystem as `target`, so the two renames below are intra-filesystem
 * and atomic (sidesteps the cross-device EXDEV concern, review F5). If the swap
 * rename fails, the prior `target` is rolled back from its backup — a failed swap
 * never destroys the previous version.
 */
export function atomicReplaceDir(target: string, source: string): void {
  if (!fs.existsSync(source)) {
    throw new Error(`source directory not found: ${source}`);
  }
  // Refuse to replace a symlink: renaming the link (not its target) would leave
  // the real upstream skill untouched and silently break the install topology
  // (review: optimize/promote against a symlinked install dir). The caller must
  // pass the resolved managed-copy directory.
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    throw new Error(`refusing to replace a symlink: ${target} (pass the resolved skill directory)`);
  }
  const parent = path.dirname(target);
  ensureDir(parent);
  const base = path.basename(target);
  const staged = path.join(parent, `.${base}.staged-${process.pid}`);
  const backup = path.join(parent, `.${base}.old-${process.pid}`);

  removeDir(staged);
  copyDir(source, staged);
  removeDir(backup);

  let backedUp = false;
  if (fs.existsSync(target)) {
    fs.renameSync(target, backup);
    backedUp = true;
  }
  try {
    fs.renameSync(staged, target);
  } catch (err) {
    if (backedUp) fs.renameSync(backup, target); // roll back
    removeDir(staged);
    throw err;
  }
  if (backedUp) removeDir(backup);
}

/** Copy a skill dir into the retained-versions store under <id>/<version>/. */
export function snapshot(id: string, version: string, srcDir: string): string {
  const dir = path.join(skillVersionsDir(id), version);
  removeDir(dir);
  copyDir(srcDir, dir);
  pruneVersions(id);
  return dir;
}

/** Retained version names for a skill, newest first. */
export function listVersions(id: string): string[] {
  const dir = skillVersionsDir(id);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, mtime: fs.statSync(path.join(dir, e.name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map((e) => e.name);
}

/** Remove the oldest retained versions beyond MAX_RETAINED_VERSIONS. */
export function pruneVersions(id: string, keep = MAX_RETAINED_VERSIONS): void {
  const versions = listVersions(id); // newest first
  for (const stale of versions.slice(keep)) {
    removeDir(path.join(skillVersionsDir(id), stale));
  }
}

/**
 * Promote a candidate into the live location: retain the current live version,
 * then atomically swap in the candidate. Reversible via `revert`.
 */
export function promote(params: {
  id: string;
  liveDir: string;
  candidateDir: string;
  priorVersion: string;
}): void {
  if (fs.existsSync(params.liveDir)) {
    snapshot(params.id, params.priorVersion, params.liveDir);
  }
  atomicReplaceDir(params.liveDir, params.candidateDir);
}

/** Restore a retained version into the live location atomically. */
export function revert(id: string, version: string, liveDir: string): void {
  const vdir = path.join(skillVersionsDir(id), version);
  if (!fs.existsSync(vdir)) {
    throw new Error(`version not retained: ${id}@${version}`);
  }
  atomicReplaceDir(liveDir, vdir);
}
