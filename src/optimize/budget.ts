export type Scheduler = 'constant' | 'linear' | 'cosine';

export interface BudgetOptions {
  base?: number;
  min?: number;
  scheduler?: Scheduler;
}

/**
 * Edit budget as a "learning rate" (KTD14): the max number of edits allowed in a
 * step, optionally annealed across steps so later steps make smaller changes.
 * Bounded changes prevent catastrophic skill drift.
 */
export function editBudget(step: number, totalSteps: number, opts: BudgetOptions = {}): number {
  const base = opts.base ?? 4;
  const min = opts.min ?? 2;
  const scheduler = opts.scheduler ?? 'cosine';
  if (totalSteps <= 1 || scheduler === 'constant') return base;

  const t = Math.min(Math.max(step, 0), totalSteps) / totalSteps; // 0..1
  let value: number;
  if (scheduler === 'linear') {
    value = base - (base - min) * t;
  } else {
    // cosine annealing from base → min
    value = min + (base - min) * 0.5 * (1 + Math.cos(Math.PI * t));
  }
  return Math.max(min, Math.round(value));
}
