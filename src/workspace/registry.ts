import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ensureDir, copyDir, fileExists, removeDir } from '../util/fs.js';
import { readSkillMeta } from '../util/frontmatter.js';
import { ensureValidName, namespacedName } from '../util/collision.js';
import { isPathSafe } from '../util/sanitize.js';
import { isValidChannel } from './channels.js';
import { ensureState, loadState, saveState } from '../state/store.js';
import type { Channel } from '../types.js';

/**
 * Git-based shared workspace registry (KTD11): the registry is just a directory
 * (typically a git repo the team pushes/pulls). publish writes a skill + index
 * entry; sync materializes registry skills into a LOCAL managed area
 * (~/.skillmax/workspace/<registryId>/<name>) and records provenance — it never
 * writes agent dirs, so a sync can never clobber a local skill (review C2/AE2).
 */

export interface RegistryEntry {
  name: string;
  channel: Channel;
  version: string;
  publishedBy: string;
  publishedAt: string;
}

export interface RegistryIndex {
  version: number;
  skills: RegistryEntry[];
}

const WORKSPACE_DIR = path.join(os.homedir(), '.skillmax', 'workspace');

function indexPath(registryDir: string): string {
  return path.join(registryDir, 'registry.json');
}

export function readRegistry(registryDir: string): RegistryIndex {
  try {
    const data = JSON.parse(fs.readFileSync(indexPath(registryDir), 'utf-8'));
    if (!data || !Array.isArray(data.skills)) return { version: 1, skills: [] };
    // registry.json is an UNTRUSTED shared file. Drop entries whose name or
    // channel is invalid before any entry value is joined into a filesystem path
    // (review: path traversal via crafted entry.name / entry.channel in sync()).
    const skills = (data.skills as RegistryEntry[]).filter(
      (e) =>
        e &&
        typeof e.name === 'string' &&
        ensureValidName(e.name).ok &&
        typeof e.channel === 'string' &&
        isValidChannel(e.channel),
    );
    return { version: 1, skills };
  } catch {
    return { version: 1, skills: [] };
  }
}

export function writeRegistry(registryDir: string, idx: RegistryIndex): void {
  ensureDir(registryDir);
  // Sort entries for merge-friendliness (review C5).
  const sorted = [...idx.skills].sort(
    (a, b) => a.name.localeCompare(b.name) || a.channel.localeCompare(b.channel),
  );
  const out = { version: 1, skills: sorted };
  const p = indexPath(registryDir);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function skillStorePath(registryDir: string, channel: Channel, name: string): string {
  return path.join(registryDir, 'skills', channel, name);
}

export interface PublishOptions {
  channel: Channel;
  publishedBy: string;
  version?: string;
  at: string;
}

/** Publish a local skill directory into the registry under a channel. */
export function publish(skillDir: string, registryDir: string, opts: PublishOptions): RegistryEntry {
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fileExists(skillMd)) throw new Error(`no SKILL.md in ${skillDir}`);
  const meta = readSkillMeta(fs.readFileSync(skillMd, 'utf-8'));
  if (!meta) throw new Error(`invalid SKILL.md in ${skillDir}`);
  const nameCheck = ensureValidName(meta.name);
  if (!nameCheck.ok) throw new Error(nameCheck.reason);

  const dest = skillStorePath(registryDir, opts.channel, meta.name);
  removeDir(dest);
  ensureDir(path.dirname(dest));
  copyDir(skillDir, dest);

  const entry: RegistryEntry = {
    name: meta.name,
    channel: opts.channel,
    version: opts.version ?? (typeof meta.version === 'string' ? meta.version : '1.0.0'),
    publishedBy: opts.publishedBy,
    publishedAt: opts.at,
  };
  const idx = readRegistry(registryDir);
  idx.skills = idx.skills.filter((e) => !(e.name === entry.name && e.channel === entry.channel));
  idx.skills.push(entry);
  writeRegistry(registryDir, idx);
  return entry;
}

/** List registry entries, optionally filtered by channel. */
export function listRegistry(registryDir: string, channel?: Channel): RegistryEntry[] {
  const entries = readRegistry(registryDir).skills;
  return channel ? entries.filter((e) => e.channel === channel) : entries;
}

export interface SyncedSkill {
  name: string;
  id: string;
  channel: Channel;
  dir: string;
  collided: boolean;
}

export interface SyncOptions {
  channel?: Channel;
  registryId?: string;
  at: string;
}

/**
 * Materialize registry skills into the local managed workspace area and record
 * their state (origin: workspace, trusted: false). Synced skills are keyed by an
 * origin-namespaced id when they collide with an existing local skill, so the
 * local skill's state and history are never overwritten (review A5/AE2).
 */
export function sync(registryDir: string, opts: SyncOptions): SyncedSkill[] {
  const registryId = opts.registryId ?? path.basename(path.resolve(registryDir));
  const entries = listRegistry(registryDir, opts.channel);
  const synced: SyncedSkill[] = [];

  for (const entry of entries) {
    const src = skillStorePath(registryDir, entry.channel, entry.name);
    if (!fileExists(path.join(src, 'SKILL.md'))) continue;

    const existing = loadState(entry.name);
    const collided = !!existing && existing.origin !== 'workspace';
    const id = collided ? namespacedName(registryId, entry.name) : entry.name;

    const dir = path.join(WORKSPACE_DIR, registryId, entry.name);
    // Defense-in-depth: never remove/write outside the managed workspace area.
    if (!isPathSafe(WORKSPACE_DIR, dir)) continue;
    removeDir(dir);
    ensureDir(path.dirname(dir));
    copyDir(src, dir);

    const state = ensureState(
      { name: entry.name, id, origin: 'workspace', version: entry.version, source: registryId },
      opts.at,
    );
    state.origin = 'workspace';
    state.channel = entry.channel;
    state.version = entry.version;
    state.source = registryId;
    state.updatedAt = opts.at;
    saveState(state);

    synced.push({ name: entry.name, id, channel: entry.channel, dir, collided });
  }
  return synced;
}
