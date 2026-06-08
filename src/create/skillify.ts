import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import type { EvalManifest } from '../eval/schema.js';
import { validateManifest } from '../eval/schema.js';
import type { Scope } from '../types.js';
import { writeSkillFile } from '../util/frontmatter.js';
import { ensureValidName } from '../util/collision.js';
import { sanitizeSubpath } from '../util/sanitize.js';
import { ensureDir, removeDir, fileExists } from '../util/fs.js';
import { runSandboxed } from '../util/exec.js';
import { ensureState, setLifecycle } from '../state/store.js';
import { install } from '../commands/install.js';

const DRAFTS_DIR = path.join(os.homedir(), '.skillmax', 'drafts');

export interface SkillScript {
  /** Relative path under the skill dir (e.g. "scripts/run.sh"). */
  path: string;
  content: string;
}

/**
 * The synthesized content the host agent supplies (the CLI↔agent contract). The
 * agent does the reasoning (name, body, scripts, real eval tasks); the CLI does
 * staging, sandboxed smoke-testing, and atomic commit.
 */
export interface SkillDraft {
  name: string;
  description: string;
  body: string;
  tools?: string[];
  triggers?: string[];
  scripts?: SkillScript[];
  /** A real eval scaffold with scorable tasks — not a stub (review A3). */
  eval?: EvalManifest;
  /** argv run in the sandbox as a smoke test (reads the staged dir as cwd). */
  smokeTest?: string[];
}

export function draftDir(name: string): string {
  return path.join(DRAFTS_DIR, name);
}

export interface StageResult {
  ok: boolean;
  dir: string;
  /** true/false when the smoke test ran; null when skipped. */
  smokePassed: boolean | null;
  detail?: string;
}

/**
 * Stage a draft to a persistent draft dir (resumable across sessions — review I5)
 * and optionally run its smoke test in the sandbox. Smoke tests require explicit
 * allowExec: a freshly-synthesized skill is `trusted:false`, so running its code
 * is a deliberate, user-authorized step (review A7), not an automatic one.
 */
export async function stageDraft(
  draft: SkillDraft,
  opts: { allowExec?: boolean } = {},
): Promise<StageResult> {
  const nameCheck = ensureValidName(draft.name);
  if (!nameCheck.ok) return { ok: false, dir: '', smokePassed: null, detail: nameCheck.reason };

  if (draft.eval) {
    const err = validateManifest(draft.eval);
    if (err) return { ok: false, dir: '', smokePassed: null, detail: `eval scaffold invalid: ${err}` };
  }

  const dir = draftDir(draft.name);
  removeDir(dir);
  ensureDir(dir);

  writeSkillFile(
    path.join(dir, 'SKILL.md'),
    {
      name: draft.name,
      description: draft.description,
      version: '1.0.0',
      ...(draft.tools ? { tools: draft.tools } : {}),
      ...(draft.triggers ? { triggers: draft.triggers } : {}),
    },
    draft.body,
  );

  for (const s of draft.scripts ?? []) {
    const safe = sanitizeSubpath(s.path);
    if (!safe) continue; // reject traversal in script paths
    const p = path.join(dir, safe);
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, s.content);
  }

  if (draft.eval) {
    fs.writeFileSync(path.join(dir, 'eval.yaml'), stringifyYaml(draft.eval));
  }

  const now = new Date().toISOString();
  ensureState({ name: draft.name, origin: 'created', lifecycle: 'staged' }, now);
  setLifecycle(draft.name, 'staged', now);

  let smokePassed: boolean | null = null;
  if (draft.smokeTest && draft.smokeTest.length > 0) {
    if (!opts.allowExec) {
      return {
        ok: true,
        dir,
        smokePassed: null,
        detail: 'smoke test skipped: review the generated scripts, then re-run with allowExec to execute it',
      };
    }
    const [cmd, ...args] = draft.smokeTest;
    const res = await runSandboxed(cmd, args, {
      cwd: dir,
      skillId: draft.name,
      allowExec: true,
      timeoutMs: 30_000,
    });
    smokePassed = res.ok;
    if (!res.ok) {
      return { ok: false, dir, smokePassed, detail: `smoke test failed: exit ${res.code}` };
    }
  }

  return { ok: true, dir, smokePassed };
}

export interface CommitOptions {
  scope: Scope;
  agents?: string[];
  copy?: boolean;
  force?: boolean;
}

/**
 * Commit a staged draft: install it from its draft dir (reusing the hardened
 * install path + collision gate) and mark its state committed (origin: created,
 * trusted: false). The draft dir is removed after a successful commit.
 */
export async function commitDraft(name: string, opts: CommitOptions): Promise<void> {
  const dir = draftDir(name);
  if (!fileExists(path.join(dir, 'SKILL.md'))) {
    throw new Error(`no staged draft for "${name}" (stage it first)`);
  }
  await install({
    source: dir,
    scope: opts.scope,
    agents: opts.agents,
    copy: opts.copy ?? true, // created skills default to copy (draft edits stay isolated)
    force: opts.force,
  });
  const now = new Date().toISOString();
  ensureState({ name, origin: 'created', lifecycle: 'committed' }, now);
  setLifecycle(name, 'committed', now);
  removeDir(dir);
}

/** List names of drafts staged but not yet committed. */
export function listDrafts(): string[] {
  try {
    return fs
      .readdirSync(DRAFTS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fileExists(path.join(DRAFTS_DIR, e.name, 'SKILL.md')))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/** Discard a staged draft. Returns true if removed. */
export function discardDraft(name: string): boolean {
  return removeDir(draftDir(name));
}
