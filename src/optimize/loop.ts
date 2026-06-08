import type { Edit } from './diff.js';
import type { RejectedEditBuffer } from './buffer.js';

export type GateAction = 'accept_new_best' | 'accept' | 'reject';

export interface GateResult {
  action: GateAction;
}

/**
 * Validation gate (KTD14 / SkillOpt): accept a candidate only if its score is
 * STRICTLY greater than the current score. Promotion to live additionally
 * requires no held-out regression (see noHeldOutRegression) and human approval.
 */
export function gate(currentScore: number, candidateScore: number, bestScore: number): GateResult {
  if (candidateScore > currentScore) {
    if (candidateScore > bestScore) return { action: 'accept_new_best' };
    return { action: 'accept' };
  }
  return { action: 'reject' };
}

/**
 * No held-out task may regress (pass→fail / lower score). Overfitting guard: a
 * candidate that improves overall but breaks a held-out task is rejected.
 */
export function noHeldOutRegression(
  current: Record<string, number>,
  candidate: Record<string, number>,
  heldOutIds: string[],
): boolean {
  for (const id of heldOutIds) {
    const before = current[id] ?? 0;
    const after = candidate[id] ?? 0;
    if (after < before) return false;
  }
  return true;
}

/**
 * Select which edits to apply this step: drop edits already in the rejected
 * buffer, prioritize failure-driven edits over success-driven ones, then by
 * support count, and cap at the edit budget. Deterministic and stable.
 */
export function selectEdits(
  edits: Edit[],
  budget: number,
  buffer?: RejectedEditBuffer,
): Edit[] {
  const fresh = buffer ? buffer.filterNew(edits) : edits;
  const ranked = fresh
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const aFail = a.e.sourceType === 'failure' ? 0 : 1;
      const bFail = b.e.sourceType === 'failure' ? 0 : 1;
      if (aFail !== bFail) return aFail - bFail; // failures first
      const aSup = a.e.supportCount ?? 0;
      const bSup = b.e.supportCount ?? 0;
      if (aSup !== bSup) return bSup - aSup; // higher support first
      return a.i - b.i; // stable
    })
    .map((x) => x.e);
  return ranked.slice(0, Math.max(0, budget));
}
