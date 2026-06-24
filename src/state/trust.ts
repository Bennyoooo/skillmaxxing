import { loadState, saveState } from './store.js';

/**
 * Trust model: agent-created and publicly-discovered skills default to
 * `trusted: false` (set at state creation in store.ensureState). The execution
 * sandbox refuses to auto-execute untrusted skills (see util/exec.ts). Trust is
 * granted only by an explicit user action through `grantTrust`.
 */

/** True only when a state record exists AND is explicitly trusted. */
export function isTrusted(id: string): boolean {
  return loadState(id)?.trusted ?? false;
}

/** Grant trust to a skill. No-op if no state record exists. Returns success. */
export function grantTrust(id: string, now: string): boolean {
  const state = loadState(id);
  if (!state) return false;
  state.trusted = true;
  state.updatedAt = now;
  saveState(state);
  return true;
}

/** Revoke trust from a skill. No-op if no state record exists. Returns success. */
export function revokeTrust(id: string, now: string): boolean {
  const state = loadState(id);
  if (!state) return false;
  state.trusted = false;
  state.updatedAt = now;
  saveState(state);
  return true;
}
