export type EditOp = 'append' | 'insert_after' | 'replace' | 'delete';

/** A structured edit to a skill document (SkillOpt-style). */
export interface Edit {
  op: EditOp;
  /** New text (append/insert_after/replace). */
  content?: string;
  /** Existing anchor text to locate (insert_after/replace/delete). */
  target?: string;
  /** Whether this edit came from analyzing a failure or a success. */
  sourceType?: 'failure' | 'success';
  /** How many rollout trajectories support this edit. */
  supportCount?: number;
}

/** Protected region markers — step-level edits may not modify content inside (KTD14). */
export const SLOW_UPDATE_START = '<!-- SLOW_UPDATE_START -->';
export const SLOW_UPDATE_END = '<!-- SLOW_UPDATE_END -->';

function slowUpdateSpan(content: string): { start: number; end: number } | null {
  const s = content.indexOf(SLOW_UPDATE_START);
  if (s === -1) return null;
  const e = content.indexOf(SLOW_UPDATE_END, s);
  if (e === -1) return null;
  return { start: s, end: e + SLOW_UPDATE_END.length };
}

/** True if `index` falls within the protected slow-update region. */
export function isProtectedIndex(content: string, index: number): boolean {
  const span = slowUpdateSpan(content);
  return span !== null && index >= span.start && index < span.end;
}

export interface ApplyResult {
  ok: boolean;
  content: string;
  reason?: string;
}

/** Apply a single edit. Rejects edits that target the protected slow-update region. */
export function applyEdit(content: string, edit: Edit): ApplyResult {
  if (edit.op === 'append') {
    const span = slowUpdateSpan(content);
    // append goes to end; if a slow-update region ends the doc, insert before it
    if (span && span.end >= content.trimEnd().length) {
      const before = content.slice(0, span.start);
      const region = content.slice(span.start);
      return { ok: true, content: `${before.trimEnd()}\n${edit.content ?? ''}\n\n${region}` };
    }
    return { ok: true, content: `${content.replace(/\s*$/, '')}\n${edit.content ?? ''}\n` };
  }

  if (!edit.target) {
    return { ok: false, content, reason: `${edit.op} requires a target` };
  }
  // Find the first occurrence OUTSIDE the protected slow-update region. An anchor
  // that also appears inside the region must not cause the whole edit to be
  // dropped when a valid occurrence exists outside it (review: dual-occurrence).
  let idx = content.indexOf(edit.target);
  while (idx !== -1 && isProtectedIndex(content, idx)) {
    idx = content.indexOf(edit.target, idx + 1);
  }
  if (idx === -1) {
    const anywhere = content.includes(edit.target);
    return {
      ok: false,
      content,
      reason: anywhere
        ? 'target only occurs within the protected slow-update region'
        : `target not found: ${truncate(edit.target)}`,
    };
  }

  if (edit.op === 'replace') {
    return { ok: true, content: content.slice(0, idx) + (edit.content ?? '') + content.slice(idx + edit.target.length) };
  }
  if (edit.op === 'delete') {
    return { ok: true, content: content.slice(0, idx) + content.slice(idx + edit.target.length) };
  }
  if (edit.op === 'insert_after') {
    const at = idx + edit.target.length;
    return { ok: true, content: content.slice(0, at) + (edit.content ?? '') + content.slice(at) };
  }
  return { ok: false, content, reason: `unknown op: ${edit.op}` };
}

export interface ApplyAllResult {
  content: string;
  applied: Edit[];
  rejected: { edit: Edit; reason: string }[];
}

/** Apply a list of edits in order, collecting which applied and which were rejected. */
export function applyEdits(content: string, edits: Edit[]): ApplyAllResult {
  let current = content;
  const applied: Edit[] = [];
  const rejected: { edit: Edit; reason: string }[] = [];
  for (const edit of edits) {
    const res = applyEdit(current, edit);
    if (res.ok) {
      current = res.content;
      applied.push(edit);
    } else {
      rejected.push({ edit, reason: res.reason ?? 'rejected' });
    }
  }
  return { content: current, applied, rejected };
}

/** Replace (or create) the slow-update region's contents — epoch-level only. */
export function setSlowUpdate(content: string, guidance: string): string {
  const block = `${SLOW_UPDATE_START}\n${guidance}\n${SLOW_UPDATE_END}`;
  const span = slowUpdateSpan(content);
  if (span) return content.slice(0, span.start) + block + content.slice(span.end);
  return `${content.replace(/\s*$/, '')}\n\n${block}\n`;
}

function truncate(s: string): string {
  return s.length > 40 ? s.slice(0, 39) + '…' : s;
}
