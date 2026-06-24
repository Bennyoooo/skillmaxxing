import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ensureDir } from '../util/fs.js';

/**
 * Per-session tool-call counter that gates the auto-reflection loop. The plugin
 * hooks increment a counter on every tool use (PostToolUse) and, on Stop, fire
 * reflection only once enough substantive work has accrued — the Hermes
 * "iteration-gated review" idea, adapted to coding-agent hooks. State lives
 * outside any skill dir so it never affects skill content hashes.
 */

const SESSIONS_DIR = path.join(os.homedir(), '.skillmax', 'sessions');

export interface SessionState {
  /** Total tool calls observed this session. */
  tools: number;
  /** Tool count at the last reflection (so we measure work since then). */
  lastReflectTools: number;
  reflectedAt?: string;
}

function sessionPath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'session';
  return path.join(SESSIONS_DIR, `${safe}.json`);
}

export function readSession(id: string): SessionState {
  try {
    const data = JSON.parse(fs.readFileSync(sessionPath(id), 'utf-8'));
    if (typeof data?.tools === 'number') {
      return { tools: data.tools, lastReflectTools: data.lastReflectTools ?? 0, reflectedAt: data.reflectedAt };
    }
  } catch {
    /* fall through to default */
  }
  return { tools: 0, lastReflectTools: 0 };
}

function writeSession(id: string, state: SessionState): void {
  ensureDir(SESSIONS_DIR);
  const target = sessionPath(id);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, target);
}

/** Record one tool use; returns the new total. */
export function recordToolUse(id: string): number {
  const s = readSession(id);
  s.tools += 1;
  writeSession(id, s);
  return s.tools;
}

/** Tool calls since the last reflection. */
export function toolsSinceReflect(id: string): number {
  const s = readSession(id);
  return s.tools - s.lastReflectTools;
}

/** True when enough substantive work has accrued to warrant a reflection. */
export function shouldReflect(id: string, threshold: number): boolean {
  return toolsSinceReflect(id) >= threshold;
}

/** Mark that a reflection ran at the current tool count. */
export function markReflected(id: string, now: string): void {
  const s = readSession(id);
  s.lastReflectTools = s.tools;
  s.reflectedAt = now;
  writeSession(id, s);
}
