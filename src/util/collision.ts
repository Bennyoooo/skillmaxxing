import * as fs from 'node:fs';
import { validateName, sanitizeName } from './sanitize.js';

export interface CollisionOptions {
  force?: boolean;
}

export type CollisionResult = { ok: true } | { ok: false; reason: string };

/** Validate a skill name at a write boundary (review I6: validateName was never called). */
export function ensureValidName(name: string): CollisionResult {
  const err = validateName(name);
  if (err) return { ok: false, reason: `invalid skill name "${name}": ${err}` };
  return { ok: true };
}

/**
 * Decide whether writing a skill named `name` into `destDir` is safe. Refuses to
 * overwrite an existing skill unless `force` — the guarded replacement for the
 * silent delete-then-write in fs.symlinkOrCopy on managed write paths (review C2).
 */
export function checkWrite(
  destDir: string,
  name: string,
  opts: CollisionOptions = {},
): CollisionResult {
  const valid = ensureValidName(name);
  if (!valid.ok) return valid;
  if (fs.existsSync(destDir) && !opts.force) {
    return {
      ok: false,
      reason: `skill "${name}" already exists at ${destDir} (pass force to overwrite)`,
    };
  }
  return { ok: true };
}

/**
 * Case-insensitive collision check against existing names. Returns the colliding
 * existing name, or null. Catches the `code-review` vs `Code-Review` footgun.
 */
export function collidesWith(name: string, existing: Iterable<string>): string | null {
  const lower = name.toLowerCase();
  for (const e of existing) {
    if (e === name || e.toLowerCase() === lower) return e;
  }
  return null;
}

/**
 * Origin-namespaced name so a workspace sync never clobbers a local skill of the
 * same name (review C2 / AE2). E.g. ("team-acme","code-review") →
 * "team-acme-code-review" (sanitized to a valid skill name).
 */
export function namespacedName(origin: string, name: string): string {
  return sanitizeName(`${origin}-${name}`);
}
