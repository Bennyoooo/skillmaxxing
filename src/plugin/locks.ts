import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ensureDir } from '../util/fs.js';

/**
 * Global single-flight lock for the background reflector. Guarantees at most ONE
 * reflector runs at a time across all sessions — the guard that prevents the
 * stacking/runaway CPU failure (multiple `claude -p` reflectors pegging cores).
 * Stale locks (dead pid, or older than LOCK_STALE_MS) are stolen automatically.
 */

const LOCK_PATH = path.join(os.homedir(), '.skillmax', 'reflector.lock');

/** A held lock older than this is considered stale (reflector hung/crashed). */
export const LOCK_STALE_MS = 6 * 60 * 1000;

interface LockData {
  pid: number;
  at: number;
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM means the process exists but we can't signal it (still alive).
    // ESRCH (or anything else) means it's gone.
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Try to acquire the reflector lock. Returns true if acquired (caller must call
 * releaseReflectorLock when done), false if a live, fresh reflector holds it.
 */
export function acquireReflectorLock(now: number = Date.now()): boolean {
  ensureDir(path.dirname(LOCK_PATH));
  const payload = JSON.stringify({ pid: process.pid, at: now } satisfies LockData);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.writeFileSync(LOCK_PATH, payload, { flag: 'wx' }); // exclusive create
      return true;
    } catch {
      // Lock file exists — steal it only if stale/dead.
      try {
        const cur = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf-8')) as LockData;
        const fresh = typeof cur.at === 'number' && now - cur.at < LOCK_STALE_MS;
        if (typeof cur.pid === 'number' && pidAlive(cur.pid) && fresh) {
          return false; // genuinely held by a live, recent reflector
        }
      } catch {
        // unreadable/corrupt lock — treat as stale
      }
      try {
        fs.unlinkSync(LOCK_PATH);
      } catch {
        // someone else removed it; loop and retry the exclusive create
      }
    }
  }
  return false;
}

/** Release the lock if this process holds it. */
export function releaseReflectorLock(): void {
  try {
    const cur = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf-8')) as LockData;
    if (cur.pid === process.pid) fs.unlinkSync(LOCK_PATH);
  } catch {
    // no lock or not ours — nothing to do
  }
}
