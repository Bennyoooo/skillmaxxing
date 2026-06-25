import { spawn } from 'node:child_process';

/**
 * Background reflection (Hermes "Layer B"): a forked, headless agent that reviews
 * the just-finished session and, if it finds reusable work or an outdated skill,
 * creates/improves exactly one skill — autonomously, no user trigger. Restricted
 * to skill tooling and guarded against recursion so it never re-triggers itself.
 */

export type ReflectAgent = 'claude' | 'codex';

/** Env flag set on the spawned reflector so its own Stop hook no-ops (no recursion). */
export const REFLECT_ENV = 'SKILLMAX_REFLECT';

export function isReflecting(): boolean {
  return process.env[REFLECT_ENV] === '1';
}

export function buildReflectionPrompt(transcriptPath: string): string {
  return [
    'You are the Skill Maxing background reflector. Review the coding session transcript at:',
    `  ${transcriptPath}`,
    '',
    'Decide whether the session contains EITHER:',
    '  (a) a reusable workflow worth saving as a new skill, or',
    '  (b) a skill that was used and turned out incomplete/outdated/wrong.',
    '',
    'If neither, do nothing and exit — most sessions should produce no skill.',
    'If one applies, take exactly ONE action, conservatively:',
    '  - First search existing skills: `skillmaxxing discover "<capability>" --json`.',
    '  - PREFER updating an existing skill over creating a near-duplicate.',
    '  - To create: write a draft JSON (name, description, body, optional scripts and a real',
    '    eval scaffold) then `skillmaxxing skillify --draft <file>` and `--commit <name>`.',
    '  - To improve: run the eval-gated `skillmaxxing optimize` loop.',
    '',
    'New/changed skills are recorded trusted:false for the user to review. Do NOT modify',
    'project source code. Do NOT install or execute untrusted skills. One skill at most.',
  ].join('\n');
}

export interface ReflectOptions {
  agent: ReflectAgent;
  transcriptPath: string;
  cwd: string;
}

/**
 * Spawn the reflector detached so the user's session is never blocked. Returns
 * true if a process was launched. Tools are restricted to skill management.
 */
export function runReflectionDetached(opts: ReflectOptions): boolean {
  const prompt = buildReflectionPrompt(opts.transcriptPath);
  const env = { ...process.env, [REFLECT_ENV]: '1' };

  let command: string;
  let args: string[];
  if (opts.agent === 'claude') {
    command = 'claude';
    args = [
      '-p',
      prompt,
      '--allowedTools',
      'Read,Glob,Grep,Write,Edit,Bash(skillmaxxing:*),Bash(skill-maxing:*),Bash(skillmax:*),Bash(npx:*)',
    ];
  } else {
    command = 'codex';
    args = ['exec', prompt];
  }

  try {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return true;
  } catch {
    return false; // reflector binary missing or spawn failed — never break the user's session
  }
}
