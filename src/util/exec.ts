import { execFile } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { isTrusted } from '../state/trust.js';

/**
 * Constrained subprocess runner for skill-authored scripts and eval rollouts.
 *
 * Honest scope (review S1/F3/KTD6): this is PROCESS-LEVEL hardening, NOT a
 * security container. It does: no shell, a hard timeout, an env ALLOWLIST
 * (default-deny — credentials like GITHUB_TOKEN never pass; review S8), a working
 * directory, and an output-size cap. It does NOT: block network egress (not
 * enforceable via env alone on macOS/Linux), prevent absolute-path writes, or
 * cap memory/PIDs. Treat it as defense-in-depth. For untrusted skills, the trust
 * gate below — not the subprocess limits — is the primary control.
 */

/** Env vars passed through to sandboxed children. Default-deny everything else. */
const ALLOWED_ENV = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TEMP', 'TZ'];

export class SandboxRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxRefusedError';
  }
}

export interface SandboxOptions {
  /** Working directory (required). Resolved to absolute; must exist. */
  cwd: string;
  /** Hard timeout; child is killed past this. Default 30s. */
  timeoutMs?: number;
  /** Max captured stdout/stderr bytes before truncation. Default 1 MiB. */
  maxOutputBytes?: number;
  /** Skill identity for the trust lookup. Required unless allowExec is set. */
  skillId?: string;
  /** Explicit override to run an untrusted skill's code. */
  allowExec?: boolean;
  /** Extra non-credential env passthrough (merged after the allowlist). */
  env?: Record<string, string>;
}

export interface SandboxResult {
  ok: boolean;
  code: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
}

function safeEnv(extra?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ALLOWED_ENV) {
    const v = process.env[key];
    if (v !== undefined) env[key] = v;
  }
  // Best-effort network discouragement (NOT enforcement — see header note).
  env.NO_PROXY = '*';
  if (extra) Object.assign(env, extra);
  return env;
}

/**
 * Run a command under the sandbox. Rejects (throws SandboxRefusedError) before
 * spawning when the skill is untrusted and allowExec is not set — `trusted:false`
 * skills never auto-execute (review C3/AE1).
 */
export function runSandboxed(
  command: string,
  args: string[],
  opts: SandboxOptions,
): Promise<SandboxResult> {
  if (!opts.allowExec) {
    if (!opts.skillId || !isTrusted(opts.skillId)) {
      const who = opts.skillId ? ` "${opts.skillId}"` : '';
      return Promise.reject(
        new SandboxRefusedError(
          `refusing to execute untrusted skill${who}; grant trust or pass allowExec`,
        ),
      );
    }
  }

  const cwd = path.resolve(opts.cwd);
  if (!fs.existsSync(cwd)) {
    return Promise.reject(new SandboxRefusedError(`sandbox cwd does not exist: ${cwd}`));
  }

  const maxBuffer = opts.maxOutputBytes ?? 1024 * 1024;

  return new Promise<SandboxResult>((resolve) => {
    execFile(
      command,
      args,
      {
        cwd,
        env: safeEnv(opts.env),
        timeout: opts.timeoutMs ?? 30_000,
        maxBuffer,
        shell: false,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        const e = err as
          | (Error & { code?: number | string; signal?: string; killed?: boolean })
          | null;
        const timedOut = !!(e && e.killed && e.signal === 'SIGTERM');
        const truncated = !!(e && e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
        const code = typeof e?.code === 'number' ? e.code : e ? null : 0;
        resolve({
          ok: !err,
          code,
          signal: e?.signal ?? null,
          stdout: stdout?.toString() ?? '',
          stderr: stderr?.toString() ?? '',
          timedOut,
          truncated,
        });
      },
    );
  });
}
