/** Deterministic scorers. The host agent never decides pass/fail for these. */

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Exact match after trimming trailing/leading whitespace. */
export function scoreExact(output: string, expect: string): number {
  return output.trim() === expect.trim() ? 1 : 0;
}

/** Case-insensitive, whitespace-collapsed match. */
export function scoreNormalized(output: string, expect: string): number {
  return normalize(output) === normalize(expect) ? 1 : 0;
}

/**
 * Success-signal scorer: the rollout emits a deterministic signal token. Passes
 * when the output equals the expected signal (default "PASS").
 */
export function scoreSuccessSignal(output: string, expect = 'PASS'): number {
  return output.trim() === expect.trim() ? 1 : 0;
}
