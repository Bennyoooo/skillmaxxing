import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ensureDir } from '../util/fs.js';

/**
 * Reflection ledger: tracks how many tool calls had occurred at the last
 * reflection, so the Stop hook can decide whether enough new work has accrued.
 *
 * Counting is done by reading the session transcript at Stop (see countToolUses)
 * rather than incrementing on every tool call. That removes the per-tool hook
 * entirely — the loop runs on Stop only — which keeps the agent fast on every
 * install path (global, npx, or bundled). State lives outside any skill dir.
 */

const SESSIONS_DIR = path.join(os.homedir(), '.skillmax', 'sessions');

export interface SessionState {
  lastReflectCount: number;
  reflectedAt?: string;
}

function sessionPath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'session';
  return path.join(SESSIONS_DIR, `${safe}.json`);
}

export function readSession(id: string): SessionState {
  try {
    const data = JSON.parse(fs.readFileSync(sessionPath(id), 'utf-8'));
    if (typeof data?.lastReflectCount === 'number') {
      return { lastReflectCount: data.lastReflectCount, reflectedAt: data.reflectedAt };
    }
  } catch {
    /* fall through to default */
  }
  return { lastReflectCount: 0 };
}

function writeSession(id: string, state: SessionState): void {
  ensureDir(SESSIONS_DIR);
  const target = sessionPath(id);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, target);
}

/**
 * Count tool calls in a Claude Code transcript (JSONL). Robust substring count of
 * `"tool_use"` blocks (tolerant of formatting/whitespace; `"tool_use_id"` in
 * tool-result entries is NOT matched). Returns 0 if the transcript is unreadable.
 */
export function countToolUses(transcriptPath: string): number {
  try {
    const raw = fs.readFileSync(transcriptPath, 'utf-8');
    return (raw.match(/"tool_use"/g) || []).length;
  } catch {
    return 0;
  }
}

/** Tool calls observed since the last reflection (never negative). */
export function toolsSinceReflect(id: string, currentCount: number): number {
  return Math.max(0, currentCount - readSession(id).lastReflectCount);
}

/** True when enough new tool calls have accrued since the last reflection. */
export function shouldReflect(id: string, currentCount: number, threshold: number): boolean {
  return toolsSinceReflect(id, currentCount) >= threshold;
}

/** Record that a reflection ran at the given cumulative tool count. */
export function markReflected(id: string, currentCount: number, now: string): void {
  writeSession(id, { lastReflectCount: currentCount, reflectedAt: now });
}
