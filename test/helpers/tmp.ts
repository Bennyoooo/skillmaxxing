import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const tmpRoot = path.resolve(os.tmpdir());

/** Create a throwaway directory under the OS temp dir for a test. */
export function makeTmpDir(prefix = 'test'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `skillmax-${prefix}-`));
}

/** Remove a temp directory created by makeTmpDir. Guarded to the OS temp dir. */
export function cleanTmpDir(dir: string): void {
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(tmpRoot + path.sep)) return;
  fs.rmSync(resolved, { recursive: true, force: true });
}

/** Run fn with a fresh temp dir, cleaning up afterward even on throw. */
export function withTmpDir<T>(fn: (dir: string) => T, prefix = 'test'): T {
  const dir = makeTmpDir(prefix);
  try {
    return fn(dir);
  } finally {
    cleanTmpDir(dir);
  }
}
