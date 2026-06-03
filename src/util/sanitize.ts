import * as path from 'node:path';

const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MAX_NAME_LEN = 64;

export function sanitizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, MAX_NAME_LEN) || 'unnamed-skill';
}

export function validateName(name: string): string | null {
  if (!name) return 'name is required';
  if (name.length > MAX_NAME_LEN) return `name exceeds ${MAX_NAME_LEN} characters`;
  if (!NAME_RE.test(name)) return 'name must be lowercase alphanumeric with single hyphens, starting with a letter';
  return null;
}

export function isPathSafe(basePath: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}

export function sanitizeSubpath(subpath: string): string | null {
  const segments = subpath.split(/[/\\]/);
  if (segments.some(s => s === '..')) return null;
  return segments.filter(s => s && s !== '.').join('/');
}

export function stripTerminalEscapes(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')  // CSI sequences
    .replace(/\x1b\][^\x07]*\x07/g, '')       // OSC sequences
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''); // control chars (keep \t \n \r)
}
