import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

const execFileAsync = promisify(execFile);

export async function gitClone(url: string, dest: string, ref?: string): Promise<void> {
  const args = ['clone', '--depth', '1'];
  if (ref) args.push('--branch', ref);
  args.push(url, dest);

  await execFileAsync('git', args, {
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' },
    timeout: 60_000,
  });
}

export async function gitGetHeadSha(dir: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: dir });
  return stdout.trim();
}

export function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `skillmax-${prefix}-`));
}

export function cleanTempDir(dir: string): void {
  const resolved = path.resolve(dir);
  const tmpdir = path.resolve(os.tmpdir());
  if (!resolved.startsWith(tmpdir + path.sep)) return;
  try {
    fs.rmSync(resolved, { recursive: true });
  } catch {
    // best-effort cleanup
  }
}
