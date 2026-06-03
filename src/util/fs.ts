import * as fs from 'node:fs';
import * as path from 'node:path';

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function symlinkOrCopy(src: string, dest: string, forceCopy = false): 'symlink' | 'copy' {
  ensureDir(path.dirname(dest));

  if (fs.existsSync(dest)) {
    const stat = fs.lstatSync(dest);
    if (stat.isSymbolicLink()) fs.unlinkSync(dest);
    else if (stat.isDirectory()) fs.rmSync(dest, { recursive: true });
    else fs.unlinkSync(dest);
  }

  if (forceCopy) {
    copyDir(src, dest);
    return 'copy';
  }

  try {
    const rel = path.relative(path.dirname(dest), src);
    fs.symlinkSync(rel, dest);
    return 'symlink';
  } catch {
    copyDir(src, dest);
    return 'copy';
  }
}

export function copyDir(src: string, dest: string): void {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === '.git') continue;
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function removeDir(dir: string): boolean {
  try {
    const stat = fs.lstatSync(dir);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(dir);
    } else {
      fs.rmSync(dir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

export function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

export function fileExists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}
