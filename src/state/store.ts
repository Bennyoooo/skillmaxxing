import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash } from 'node:crypto';
import type { SkillState, SkillOrigin, ScoreEntry, SkillLifecycle } from '../types.js';
import { ensureDir } from '../util/fs.js';

const STATE_DIR = path.join(os.homedir(), '.skillmax', 'state');

/** Default cap on retained score-history entries (review SG5: bound unbounded growth). */
export const MAX_SCORE_HISTORY = 20;

/**
 * Filesystem-safe state key. Pass an origin-namespaced identity (e.g. a
 * workspace-synced skill's qualified name) so two same-named skills from
 * different origins do not share one sidecar file — see plan U3 / review A5.
 */
export function stateKey(identity: string): string {
  const safe = identity.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[._]+/, '') || 'unnamed';
  // Append a short hash of the RAW identity so two identities that sanitize to
  // the same string (e.g. "team/a" and "team_a") never share one sidecar file —
  // otherwise their trust flag and score history would silently merge (review A5).
  const hash = createHash('sha256').update(identity).digest('hex').slice(0, 8);
  return `${safe}-${hash}`;
}

function statePath(identity: string): string {
  return path.join(STATE_DIR, `${stateKey(identity)}.json`);
}

/** Read a skill's state sidecar, or null if absent/corrupt. Never throws. */
export function loadState(identity: string): SkillState | null {
  try {
    const raw = fs.readFileSync(statePath(identity), 'utf-8');
    const data = JSON.parse(raw);
    if (!data || typeof data.name !== 'string' || typeof data.id !== 'string') {
      return null;
    }
    return data as SkillState;
  } catch {
    return null;
  }
}

/** Write a skill's state sidecar atomically, trimming score history. */
export function saveState(state: SkillState): void {
  ensureDir(STATE_DIR);
  const target = statePath(state.id);
  const trimmed: SkillState = {
    ...state,
    scoreHistory: state.scoreHistory.slice(-MAX_SCORE_HISTORY),
    updatedAt: state.updatedAt,
  };
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2) + '\n');
  fs.renameSync(tmp, target);
}

export interface StateInit {
  name: string;
  origin: SkillOrigin;
  /** Identity used as the sidecar key; defaults to name when not namespaced. */
  id?: string;
  version?: string;
  lifecycle?: SkillLifecycle;
  source?: string;
}

/** Load existing state for `id`, or create-and-persist a default (trusted:false). */
export function ensureState(init: StateInit, now: string): SkillState {
  const id = init.id ?? init.name;
  const existing = loadState(id);
  if (existing) return existing;
  const state: SkillState = {
    name: init.name,
    id,
    origin: init.origin,
    trusted: false,
    version: init.version ?? '1.0.0',
    lifecycle: init.lifecycle ?? 'committed',
    scoreHistory: [],
    source: init.source,
    createdAt: now,
    updatedAt: now,
  };
  saveState(state);
  return state;
}

/** Append a score entry (trimmed on save) and persist. No-op if state absent. */
export function recordScore(id: string, entry: ScoreEntry): void {
  const state = loadState(id);
  if (!state) return;
  state.scoreHistory.push(entry);
  state.updatedAt = entry.at;
  saveState(state);
}

/** Transition lifecycle and persist. No-op if state absent. */
export function setLifecycle(id: string, lifecycle: SkillLifecycle, now: string): void {
  const state = loadState(id);
  if (!state) return;
  state.lifecycle = lifecycle;
  state.updatedAt = now;
  saveState(state);
}

/** List all persisted skill states (best-effort; skips corrupt files). */
export function listStates(): SkillState[] {
  let names: string[];
  try {
    names = fs.readdirSync(STATE_DIR);
  } catch {
    return [];
  }
  const out: SkillState[] = [];
  for (const file of names) {
    if (!file.endsWith('.json')) continue;
    // The filename is already the hashed state key — re-hashing it (via
    // loadState) would miss the file. Read the sidecar contents directly and
    // trust the `id` it records.
    try {
      const data = JSON.parse(fs.readFileSync(path.join(STATE_DIR, file), 'utf-8'));
      if (data && typeof data.name === 'string' && typeof data.id === 'string') {
        out.push(data as SkillState);
      }
    } catch {
      /* skip corrupt/unreadable sidecar */
    }
  }
  return out;
}

/** Test/maintenance hook: remove a state sidecar. Returns true if removed. */
export function deleteState(id: string): boolean {
  try {
    fs.rmSync(statePath(id));
    return true;
  } catch {
    return false;
  }
}
