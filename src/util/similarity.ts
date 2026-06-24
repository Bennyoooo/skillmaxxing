/**
 * Shared text similarity helpers used by discovery ranking, the prefer-update
 * matcher, and in-session reflection. Single source of truth so tokenization
 * stays consistent across all three (and future changes — stemming, stopwords —
 * land in one place).
 */

/** Lowercase, split on non-alphanumeric runs, drop empties. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Token set of a string. */
export function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/** Jaccard similarity of two sets (0 when either is empty). */
export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
